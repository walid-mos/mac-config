import { pollKimiQuota } from './quota/kimi.ts'
import { pollOpenAIQuota } from './quota/openai.ts'
import { pollOpenRouterQuota } from './quota/openrouter.ts'
import { pollXaiQuota } from './quota/xai.ts'

import type { QuotaCache } from './types.ts'

/** Poll independent providers concurrently; unavailable providers remain absent. */
export async function pollQuotas(): Promise<QuotaCache> {
	const [kimi, openrouter, xai, openai] = await Promise.all([
		pollKimiQuota(),
		pollOpenRouterQuota(),
		pollXaiQuota(),
		pollOpenAIQuota(),
	])
	return {
		...(kimi ? { kimi } : {}),
		...(openrouter ? { openrouter } : {}),
		...(xai ? { xai } : {}),
		...(openai ? { openai } : {}),
	}
}
