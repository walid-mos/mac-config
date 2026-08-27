import { Buffer } from "node:buffer";
import type { OpenAIQuota, UsageWindow } from "../types.ts";
import { finiteNumber, isRecord } from "../value.ts";
import { fetchJsonWithHeaders, readAuthField, readToken } from "./shared.ts";

const PLAN_LABELS: Record<string, string> = {
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

export async function pollOpenAIQuota(): Promise<OpenAIQuota | undefined> {
	const token = readToken("openai-codex");
	if (!token) return undefined;
	const accountId = readAuthField("openai-codex", "accountId") ?? accountIdFromToken(token);
	if (!accountId) return undefined;
	const usage = await fetchJsonWithHeaders("https://chatgpt.com/backend-api/wham/usage", {
		Authorization: `Bearer ${token}`,
		"ChatGPT-Account-ID": accountId,
		originator: "codex_cli_rs",
		Accept: "application/json",
	});
	return parseUsage(usage);
}

function accountIdFromToken(token: string): string | undefined {
	const payload = token.split(".")[1];
	if (!payload) return undefined;
	try {
		const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
		const parsed: unknown = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
		if (!isRecord(parsed)) return undefined;
		const auth = parsed["https://api.openai.com/auth"];
		if (!isRecord(auth)) return undefined;
		return typeof auth.chatgpt_account_id === "string" && auth.chatgpt_account_id
			? auth.chatgpt_account_id
			: undefined;
	} catch {
		return undefined;
	}
}

function parseUsage(raw: unknown): OpenAIQuota | undefined {
	if (!isRecord(raw)) return undefined;
	const rateLimit = isRecord(raw.rate_limit) ? raw.rate_limit : undefined;
	const windows = [rateLimit?.primary_window, rateLimit?.secondary_window].flatMap((window) => {
		const parsed = parseWindow(window);
		return parsed ? [parsed] : [];
	});
	const creditsRaw = isRecord(raw.credits) ? raw.credits : undefined;
	const credits = creditsRaw?.has_credits === true ? finiteNumber(creditsRaw.balance) : undefined;
	const resetsRaw = isRecord(raw.rate_limit_reset_credits) ? raw.rate_limit_reset_credits : undefined;
	const resets = finiteNumber(resetsRaw?.available_count);
	const plan = typeof raw.plan_type === "string" && raw.plan_type
		? (PLAN_LABELS[raw.plan_type] ?? raw.plan_type)
		: undefined;
	if (!plan && windows.length === 0 && credits === undefined && (resets === undefined || resets <= 0)) {
		return undefined;
	}
	return {
		windows,
		...(plan ? { plan } : {}),
		...(credits !== undefined && credits > 0 ? { credits } : {}),
		...(resets !== undefined && resets > 0 ? { resets } : {}),
	};
}

function parseWindow(raw: unknown): UsageWindow | undefined {
	if (!isRecord(raw)) return undefined;
	const usedPercent = finiteNumber(raw.used_percent);
	const windowSeconds = finiteNumber(raw.limit_window_seconds);
	if (usedPercent === undefined || windowSeconds === undefined || windowSeconds <= 0) return undefined;
	const resetAt = finiteNumber(raw.reset_at);
	return {
		usedPercent: Math.min(100, Math.max(0, usedPercent)),
		reset: resetAt === undefined ? "" : new Date(resetAt * 1_000).toISOString(),
		label: windowLabel(windowSeconds),
	};
}

function windowLabel(seconds: number): string {
	if (seconds >= 6 * 24 * 3_600) return "sem";
	if (seconds >= 4.5 * 3_600) return "5h";
	if (seconds >= 45 * 60) return `${Math.round(seconds / 3_600)}h`;
	return `${Math.max(1, Math.round(seconds / 60))}min`;
}
