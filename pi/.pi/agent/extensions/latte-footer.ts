/**
 * Latte Footer — powerline-style footer matching Catppuccin Latte.
 *
 * Line 1: [󰚩 model  thinking]  [ path   branch] ···· context bar + exact tokens · tokens · cost
 * Line 2: git status + PR #n · provider quotas (openai-codex 5h/weekly, kimi, openrouter, xai)
 *
 * Toggle with /latte-footer. Icons are configurable below (Nerd Font).
 * Quotas are polled every 5 min using the OAuth tokens from ~/.pi/agent/auth.json.
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	ReadonlyFooterDataProvider,
	Theme,
} from "@earendil-works/pi-coding-agent";
import { hyperlink, truncateToWidth, visibleWidth, type TUI } from "@earendil-works/pi-tui";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Buffer } from "node:buffer";
import { getSurfaceDensity, subscribeSurfaceChanges } from "./ui/surface.ts";

const execFileAsync = promisify(execFile);

// ── Catppuccin Latte palette ──────────────────────────────────────────
const LATTE = {
	mauve: "#8839ef",
	blue: "#1e66f5",
	sapphire: "#209fb5",
	teal: "#179299",
	green: "#40a02b",
	yellow: "#df8e1d",
	peach: "#fe640b",
	red: "#d20f39",
	base: "#eff1f5", // pill text
	surface1: "#bcc0cc",
	subtext0: "#6c6f85",
	overlay1: "#8c8fa1",
};

// ── Config ────────────────────────────────────────────────────────────
const ICONS = {
	model: "\u{f06a9}", // nf-md-robot
	folder: "\u{f07b}", // nf-fa-folder
	branch: "\u{e0a0}", // powerline branch
	thinking: "\u{f0eb}", // nf-fa-lightbulb
	context: "\u{f200}", // nf-fa-pie_chart
	quota: "\u{f0109}", // nf-md-gauge
	reset: "↺",
};
const PILL_LEFT = "\u{e0b6}";
const PILL_RIGHT = "\u{e0b4}";
const SEG_SEP = "\u{e0b0}"; // powerline hard separator between fused segments
const BAR_WIDTH = 8;
const BAR_FULL = "█";
const BAR_EMPTY = "░";
const QUOTA_POLL_MS = 5 * 60 * 1000;
const GIT_POLL_MS = 4000;
const PR_POLL_MS = 30_000;
const AUTH_PATH = `${homedir()}/.pi/agent/auth.json`;

const THINKING_COLORS: Record<string, string> = {
	off: LATTE.overlay1,
	minimal: LATTE.subtext0,
	low: LATTE.sapphire,
	medium: LATTE.blue,
	high: LATTE.mauve,
	xhigh: LATTE.peach,
	max: LATTE.red,
};

// ── ANSI helpers (24-bit) ─────────────────────────────────────────────
function rgb(hex: string): [number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	if (![r, g, b].every((n) => Number.isFinite(n))) return [108, 111, 133]; // LATTE.subtext0 fallback
	return [r, g, b];
}

function finiteNumber(value: unknown): number | undefined {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? n : undefined;
}

/** Unwrap JSON `{val: n}` or plain number. */
function valOf(x: unknown): number | undefined {
	if (typeof x === "number") return finiteNumber(x);
	if (isRecord(x) && "val" in x) return finiteNumber(x.val);
	return finiteNumber(x);
}

