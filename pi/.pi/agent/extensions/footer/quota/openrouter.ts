import type { OpenRouterQuota } from "../types.ts";
import { isRecord } from "../value.ts";
import { fetchJson, readToken } from "./shared.ts";

export async function pollOpenRouterQuota(): Promise<OpenRouterQuota | undefined> {
	const token = readToken("openrouter");
	if (!token) return undefined;

	const [creditsResponse, keyResponse] = await Promise.all([
		fetchJson("https://openrouter.ai/api/v1/credits", token),
		fetchJson("https://openrouter.ai/api/v1/auth/key", token),
	]);
	const creditsEnvelope = isRecord(creditsResponse) ? creditsResponse : undefined;
	const keyEnvelope = isRecord(keyResponse) ? keyResponse : undefined;
	const credits = isRecord(creditsEnvelope?.data) ? creditsEnvelope.data : undefined;
	const key = isRecord(keyEnvelope?.data) ? keyEnvelope.data : undefined;
	if (!credits || typeof credits.total_credits !== "number") return undefined;

	const quota: OpenRouterQuota = {
		balance: Math.max(
			0,
			credits.total_credits - (typeof credits.total_usage === "number" ? credits.total_usage : 0),
		),
	};
	if (typeof key?.limit === "number" && typeof key.limit_remaining === "number") {
		quota.weekly = { remaining: key.limit_remaining, limit: key.limit };
	}
	return quota;
}
