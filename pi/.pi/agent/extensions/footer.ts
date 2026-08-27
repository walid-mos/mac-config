/**
 * Footer — flat riced style for light terminals (Catppuccin Latte).
 *
 * No filled pills: colored icons and tinted text sit directly on the
 * terminal background; groups are separated by thin verticals.
 * Line 1: 󰚩 model │ ✻ thinking │ path │····· statuses │ context gauge ▰▰▱▱ │ arrows │ cost
 * Line 2:  branch │ churn ▰▰▱▱ + counters + PR #n │····· provider quotas
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	ReadonlyFooterDataProvider,
	Theme,
} from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { surfaceLineWidth } from "./ui/surface.ts";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Buffer } from "node:buffer";

const execFileAsync = promisify(execFile);

// ── Catppuccin Latte palette (light terminals) ────────────────────────
const LATTE = {
	mauve: "#8839ef",
	blue: "#1e66f5",
	sapphire: "#209fb5",
	teal: "#179299",
	green: "#40a02b",
	yellow: "#df8e1d",
	peach: "#fe640b",
	red: "#d20f39",
	text: "#4c4f69", // primary text — strong on light backgrounds
	surface1: "#9ca0b0", // empty bar cells — visible yet quiet on light bg
	subtext0: "#6c6f85", // quiet labels and metadata
	overlay1: "#8c8fa1", // faintest tier — resets and hints only
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
const BAR_WIDTH = 8;
const BAR_FULL = "\u25b0"; // ▰ filled meter cell — light outline, optically centered
const BAR_EMPTY = "\u25b1"; // ▱ empty meter cell
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
// Width/truncation/hyperlink live here instead of @earendil-works/pi-tui values:
// that package only resolves through Pi's extension loader, and an import-free
// module keeps the pure renderer testable under plain node --test.

/** OSC 8 clickable text (same argument order as pi-tui: text first). */
function hyperlink(text: string, url: string): string {
	return `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
}

const SEP_THIN = "\u2502"; // │ quiet vertical separator between data groups

function thinSep(): string {
	return fgHex(LATTE.surface1, SEP_THIN);
}

function visibleWidth(line: string): number {
	return surfaceLineWidth(line);
}

function truncateToWidth(line: string, width: number): string {
	if (visibleWidth(line) <= width) return line;
	let out = "";
	let used = 0;
	let linkOpen = false;
	const tokens =
		line.match(/\u001b\[[0-?]*[ -/]*[@-~]|\u001b\]8;;[^\u0007]*\u0007|\u001b\]8;;\u0007|./gu) ?? [];
	for (const token of tokens) {
		if (token.startsWith("\u001b[")) {
			out += token;
			continue;
		}
		if (token.startsWith("\u001b]8;;")) {
			// OSC 8 wrappers are zero-width; keep them intact.
			// Opening carries a URL (`\e]8;;URL\a`); closing is bare (`\e]8;;\a`).
			linkOpen = !/^\u001b\]8;;\u0007$/.test(token);
			out += token;
			continue;
		}
		const w = surfaceLineWidth(token);
		if (used + w > width) break;
		used += w;
		out += token;
	}
	// Never leak an unclosed hyperlink when truncation lands inside one.
	return linkOpen ? `${out}\u001b]8;;\u0007` : out;
}

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

/** Compress a shortened path to its head and last two components: ~/…/ui/extensions */
function compactPath(path: string, maxWidth = 34): string {
	if (path.length <= maxWidth) return path;
	const parts = path.split("/").filter(Boolean);
	if (parts.length <= 2) return path;
	const head = path.startsWith("~") ? "~/" : "/";
	const tail = parts.slice(-2).join("/");
	const compressed = `${head}\u2026/${tail}`;
	return compressed.length < path.length ? compressed : path;
}

/** Hard-clamp plain text with a trailing ellipsis. */
function clampText(text: string, maxLength: number): string {
	return text.length <= maxLength ? text : `${text.slice(0, Math.max(1, maxLength - 1))}\u2026`;
}

/** Render fused powerline segments: rounded caps outside,  inside. */

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

const GIT_BAR_WIDTH = 6;

/** Rounded slim pill filled by working-tree churn, tinted by severity. */
function gitSlimBar(total: number, color: string): string {
	const filled = Math.max(1, Math.min(GIT_BAR_WIDTH, Math.round((total / 12) * GIT_BAR_WIDTH)));
	return (
		fgHex(color, BAR_FULL.repeat(filled)) +
		fgHex(LATTE.surface1, BAR_EMPTY.repeat(GIT_BAR_WIDTH - filled))
	);
}

/** Churn severity: deletions > edits > staged work > untracked noise. */
function churnColor(s: GitStatus): string {
	if (s.deleted > 0) return LATTE.red;
	if (s.modified > 0) return LATTE.yellow;
	if (s.staged > 0) return LATTE.green;
	return LATTE.sapphire;
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

/** Line 2 left: branch │ slim churn bar + counters (+ PR link appended later). */
function gitLine(s: GitStatus | null, branch?: string, maxBranch = 28): string {
	const dim = (t: string) => fgHex(LATTE.subtext0, t);
	const groups: string[] = [];

	if (branch) {
		groups.push(
			`${fgHex(LATTE.sapphire, ICONS.branch)} ${fgHex(LATTE.sapphire, clampText(branch, maxBranch))}`,
		);
	}

	if (s === null) {
		groups.push(dim("no git"));
		return groups.join(` ${thinSep()} `);
	}

	const clean =
		s.staged + s.modified + s.deleted + s.untracked + s.stash + s.ahead + s.behind === 0;
	if (clean) {
		groups.push(`${fgHex(LATTE.green, "\u2713")}${dim(" clean")}`);
		return groups.join(` ${thinSep()} `);
	}

	const counters: string[] = [];
	if (s.ahead > 0) counters.push(fgHex(LATTE.mauve, `\u21d1${s.ahead}`));
	if (s.behind > 0) counters.push(fgHex(LATTE.mauve, `\u21d3${s.behind}`));
	if (s.staged > 0) counters.push(fgHex(LATTE.green, `\u271a${s.staged}`));
	if (s.modified > 0) counters.push(fgHex(LATTE.yellow, `~${s.modified}`));
	if (s.deleted > 0) counters.push(fgHex(LATTE.red, `-${s.deleted}`));
	if (s.untracked > 0) counters.push(fgHex(LATTE.subtext0, `?${s.untracked}`));
	if (s.stash > 0) counters.push(fgHex(LATTE.sapphire, `\u2691${s.stash}`));

	groups.push(gitSlimBar(s.staged + s.modified + s.deleted + s.untracked, churnColor(s)));
	groups.push(counters.join(` ${dim("\u00b7")} `));

	return groups.join(` ${thinSep()} `);
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



function openaiQuotaPart(quota: OpenAIQuota, dim: (s: string) => string, compact = false): string {
	const head = quota.plan
		? `${dim("openai")} ${fgHex(LATTE.mauve, quota.plan)}`
		: dim("openai");
	const resets = compact ? [] : quota.windows.map((window) => window.reset).filter(Boolean);
	const extras = quota.windows.map(
		(window) => `${dim(window.label)} ${quotaGauge(100 - window.usedPercent, 100)}`,
	);
	if (resets.length > 0) {
		extras.push(dim(`${ICONS.reset} ${resets.map((r) => fmtReset(r)).join(" \u00b7 ")}`));
	}
	if (quota.credits !== undefined) {
		const col = balanceColor(quota.credits);
		extras.push(`${fgHex(col, "◉")} ${fgHex(col, `$${quota.credits.toFixed(2)}`)} ${dim("crédits")}`);
	}
	if (quota.resets !== undefined) {
		extras.push(dim(`${quota.resets} reset${quota.resets > 1 ? "s" : ""}`));
	}
	if (extras.length === 0) return `${head} ${fgHex(LATTE.subtext0, "—")}`;
	return `${head} ${extras.join(` ${thinSep()} `)}`;
}

function gitWithPr(
	status: GitStatus | null,
	pr: GitPr | null,
	branch?: string,
	maxBranch = 28,
	withPr = true,
): string {
	const groups = [gitLine(status, branch, maxBranch), withPr ? prLink(pr) : ""].filter(Boolean);
	return groups.join(` ${thinSep()} `);
}

// ── Pure footer rendering (no IO — exported for tests) ───────────────
export type FooterUsage = {
	percent: number;
	tokens?: number;
	contextWindow?: number;
};

export type FooterRenderInput = {
	width: number;
	model: string;
	thinkingLevel: string;
	cwd: string;
	branch?: string;
	usage?: FooterUsage;
	tokens: { input: number; output: number; cost: number };
	statuses: readonly string[];
	git: GitStatus | null;
	pr: GitPr | null;
	quotas: QuotaCache;
	provider?: string;
};

/** Left-aligned + right-aligned on one row, clamped to width. */
function justifyLine(left: string, right: string, width: number): string {
	const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
	return truncateToWidth(left + pad + right, width);
}

/** Quiet flat metadata: colored icon + muted label. */
function meta(icon: string, iconColor: string, label: string): string {
	return `${fgHex(iconColor, icon)} ${fgHex(LATTE.subtext0, label)}`;
}

function contextGroup(usage: FooterUsage, exactTokens: boolean): string {
	const pct = Math.round(usage.percent);
	const filled = Math.round((usage.percent / 100) * BAR_WIDTH);
	const barColor =
		usage.percent < 50 ? LATTE.green : usage.percent < 80 ? LATTE.peach : LATTE.red;
	const bar =
		fgHex(barColor, BAR_FULL.repeat(filled)) +
		fgHex(LATTE.surface1, BAR_EMPTY.repeat(BAR_WIDTH - filled));
	const exact =
		exactTokens && usage.tokens != null && usage.contextWindow != null
			? ` ${fgHex(LATTE.subtext0, `${fmtTokens(usage.tokens)}/${fmtTokens(usage.contextWindow)}`)}`
			: "";
	return `${fgHex(LATTE.subtext0, ICONS.context)} ${bar} ${fgHex(barColor, `${pct}%`)}${exact}`;
}

function providerQuotaParts(quotas: QuotaCache, provider: string | undefined, compact = false): string[] {
	const dim = (s: string) => fgHex(LATTE.subtext0, s);
	const p = (provider ?? "").toLowerCase();
	const showXai = p.includes("xai");
	const showKimi = p.includes("kimi");
	const showOr = p.includes("openrouter");
	const showOpenai = p.includes("openai");
	const showAll = !showXai && !showKimi && !showOr && !showOpenai;

	const parts: string[] = [];

	if (quotas.kimi && (showKimi || showAll)) {
		const { fiveHour, weekly } = quotas.kimi;
		const resets = [fiveHour.reset, weekly.reset].filter((r) => !compact && r);
		let part = `${dim("kimi")} ${dim("5h")} ${quotaGauge(fiveHour.remaining, fiveHour.limit)}`;
		if (Number.isFinite(weekly.limit) && weekly.limit > 0) {
			part += ` ${thinSep()} ${dim("sem")} ${quotaGauge(weekly.remaining, weekly.limit)}`;
		}
		if (resets.length > 0) {
			part += ` ${thinSep()} ${dim(`${ICONS.reset} ${resets.map((r) => fmtReset(r)).join(" \u00b7 ")}`)}`;
		}
		parts.push(part);
	}

	if (quotas.openrouter && (showOr || showAll)) {
		const orq = quotas.openrouter;
		const col = balanceColor(orq.balance);
		let part = `${dim("openrouter")} ${fgHex(col, "\u25c9")} ${fgHex(col, `$${orq.balance.toFixed(2)}`)}`;
		if (orq.weekly) {
			part += ` ${thinSep()} ${dim("hebdo")} ${quotaGauge(orq.weekly.remaining, orq.weekly.limit)}`;
			if (!compact && orq.weekly.reset) {
				part += ` ${thinSep()} ${dim(`${ICONS.reset} ${fmtReset(orq.weekly.reset)}`)}`;
			}
		}
		parts.push(part);
	}

	if (quotas.openai && (showOpenai || showAll)) {
		parts.push(openaiQuotaPart(quotas.openai, dim, compact));
	}

	if (quotas.xai && (showXai || showAll)) {
		const x = quotas.xai;
		let bits: string[] = [];
		if (x.tier) bits.push(fgHex(LATTE.mauve, x.tier));
		const xresets: string[] = [];
		if (x.monthly && x.monthly.limit > 0 && x.pool?.label !== "mois") {
			const remaining = x.monthly.limit - x.monthly.used;
			bits.push(`${dim("mois")} ${quotaGauge(remaining, x.monthly.limit)}`);
			if (x.monthly.reset) xresets.push(x.monthly.reset);
		}
		if (x.pool && Number.isFinite(x.pool.usedPercent)) {
			const remaining = 100 - x.pool.usedPercent;
			bits.push(`${dim(x.pool.label)} ${quotaGauge(remaining, 100)}`);
			if (x.pool.reset) xresets.push(x.pool.reset);
		}
		if (!compact && xresets.length > 0) {
			bits.push(dim(`${ICONS.reset} ${xresets.map((r) => fmtReset(r)).join(" \u00b7 ")}`));
		}
		if (x.prepaidBalance && x.prepaidBalance > 0) {
			const col = balanceColor(x.prepaidBalance);
			bits.push(`${fgHex(col, "\u25c9")} ${fgHex(col, `$${x.prepaidBalance.toFixed(2)}`)}`);
		}
		parts.push(bits.length > 0 ? `${dim("xai")} ${bits.join(` ${thinSep()} `)}` : `${dim("xai")} ${dim("\u2014")}`);
	}

	return parts;
}

export function renderFooterLines(input: FooterRenderInput): string[] {
	const width = Math.max(0, input.width);

	// ── Line 1 left: hero pill (model + thinking), never degraded ──
	const modelGroup = [
		`${fgHex(LATTE.mauve, ICONS.model)} ${fgHex(LATTE.text, input.model)}`,
		fgHex(THINKING_COLORS[input.thinkingLevel] ?? LATTE.subtext0, `${ICONS.thinking} ${input.thinkingLevel}`),
	].join(` ${fgHex(LATTE.mauve, SEP_THIN)} `);

	const arrowsGroup = fgHex(
		LATTE.subtext0,
		`\u2191${fmtTokens(input.tokens.input)} \u2193${fmtTokens(input.tokens.output)}`,
	);
	const costGroup = fgHex(LATTE.text, `$${input.tokens.cost.toFixed(3)}`);

	type Variant = { pathMax: number; exactTokens: boolean; hideMeta?: boolean };
	// Progressive degradation: shrink quiet meta first, then drop exact tokens,
	// then hide the meta block entirely, finally drop the arrow token counts
	// (the hero pill, context gauge and cost are never dropped).
	const variants: Variant[] = [
		{ pathMax: 34, exactTokens: true },
		{ pathMax: 22, exactTokens: true },
		{ pathMax: 18, exactTokens: false },
		{ pathMax: 18, exactTokens: false, hideMeta: true },
	];

	const buildLeft = (v: Variant): string => {
		let left = modelGroup;
		if (!v.hideMeta) {
			left = `${modelGroup} ${thinSep()} ${meta(ICONS.folder, LATTE.teal, compactPath(input.cwd, v.pathMax))}`;
		}
		return left;
	};
	// ── Line 1 right: provider quotas — model usage lives with the model ──
	const quotaOf = (compact: boolean): string =>
		quotaContent(providerQuotaParts(input.quotas, input.provider, compact));
	let line1: string | undefined;
	for (const v of variants) {
		const left = buildLeft(v);
		const right = quotaOf(false);
		if (visibleWidth(left) + visibleWidth(right) + 2 <= width) {
			line1 = justifyLine(left, right, width);
			break;
		}
	}
	if (line1 === undefined) {
		const left = buildLeft(variants[variants.length - 1]!);
		const compactQuota = quotaOf(true);
		line1 =
			visibleWidth(left) + visibleWidth(compactQuota) + 2 <= width
				? justifyLine(left, compactQuota, width)
				: truncateToWidth(justifyLine(left, compactQuota, width), width);
	}
	// ── Line 2: git left │ statuses + context + arrows + cost right ──
	const dataRight = (exactTokens: boolean, withArrows: boolean): string => {
		const rightGroups: string[] = [];
		if (input.statuses.length > 0) {
			rightGroups.push(input.statuses.join("  "));
		}
		if (input.usage != null && Number.isFinite(input.usage.percent)) {
			rightGroups.push(contextGroup(input.usage, exactTokens));
		}
		if (withArrows) rightGroups.push(arrowsGroup);
		rightGroups.push(costGroup);
		return rightGroups.join(` ${thinSep()} `);
	};
	// Degradation ladder: keep the richest right side as long as some left
	// variant fits — the cost is the very last thing either side gives up.
	const rights: string[] = [
		dataRight(true, true),
		dataRight(false, true),
		dataRight(false, false),
		costGroup,
	];
	const lefts: string[] = [
		gitWithPr(input.git, input.pr, input.branch),
		gitWithPr(input.git, input.pr, input.branch, 28, false),
		gitWithPr(input.git, input.pr, input.branch, 10, false),
		gitWithPr(input.git, input.pr, input.branch, 8, false),
		gitWithPr(input.git, input.pr, undefined, 28, false),
	];
	let line2: string | undefined;
	for (const right of rights) {
		for (const left of lefts) {
			if (visibleWidth(left) + visibleWidth(right) + 2 <= width) {
				line2 = justifyLine(left, right, width);
				break;
			}
		}
		if (line2 !== undefined) break;
	}
	line2 ??= truncateToWidth(justifyLine(lefts[0]!, costGroup, width), width);
	return [line1, line2];
}
function quotaContent(parts: string[]): string {
	if (parts.length === 0) return "";
	return `${fgHex(LATTE.subtext0, ICONS.quota)} ${parts.join(` ${thinSep()} `)}`;
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

		ctx.ui.setFooter((tui: TUI, _theme: Theme, footerData: ReadonlyFooterDataProvider) => {
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
			return clampFooterLines(renderFooter(width, ctx, footerData), width);
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
		footerData: ReadonlyFooterDataProvider,
	): string[] {
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
		return renderFooterLines({
			width,
			model: readSafely(() => ctx.model?.id, undefined) || "no-model",
			thinkingLevel: readSafely(() => ctx.thinkingLevel, "off") ?? "off",
			cwd: shortPath(readSafely(() => ctx.cwd, undefined) ?? process.cwd()),
			branch: footerData.getGitBranch() || undefined,
			usage: readSafely(() => ctx.getContextUsage?.(), undefined),
			tokens: { input, output, cost },
			statuses: [...footerData.getExtensionStatuses().values()].filter(Boolean),
			git: gitCache,
			pr: prCache,
			quotas: quotaCache,
			provider: readSafely(() => ctx.model?.provider, undefined)?.toLowerCase(),
		});
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
	});

	// Refresh stats after each turn
	pi.on("turn_end", async () => requestRenderSafely());
	pi.on("agent_end", async () => requestRenderSafely());
	pi.on("thinking_level_select", async () => requestRenderSafely());
	pi.on("model_select", async () => requestRenderSafely());

	pi.registerCommand("footer", {
		description: "Toggle the powerline footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				footerInstalled = false;
				setup(ctx);
				ctx.ui.notify("Footer enabled", "info");
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