/** Type guard: JSON object (not array, not null). */
function isRecord(x: unknown): x is Record<string, unknown> {
	return typeof x === "object" && x !== null && !Array.isArray(x);
}
function fgHex(hex: string, s: string): string {
	const [r, g, b] = rgb(hex);
	return `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
}
/** fg on bg, both hex. */
function fgOn(fg: string, bg: string, s: string): string {
	const [fr, fg_, fb] = rgb(fg);
	const [br, bg_, bb] = rgb(bg);
	return `\x1b[38;2;${fr};${fg_};${fb}m\x1b[48;2;${br};${bg_};${bb}m${s}\x1b[49m\x1b[39m`;
}

type Segment = { bg: string; fg?: string; label: string; icon?: string };

/** Render fused powerline segments: rounded caps outside,  inside. */
function powerline(segments: Segment[]): string {
	if (segments.length === 0) return "";
	let out = fgHex(segments[0]!.bg, PILL_LEFT);
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]!;
		const text = seg.icon ? ` ${seg.icon} ${seg.label} ` : ` ${seg.label} `;
		out += fgOn(seg.fg ?? LATTE.base, seg.bg, text);
		const next = segments[i + 1];
		if (next) {
			// hard separator: arrow in current bg color, on next segment's bg
			out += fgOn(seg.bg, next.bg, SEG_SEP);
		}
	}
	out += fgHex(segments[segments.length - 1]!.bg, PILL_RIGHT);
	return out;
}

function fmtTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(2)}M`;
}

function shortPath(cwd: string): string {
	const home = homedir();
	if (cwd === home) return "~";
	if (cwd.startsWith(home + "/")) return "~/" + cwd.slice(home.length + 1);
	return cwd;
}

/**
 * Smooth RGB gradient by remaining ratio.
 * Anchors: 100% green → 60% yellow → 40% peach → 20% red (held below).
 */
const QUOTA_STOPS: [number, string][] = [
	[1.0, LATTE.green],
	[0.6, LATTE.yellow],
	[0.4, LATTE.peach],
	[0.2, LATTE.red],
];

function lerpChannel(a: number, b: number, t: number): number {
	return Math.round(a + (b - a) * t);
}

function quotaColor(remaining: number, limit: number): string {
	if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return LATTE.subtext0;
	const r = Math.max(0, Math.min(1, remaining / limit));

	// Find bracketing stops (stops are sorted high → low)
	let upper = QUOTA_STOPS[0]!;
	let lower = QUOTA_STOPS[QUOTA_STOPS.length - 1]!;
	for (let i = 0; i < QUOTA_STOPS.length - 1; i++) {
		if (r <= QUOTA_STOPS[i]![0] && r >= QUOTA_STOPS[i + 1]![0]) {
			upper = QUOTA_STOPS[i]!;
			lower = QUOTA_STOPS[i + 1]!;
			break;
		}
	}
	if (r > upper[0]) return upper[1];
	if (r < lower[0]) return lower[1];

	const span = upper[0] - lower[0];
	const t = span === 0 ? 0 : (r - lower[0]) / span;
	const [ar, ag, ab] = rgb(upper[1]);
	const [br, bg, bb] = rgb(lower[1]);
	const toHex = (n: number) => n.toString(16).padStart(2, "0");
	return `#${toHex(lerpChannel(br, ar, t))}${toHex(lerpChannel(bg, ag, t))}${toHex(lerpChannel(bb, ab, t))}`;
}

/** Color for credit balance (no limit to compare against): thresholds in $. */
function balanceColor(balance: number): string {
	if (balance >= 10) return LATTE.green;
	if (balance >= 5) return LATTE.yellow;
	if (balance >= 2) return LATTE.peach;
	return LATTE.red;
}

/** Circle fraction dial by remaining ratio (visually distinct from context bar). */
function quotaDial(ratio: number): string {
	if (ratio > 0.87) return "●";
	if (ratio > 0.62) return "◕";
	if (ratio > 0.37) return "◑";
	if (ratio > 0.12) return "◔";
	return "○";
}

/** Dial + colored percentage of remaining quota. */
function quotaGauge(remaining: number, limit: number): string {
	if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) {
		return fgHex(LATTE.subtext0, "—");
	}
	// At hard zero remaining, still show 0% (not NaN / broken ANSI).
	const ratio = Math.max(0, Math.min(1, remaining / limit));
	const pct = Math.round(ratio * 100);
	const color = quotaColor(remaining, limit);
	return `${fgHex(color, quotaDial(ratio))} ${fgHex(color, `${pct}%`)}`;
}

/** Reset time: HH:MM if <24h away, else short date. */
function fmtReset(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "?";
	const diffH = (d.getTime() - Date.now()) / 3_600_000;
	if (diffH < 24) {
		return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
	}
	return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

// ── Quota polling ─────────────────────────────────────────────────────
type KimiQuota = {
	fiveHour: { used: number; limit: number; remaining: number; reset: string };
	weekly: { used: number; limit: number; remaining: number; reset: string };
};
type OpenRouterQuota = {
	balance: number; // account credits remaining (total_credits - total_usage)
	weekly?: { remaining: number; limit: number }; // per-key weekly spend cap, if set
};
type XaiQuota = {
	tier?: string;
	// Legacy GrokBuildBillingConfig fields (deprecated, old accounts only)
	monthly?: { used: number; limit: number; reset: string };
	// Primary pool gauge — creditUsagePercent over a weekly OR monthly period
	pool?: { usedPercent: number; reset: string; label: "hebdo" | "mois" };
	prepaidBalance?: number;
};
type UsageWindow = {
	usedPercent: number;
	reset: string;
	label: string;
};
type OpenAIQuota = {
	plan?: string;
	windows: UsageWindow[];
	credits?: number;
	resets?: number;
};
type QuotaCache = {
	kimi?: KimiQuota;
	openrouter?: OpenRouterQuota;
	xai?: XaiQuota;
	openai?: OpenAIQuota;
	error?: boolean;
};

function readAuthRecord(provider: string): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(readFileSync(AUTH_PATH, "utf8"));
		if (!isRecord(parsed)) return undefined;
		const entry = parsed[provider];
		return isRecord(entry) ? entry : undefined;
	} catch {
		return undefined;
	}
}

function readAuthField(provider: string, field: string): string | undefined {
	const value = readAuthRecord(provider)?.[field];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readToken(provider: string): string | undefined {
	return readAuthField(provider, "access");
}

async function fetchJson(url: string, token: string): Promise<unknown | undefined> {
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return undefined;
		return await res.json();
	} catch {
		return undefined;
	}
}

async function fetchJsonWithHeaders(url: string, headers: Record<string, string>): Promise<unknown | undefined> {
	try {
		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return undefined;
		return await res.json();
	} catch {
		return undefined;
	}
}

const OPENAI_PLAN_LABELS: Record<string, string> = {
	guest: "guest",
	free: "free",
	go: "go",
	plus: "plus",
	pro: "pro",
	prolite: "pro lite",
	free_workspace: "workspace",
	team: "team",
	business: "business",
	enterprise: "enterprise",
	edu: "edu",
	education: "edu",
	quorum: "quorum",
	k12: "k12",
	unknown: "unknown",
};

function openaiPlanLabel(planType: unknown): string | undefined {
	if (typeof planType !== "string" || planType.length === 0) return undefined;
	return OPENAI_PLAN_LABELS[planType] ?? planType;
}

function usageWindowLabel(limitWindowSeconds: number): string {
	if (limitWindowSeconds >= 6 * 24 * 3600) return "sem";
	if (limitWindowSeconds >= 4.5 * 3600) return "5h";
	if (limitWindowSeconds >= 45 * 60) return `${Math.round(limitWindowSeconds / 3600)}h`;
	return `${Math.max(1, Math.round(limitWindowSeconds / 60))}min`;
}

function chatgptAccountIdFromToken(token: string): string | undefined {
	const payload = token.split(".")[1];
	if (!payload) return undefined;
	try {
		const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
		const parsed: unknown = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
		if (!isRecord(parsed)) return undefined;
		const oauth = parsed["https://api.openai.com/auth"];
		if (!isRecord(oauth)) return undefined;
		const id = oauth.chatgpt_account_id;
		return typeof id === "string" && id.length > 0 ? id : undefined;
	} catch {
		return undefined;
	}
}

function parseUsageWindow(raw: unknown): UsageWindow | undefined {
	if (!isRecord(raw)) return undefined;
	const usedPercent = finiteNumber(raw.used_percent);
	const windowSeconds = finiteNumber(raw.limit_window_seconds);
	if (usedPercent === undefined || windowSeconds === undefined || windowSeconds <= 0) return undefined;
	const resetAt = finiteNumber(raw.reset_at);
	const reset =
		resetAt === undefined ? "" : new Date(resetAt * 1000).toISOString();
	return {
		usedPercent: Math.min(100, Math.max(0, usedPercent)),
		reset,
		label: usageWindowLabel(windowSeconds),
	};
}

function parseOpenAIUsage(raw: unknown): OpenAIQuota | undefined {
	if (!isRecord(raw)) return undefined;
	const rateLimit = isRecord(raw.rate_limit) ? raw.rate_limit : undefined;
	const windows = [rateLimit?.primary_window, rateLimit?.secondary_window].flatMap((window) => {
		const parsed = parseUsageWindow(window);
		return parsed ? [parsed] : [];
	});
	const creditsRaw = isRecord(raw.credits) ? raw.credits : undefined;
	const credits =
		creditsRaw?.has_credits === true ? finiteNumber(creditsRaw.balance) : undefined;
	const resetsRaw = isRecord(raw.rate_limit_reset_credits) ? raw.rate_limit_reset_credits : undefined;
	const resets = finiteNumber(resetsRaw?.available_count);
	const plan = openaiPlanLabel(raw.plan_type);
	if (!plan && windows.length === 0 && credits === undefined && (resets === undefined || resets <= 0)) {
		return undefined;
	}
	const quota: OpenAIQuota = { windows };
	if (plan) quota.plan = plan;
	if (credits !== undefined && credits > 0) quota.credits = credits;
	if (resets !== undefined && resets > 0) quota.resets = resets;
	return quota;
}

function parseKimiWindow(detail: unknown, resetFallback?: unknown): KimiQuota["fiveHour"] | undefined {
	if (!detail || typeof detail !== "object") return undefined;
	const d = detail as Record<string, unknown>;
	const used = finiteNumber(d.used) ?? 0;
	const limit = finiteNumber(d.limit);
	const remaining =
		finiteNumber(d.remaining) ??
		(limit !== undefined ? Math.max(0, limit - used) : undefined);
	const resetRaw = d.resetTime ?? d.reset_time ?? d.resetAt ?? resetFallback;
	const reset = typeof resetRaw === "string" ? resetRaw : "";
	if (limit === undefined || remaining === undefined) return undefined;
	return { used, limit, remaining, reset };
}

async function pollQuotas(): Promise<QuotaCache> {
	const cache: QuotaCache = {};

	const kimiToken = readToken("kimi-coding");
	if (kimiToken) {
		const kimiRes = await fetchJson("https://api.kimi.com/coding/v1/usages", kimiToken);
		const data = isRecord(kimiRes) ? kimiRes : undefined;
		const limits: unknown[] = Array.isArray(data?.limits) ? data.limits : [];
		const fiveHourRaw = limits.find((l: unknown) => {
			const w = (l as { window?: { duration?: number; timeUnit?: string } })?.window;
			return w?.duration === 300 && w?.timeUnit === "TIME_UNIT_MINUTE";
		}) as { detail?: unknown } | undefined;
		// Weekly may live under usage, or as a TIME_UNIT_WEEK/DAY limit entry.
		const weeklyLimitRaw = limits.find((l: unknown) => {
			const w = (l as { window?: { timeUnit?: string; duration?: number } })?.window;
			const unit = w?.timeUnit ?? "";
			return (
				unit.includes("WEEK") ||
				unit === "TIME_UNIT_DAY" && (w?.duration ?? 0) >= 7 ||
				(w?.duration === 10080 && unit.includes("MINUTE"))
			);
		}) as { detail?: unknown } | undefined;
		const fiveHour = parseKimiWindow(fiveHourRaw?.detail ?? fiveHourRaw);
		const weekly =
			parseKimiWindow(data?.usage) ??
			parseKimiWindow(weeklyLimitRaw?.detail ?? weeklyLimitRaw);
		if (fiveHour && weekly) {
			cache.kimi = { fiveHour, weekly };
		} else if (fiveHour) {
			// Show 5h alone rather than nothing / NaN when weekly shape drifts at 0.
			cache.kimi = {
				fiveHour,
				weekly: { used: 0, limit: 0, remaining: 0, reset: "" },
			};
		}
	}

	const orToken = readToken("openrouter");
	if (orToken) {
		const creditsData = await fetchJson("https://openrouter.ai/api/v1/credits", orToken);
		const keyData = await fetchJson("https://openrouter.ai/api/v1/auth/key", orToken);
		const cd = isRecord(creditsData) ? creditsData : undefined;
		const kd = isRecord(keyData) ? keyData : undefined;
		const c = isRecord(cd?.data) ? cd?.data : undefined;
		const k = isRecord(kd?.data) ? kd?.data : undefined;
		if (c) {
			const total = c.total_credits;
			const usage = c.total_usage;
			if (typeof total === "number") {
				const quota: OpenRouterQuota = {
		balance: Math.max(0, total - (typeof usage === "number" ? usage : 0)),
				};
				if (k) {
		const limit = k.limit;
		const limitRemaining = k.limit_remaining;
		if (typeof limit === "number" && typeof limitRemaining === "number") {
			quota.weekly = { remaining: limitRemaining, limit };
		}
				}
				cache.openrouter = quota;
			}
		}
	}

	// xAI (Grok/X subscription) — cli-chat-proxy billing endpoints
	const xaiToken = readToken("xai");
	if (xaiToken) {
		const xaiHeaders = {
			Authorization: `Bearer ${xaiToken}`,
			"x-xai-token-auth": "xai-grok-cli",
			Accept: "application/json",
		};
		const [billingData, creditsData, settingsData] = await Promise.all([
			fetchJsonWithHeaders("https://cli-chat-proxy.grok.com/v1/billing", xaiHeaders),
			fetchJsonWithHeaders(
				"https://cli-chat-proxy.grok.com/v1/billing?format=credits",
				xaiHeaders,
			),
			fetchJsonWithHeaders("https://cli-chat-proxy.grok.com/v1/settings", xaiHeaders),
		]);

		const q: XaiQuota = {};

		// Tier
		const s = isRecord(settingsData) ? settingsData : undefined;
		const tier = s?.subscription_tier_display;
		if (typeof tier === "string" && tier.length > 0) q.tier = tier;

		// Monthly billing
		const bd = isRecord(billingData) ? billingData : undefined;
		const bCfg = isRecord(bd?.config) ? bd?.config : undefined;
		const mLimit = valOf(bCfg?.monthlyLimit);
		const mUsed = valOf(bCfg?.used);
		const mReset = typeof bCfg?.billingPeriodEnd === "string" ? bCfg.billingPeriodEnd : "";
		if (mLimit !== undefined && mUsed !== undefined) {
			q.monthly = { used: mUsed, limit: mLimit, reset: mReset };
		}

		// Primary pool — creditUsagePercent is the gauge grok.com Settings → Usage
		// shows; period is weekly or monthly (official billing.rs supports both).
		const cd = isRecord(creditsData) ? creditsData : undefined;
		const cCfg = isRecord(cd?.config) ? cd?.config : undefined;
		const periodObj = cCfg?.currentPeriod;
		const periodType = isRecord(periodObj) ? periodObj.type : undefined;
		if (periodType === "USAGE_PERIOD_TYPE_WEEKLY" || periodType === "USAGE_PERIOD_TYPE_MONTHLY") {
			const wReset =
				typeof cCfg?.billingPeriodEnd === "string"
		? cCfg.billingPeriodEnd
		: isRecord(periodObj) && typeof periodObj.end === "string"
			? periodObj.end
			: "";
			// Primary: creditUsagePercent; fallback: onDemandUsed / onDemandCap.
			// A parseable period with neither value means zero usage (CodexBar).
			let usedPercent = finiteNumber(cCfg?.creditUsagePercent);
			if (usedPercent === undefined) {
				const wCap = valOf(cCfg?.onDemandCap);
				const wUsed = valOf(cCfg?.onDemandUsed);
				usedPercent =
		wCap !== undefined && wCap > 0 && wUsed !== undefined
			? Math.min(100, Math.max(0, (wUsed / wCap) * 100))
			: 0;
			} else {
				usedPercent = Math.min(100, Math.max(0, usedPercent));
			}
			q.pool = {
				usedPercent,
				reset: wReset,
				label: periodType === "USAGE_PERIOD_TYPE_MONTHLY" ? "mois" : "hebdo",
			};
			const pb = valOf(cCfg?.prepaidBalance);
			if (pb !== undefined && pb > 0) q.prepaidBalance = pb;
		}

		cache.xai = q;
	}

	// OpenAI Codex (ChatGPT subscription) — WHAM usage windows
	const openaiToken = readToken("openai-codex");
	if (openaiToken) {
		const accountId =
			readAuthField("openai-codex", "accountId") ?? chatgptAccountIdFromToken(openaiToken);
		if (accountId) {
			const usage = await fetchJsonWithHeaders("https://chatgpt.com/backend-api/wham/usage", {
				Authorization: `Bearer ${openaiToken}`,
				"ChatGPT-Account-ID": accountId,
				originator: "codex_cli_rs",
				Accept: "application/json",
			});
			const quota = parseOpenAIUsage(usage);
			if (quota) cache.openai = quota;
		}
	}

	return cache;
}

// ── Git status polling ──────────────────────────────────────────────
type GitStatus = {
	modified: number; // unstaged modified
	staged: number; // staged (added/modified/renamed)
	deleted: number; // unstaged deleted
	untracked: number;
	stash: number;
	ahead: number;
	behind: number;
};

/** Parse `git status --porcelain=v2 --branch` + stash list. Returns null outside a repo. */
async function fetchGitStatus(cwd: string): Promise<GitStatus | null> {
	try {
		const [{ stdout }, { stdout: stashOut }] = await Promise.all([
			execFileAsync("git", ["status", "--porcelain=v2", "--branch"], {
				cwd,
				timeout: 5000,
			}),
			execFileAsync("git", ["stash", "list"], { cwd, timeout: 5000 }),
		]);
		const status: GitStatus = {
			modified: 0,
			staged: 0,
			deleted: 0,
			untracked: 0,
			stash: stashOut.trim() === "" ? 0 : stashOut.trim().split("\n").length,
			ahead: 0,
			behind: 0,
		};
		for (const line of stdout.split("\n")) {
			if (line.startsWith("# branch.ab")) {
				const m = line.match(/\+(\d+)\s+-(\d+)/);
				if (m) {
		status.ahead = Number(m[1]);
		status.behind = Number(m[2]);
				}
				continue;
			}
			if (line.startsWith("? ")) {
				status.untracked++;
				continue;
			}
			// Ordinary entries: `1 <XY> ...`, renamed: `2 <XY> ...`
			if (line.startsWith("1 ") || line.startsWith("2 ")) {
				const xy = line.slice(2, 4);
				const x = xy[0]!; // staged
				const y = xy[1]!; // unstaged
				if (x !== "." && x !== " ") status.staged++;
				if (y === "M") status.modified++;
				else if (y === "D") status.deleted++;
			}
		}
		return status;
	} catch {
		return null;
	}
}

const GIT_BAR_WIDTH = 10;

/** Block glyph for a 0–1 fill ratio within one cell. "" when empty. */
function ratioGlyph(ratio: number): string {
	if (ratio <= 0) return "";
	if (ratio <= 0.125) return "▁";
	if (ratio <= 0.25) return "▂";
	if (ratio <= 0.375) return "▃";
	if (ratio <= 0.5) return "▄";
	if (ratio <= 0.625) return "▅";
	if (ratio <= 0.75) return "▆";
	if (ratio <= 0.875) return "▇";
	return "█";
}

/** Proportional ascii bar of the working tree: each change type gets a colored share. */
function gitBar(s: GitStatus): string {
	const frame = (inner: string) =>
		fgHex(LATTE.subtext0, "▕") + inner + fgHex(LATTE.subtext0, "▏");
	const cats: { count: number; color: string }[] = [
		{ count: s.staged, color: LATTE.green },
		{ count: s.modified, color: LATTE.yellow },
		{ count: s.deleted, color: LATTE.red },
		{ count: s.untracked, color: LATTE.overlay1 },
	];
	const total = cats.reduce((acc, c) => acc + c.count, 0);
	if (total === 0) return frame(fgHex(LATTE.surface1, BAR_EMPTY.repeat(GIT_BAR_WIDTH)));

	// Split the width proportionally (largest remainder), keeping a fractional
	// leftover so the bar always spans the full width via one partial glyph.
	const exact = cats.map((c) => (c.count / total) * GIT_BAR_WIDTH);
	const floors = exact.map(Math.floor);
	let used = floors.reduce((a, b) => a + b, 0);
	const byRemainder = cats
		.map((c, i) => ({ i, rem: exact[i]! - floors[i]! }))
		.filter((r) => cats[r.i]!.count > 0)
		.sort((a, b) => b.rem - a.rem);
	for (const r of byRemainder) {
		if (used >= GIT_BAR_WIDTH) break;
		floors[r.i]!++;
		used++;
	}
	let bar = "";
	let partialColor: string | undefined;
	let partialRatio = 0;
	for (let i = 0; i < cats.length; i++) {
		if (cats[i]!.count === 0) continue;
		bar += fgHex(cats[i]!.color, BAR_FULL.repeat(floors[i]!));
		const frac = exact[i]! - Math.floor(exact[i]!);
		if (frac > 0.05) {
			partialColor = cats[i]!.color;
			partialRatio = frac;
		}
	}
	if (partialColor) bar += fgHex(partialColor, ratioGlyph(partialRatio));
	return frame(bar);
}

function readSafely<T>(read: () => T, fallback: T): T {
	try {
		return read();
	} catch {
		return fallback;
	}
}

function clampFooterLines(lines: string[], width: number): string[] {
	return lines.map((line) =>
		visibleWidth(line) <= width ? line : truncateToWidth(line, width),
	);
}

/** Left side of line 2: ascii-style git summary with proportional bar + counters. */
function gitLine(s: GitStatus | null): string {
	const dim = (t: string) => fgHex(LATTE.subtext0, t);
	if (s === null) return `${dim("git")} ${dim("—")}`;
	const clean =
		s.staged + s.modified + s.deleted + s.untracked + s.stash + s.ahead + s.behind === 0;
	if (clean) return `${dim("git")} ${fgHex(LATTE.green, "✓")}${dim(" clean")}`;
	const counters: string[] = [];
	if (s.ahead > 0) counters.push(fgHex(LATTE.mauve, `⇡${s.ahead}`));
	if (s.behind > 0) counters.push(fgHex(LATTE.mauve, `⇣${s.behind}`));
	if (s.staged > 0) counters.push(fgHex(LATTE.green, `+${s.staged}`));
	if (s.modified > 0) counters.push(fgHex(LATTE.yellow, `~${s.modified}`));
	if (s.deleted > 0) counters.push(fgHex(LATTE.red, `-${s.deleted}`));
	if (s.untracked > 0) counters.push(fgHex(LATTE.overlay1, `?${s.untracked}`));
	if (s.stash > 0) counters.push(fgHex(LATTE.sapphire, `≡${s.stash}`));
	return `${dim("git")} ${gitBar(s)} ${counters.join(dim("·") + " ")}`;
}

// ── Current GitHub PR ───────────────────────────────────────────────
type GitPr = { number: number; url: string };

function isGitPr(value: unknown): value is GitPr {
	if (!isRecord(value)) return false;
	const number = value.number;
	const url = value.url;
	return (
		typeof number === "number" &&
		Number.isInteger(number) &&
		number > 0 &&
		typeof url === "string" &&
		url.startsWith("https://")
	);
}

/** Resolve the PR attached to the current branch via `gh`. Null if none / not GitHub. */
async function fetchCurrentPr(cwd: string): Promise<GitPr | null> {
	try {
		const { stdout } = await execFileAsync("gh", ["pr", "view", "--json", "number,url"], {
			cwd,
			timeout: 8000,
		});
		const parsed: unknown = JSON.parse(stdout);
		return isGitPr(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** Clickable `PR #n` (OSC 8). Empty when no PR is cached. */
function prLink(pr: GitPr | null): string {
	if (!pr) return "";
	return hyperlink(fgHex(LATTE.blue, `PR #${pr.number}`), pr.url);
}

function usageWindowPart(window: UsageWindow, dim: (s: string) => string): string {
	const remaining = 100 - window.usedPercent;
	const reset = window.reset ? ` ${dim(`${ICONS.reset} ${fmtReset(window.reset)}`)}` : "";
	return `${dim(window.label)} ${quotaGauge(remaining, 100)}${reset}`;
}

function openaiQuotaPart(quota: OpenAIQuota, dim: (s: string) => string): string {
	const head = quota.plan
		? `${dim("openai")} ${fgHex(LATTE.mauve, quota.plan)}`
		: dim("openai");
	const extras = quota.windows.map((window) => usageWindowPart(window, dim));
	if (quota.credits !== undefined) {
		const col = balanceColor(quota.credits);
		extras.push(`${fgHex(col, "◉")} ${fgHex(col, `$${quota.credits.toFixed(2)}`)} ${dim("crédits")}`);
	}
	if (quota.resets !== undefined) {
		extras.push(dim(`${quota.resets} reset${quota.resets > 1 ? "s" : ""}`));
	}
	if (extras.length === 0) return `${head} ${fgHex(LATTE.subtext0, "—")}`;
	return `${head}   ${extras.join("   ")}`;
}

function gitWithPr(status: GitStatus | null, pr: GitPr | null): string {
	const git = gitLine(status);
	const link = prLink(pr);
	if (!link) return git;
	return `${git} ${fgHex(LATTE.subtext0, "·")} ${link}`;
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let requestRender: (() => void) | undefined;
	let quotaCache: QuotaCache = {};
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let gitCache: GitStatus | null = null;
	let gitTimer: ReturnType<typeof setInterval> | undefined;
	let gitCwd: string | undefined;
	let prCache: GitPr | null = null;
	let prTimer: ReturnType<typeof setInterval> | undefined;
	let prGeneration = 0;
	let lifecycleGeneration = 0;
	let footerInstalled = false;
	let unsubscribeSurfaceChanges: (() => void) | undefined;

	function requestRenderSafely(): void {
		try {
			requestRender?.();
		} catch {
			requestRender = undefined;
		}
	}

	async function refreshQuotas(): Promise<void> {
		const generation = lifecycleGeneration;
		try {
			const quotas = await pollQuotas();
			if (generation !== lifecycleGeneration) return;
			quotaCache = quotas;
			requestRenderSafely();
		} catch {
			// Quota APIs are decorative; a provider/network failure must never escape a timer.
		}
	}

	function startPolling() {
		if (pollTimer) return;
		void refreshQuotas();
		pollTimer = setInterval(() => void refreshQuotas(), QUOTA_POLL_MS);
		pollTimer.unref?.();
	}

	async function refreshGit(cwd: string): Promise<void> {
		const generation = lifecycleGeneration;
		try {
			const status = await fetchGitStatus(cwd);
			if (generation !== lifecycleGeneration) return;
			gitCache = status;
			requestRenderSafely();
		} catch {
			// Git status is decorative; never reject from an interval callback.
		}
	}

	function startGitPolling(cwd: string) {
		gitCwd = cwd;
		if (gitTimer) {
			void refreshGit(cwd);
			return;
		}
		void refreshGit(cwd);
		gitTimer = setInterval(() => {
			if (gitCwd) void refreshGit(gitCwd);
		}, GIT_POLL_MS);
		gitTimer.unref?.();
	}

	async function refreshPr(cwd: string): Promise<void> {
		const generation = ++prGeneration;
		const lifecycle = lifecycleGeneration;
		try {
			const pr = await fetchCurrentPr(cwd);
			if (generation !== prGeneration || lifecycle !== lifecycleGeneration) return;
			if (prCache?.number === pr?.number && prCache?.url === pr?.url) return;
			prCache = pr;
			requestRenderSafely();
		} catch {
			// GitHub status is decorative; never reject from an interval callback.
		}
	}

	function startPrPolling(cwd: string): void {
		void refreshPr(cwd);
		if (prTimer) return;
		prTimer = setInterval(() => {
			if (gitCwd) void refreshPr(gitCwd);
		}, PR_POLL_MS);
		prTimer.unref?.();
	}

	function refreshPrForBranchChange(): void {
		prCache = null;
		requestRenderSafely();
		if (gitCwd) void refreshPr(gitCwd);
	}

	function setup(ctx: ExtensionContext) {
		if (!enabled) return;
		unsubscribeSurfaceChanges ??= subscribeSurfaceChanges(requestRenderSafely);
		startPolling();
		startGitPolling(ctx.cwd ?? process.cwd());
		startPrPolling(ctx.cwd ?? process.cwd());

		// Only install the footer component once — re-setFooter on every
		// session_start / toggle stacks ghost rows with the split-footer renderer.
		if (footerInstalled) {
			requestRenderSafely();
			return;
		}
		footerInstalled = true;

		ctx.ui.setFooter((tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) => {
			requestRender = () => tui.requestRender();
			const unsubBranch = footerData.onBranchChange(() => {
				tui.requestRender();
				refreshPrForBranchChange();
			});

			return {
				dispose() {
		unsubBranch();
		footerInstalled = false;
		requestRender = undefined;
				},
				invalidate() {},
				render(width: number): string[] {
		try {
			return clampFooterLines(renderFooter(width, ctx, theme, footerData), width);
		} catch {
			return [""];
		}
				},
			};
		});
	}

	function renderFooter(
		width: number,
		ctx: ExtensionContext,
		theme: Theme,
		footerData: ReadonlyFooterDataProvider,
	): string[] {
		// ── Line 1, left: model+thinking · path+branch ──
		const model = readSafely(() => ctx.model?.id, undefined) || "no-model";
		const thinking = readSafely(() => ctx.thinkingLevel, "off") ?? "off";
		const modelGroup = powerline([
			{ bg: LATTE.mauve, label: model, icon: ICONS.model },
			{
				bg: THINKING_COLORS[thinking] ?? LATTE.overlay1,
				label: thinking,
				icon: ICONS.thinking,
			},
		]);

		const cwd = shortPath(readSafely(() => ctx.cwd, undefined) ?? process.cwd());
		const branch = footerData.getGitBranch();
		const pathSegs: Segment[] = [{ bg: LATTE.teal, label: cwd, icon: ICONS.folder }];
		if (branch) pathSegs.push({ bg: LATTE.sapphire, label: branch, icon: ICONS.branch });
		const pathGroup = powerline(pathSegs);

		const left = `${modelGroup} ${pathGroup}`;

		// ── Line 1, right: statuses · context bar + exact tokens · tokens · cost ──
		let input = 0,
			output = 0,
			cost = 0;
		const branchEntries = readSafely(() => ctx.sessionManager.getBranch(), []);
		for (const e of branchEntries) {
			if (e.type === "message" && e.message.role === "assistant") {
				const m = e.message as AssistantMessage;
				input += finiteNumber(m.usage?.input) ?? 0;
				output += finiteNumber(m.usage?.output) ?? 0;
				cost += finiteNumber(m.usage?.cost?.total) ?? 0;
			}
		}

		let ctxPart = "";
		const usage = readSafely(() => ctx.getContextUsage?.(), undefined);
		if (usage?.percent != null) {
			const pct = Math.round(usage.percent);
			const filled = Math.round((usage.percent / 100) * BAR_WIDTH);
			const barColor =
				usage.percent < 50 ? LATTE.green : usage.percent < 80 ? LATTE.peach : LATTE.red;
			const bar =
				fgHex(barColor, BAR_FULL.repeat(filled)) +
				fgHex(LATTE.surface1, BAR_EMPTY.repeat(BAR_WIDTH - filled));
			const exact =
				usage.tokens != null
					? ` ${fgHex(LATTE.overlay1, `${fmtTokens(usage.tokens)}/${fmtTokens(usage.contextWindow)}`)}`
					: "";
			ctxPart = `${fgHex(LATTE.overlay1, ICONS.context)} ${bar} ${fgHex(barColor, `${pct}%`)}${exact}`;
		}

		const tokPart = theme.fg(
			"dim",
			`↑${fmtTokens(input)} ↓${fmtTokens(output)}  $${cost.toFixed(3)}`,
		);

		const statuses = [...footerData.getExtensionStatuses().values()].filter(Boolean);
		const statusPart = statuses.join("  ");

		const right = [statusPart, ctxPart, tokPart].filter(Boolean).join("  ");

		const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
		const line1 = truncateToWidth(left + pad + right, width);

		// ── Line 2: git summary (left) · provider quota (right) ──
		const lines = [line1];
		const gitPart = gitWithPr(gitCache, prCache);
		const dim = (s: string) => fgHex(LATTE.subtext0, s);
		const provider = (readSafely(() => ctx.model?.provider, undefined) ?? "").toLowerCase();
		// Show the active provider's quota; fall back to everyone if unmatched
		const showXai = provider.includes("xai");
		const showKimi = provider.includes("kimi");
		const showOr = provider.includes("openrouter");
		const showOpenai = provider.includes("openai");
		const showAll = !showXai && !showKimi && !showOr && !showOpenai;

		const quotaParts: string[] = [];

		if (quotaCache.kimi && (showKimi || showAll)) {
			const { fiveHour, weekly } = quotaCache.kimi;
			let part =
				`${dim("kimi 5h")} ${quotaGauge(fiveHour.remaining, fiveHour.limit)}`;
			if (fiveHour.reset) {
				part += ` ${dim(`${ICONS.reset} ${fmtReset(fiveHour.reset)}`)}`;
			}
			// limit 0 = unknown / absent weekly — skip rather than emit junk
			if (Number.isFinite(weekly.limit) && weekly.limit > 0) {
				part += `   ${dim("sem")} ${quotaGauge(weekly.remaining, weekly.limit)}`;
				if (weekly.reset) {
					part += ` ${dim(`${ICONS.reset} ${fmtReset(weekly.reset)}`)}`;
				}
			}
			quotaParts.push(part);
		}

		if (quotaCache.openrouter && (showOr || showAll)) {
			const orq = quotaCache.openrouter;
			const col = balanceColor(orq.balance);
			let part =
				`${dim("openrouter")} ${fgHex(col, "◉")} ${fgHex(col, `$${orq.balance.toFixed(2)}`)}` +
				` ${dim("crédits")}`;
			if (orq.weekly) {
				part += `   ${dim("hebdo")} ${quotaGauge(orq.weekly.remaining, orq.weekly.limit)}`;
			}
			quotaParts.push(part);
		}

		if (quotaCache.openai && (showOpenai || showAll)) {
			quotaParts.push(openaiQuotaPart(quotaCache.openai, dim));
		}

		if (quotaCache.xai && (showXai || showAll)) {
			const x = quotaCache.xai;
			let part = `${dim("xai")}`;
			if (x.tier) part += ` ${fgHex(LATTE.mauve, x.tier)}`;
			// Legacy monthly cap — only when the primary pool isn't already monthly
			if (x.monthly && x.monthly.limit > 0 && x.pool?.label !== "mois") {
				const remaining = x.monthly.limit - x.monthly.used;
				part += `   ${dim("mois")} ${quotaGauge(remaining, x.monthly.limit)}`;
				if (x.monthly.reset) {
					part += ` ${dim(`${ICONS.reset} ${fmtReset(x.monthly.reset)}`)}`;
				}
			}
			if (x.pool && Number.isFinite(x.pool.usedPercent)) {
				// kimi-style: show the remaining share of the usage pool
				const remaining = 100 - x.pool.usedPercent;
				part += `   ${dim(x.pool.label)} ${quotaGauge(remaining, 100)}`;
				if (x.pool.reset) {
					part += ` ${dim(`${ICONS.reset} ${fmtReset(x.pool.reset)}`)}`;
				}
			}
			if (x.prepaidBalance && x.prepaidBalance > 0) {
				const col = balanceColor(x.prepaidBalance);
				part += `   ${fgHex(col, "◉")} ${fgHex(col, `$${x.prepaidBalance.toFixed(2)}`)} ${dim("crédits")}`;
			}
			// Always show at least the tier name so the provider is recognised
			if (part === `${dim("xai")}`) {
				part = `${dim("xai")} ${fgHex(LATTE.subtext0, "—")}`;
			}
			quotaParts.push(part);
		}

		if (getSurfaceDensity() === "detailed") {
			const quotaContent =
				quotaParts.length > 0
					? `${fgHex(LATTE.overlay1, ICONS.quota)} ${quotaParts.join(dim("   ·   "))}`
					: "";
			const pad2 = " ".repeat(
				Math.max(1, width - visibleWidth(gitPart) - visibleWidth(quotaContent)),
			);
			lines.push(truncateToWidth(gitPart + pad2 + quotaContent, width));
		}

		return lines;
	}

	pi.on("session_start", async (_event, ctx) => {
		setup(ctx);
	});
	pi.on("session_shutdown", async () => {
		lifecycleGeneration += 1;
		prGeneration += 1;
		if (pollTimer) clearInterval(pollTimer);
		if (gitTimer) clearInterval(gitTimer);
		if (prTimer) clearInterval(prTimer);
		pollTimer = undefined;
		gitTimer = undefined;
		prTimer = undefined;
		gitCwd = undefined;
		requestRender = undefined;
		footerInstalled = false;
		unsubscribeSurfaceChanges?.();
		unsubscribeSurfaceChanges = undefined;
	});

	// Refresh stats after each turn
	pi.on("turn_end", async () => requestRenderSafely());
	pi.on("agent_end", async () => requestRenderSafely());
	pi.on("thinking_level_select", async () => requestRenderSafely());
	pi.on("model_select", async () => requestRenderSafely());

	pi.registerCommand("latte-footer", {
		description: "Toggle the Catppuccin Latte powerline footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				footerInstalled = false;
				setup(ctx);
				ctx.ui.notify("Latte footer enabled", "info");
			} else {
				ctx.ui.setFooter(undefined);
				footerInstalled = false;
				requestRender = undefined;
				ctx.ui.notify("Default footer restored", "info");
			}
		},
	});

	pi.registerCommand("latte-quota", {
		description: "Force-refresh provider quota display",
		handler: async (_args, ctx) => {
			await refreshQuotas();
			ctx.ui.notify("Quotas refreshed", "info");
		},
	});
}
