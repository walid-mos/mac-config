import { finiteNumber, isRecord, valOf } from '../value.ts'

import { fetchJsonWithHeaders, readToken } from './shared.ts'

import type { XaiQuota } from '../types.ts'

const BASE_URL = 'https://cli-chat-proxy.grok.com/v1'

export async function pollXaiQuota(): Promise<XaiQuota | undefined> {
	const token = readToken('xai')
	if (!token) return undefined
	const headers = {
		Authorization: `Bearer ${token}`,
		'x-xai-token-auth': 'xai-grok-cli',
		Accept: 'application/json',
	}
	const [billingData, creditsData, settingsData] = await Promise.all([
		fetchJsonWithHeaders(`${BASE_URL}/billing`, headers),
		fetchJsonWithHeaders(`${BASE_URL}/billing?format=credits`, headers),
		fetchJsonWithHeaders(`${BASE_URL}/settings`, headers),
	])

	const quota: XaiQuota = {}
	const settings = isRecord(settingsData) ? settingsData : undefined
	if (
		typeof settings?.subscription_tier_display === 'string' &&
		settings.subscription_tier_display
	) {
		quota.tier = settings.subscription_tier_display
	}

	const billing = isRecord(billingData) ? billingData : undefined
	const billingConfig = isRecord(billing?.config) ? billing.config : undefined
	const monthlyLimit = valOf(billingConfig?.monthlyLimit)
	const monthlyUsed = valOf(billingConfig?.used)
	if (monthlyLimit !== undefined && monthlyUsed !== undefined) {
		quota.monthly = {
			used: monthlyUsed,
			limit: monthlyLimit,
			reset:
				typeof billingConfig?.billingPeriodEnd === 'string'
					? billingConfig.billingPeriodEnd
					: '',
		}
	}

	const credits = isRecord(creditsData) ? creditsData : undefined
	const creditsConfig = isRecord(credits?.config) ? credits.config : undefined
	const period = isRecord(creditsConfig?.currentPeriod)
		? creditsConfig.currentPeriod
		: undefined
	const periodType = period?.type
	if (
		periodType === 'USAGE_PERIOD_TYPE_WEEKLY' ||
		periodType === 'USAGE_PERIOD_TYPE_MONTHLY'
	) {
		let usedPercent = finiteNumber(creditsConfig?.creditUsagePercent)
		if (usedPercent === undefined) {
			const cap = valOf(creditsConfig?.onDemandCap)
			const used = valOf(creditsConfig?.onDemandUsed)
			usedPercent =
				cap !== undefined && cap > 0 && used !== undefined
					? (used / cap) * 100
					: 0
		}
		quota.pool = {
			usedPercent: Math.min(100, Math.max(0, usedPercent)),
			reset:
				typeof creditsConfig?.billingPeriodEnd === 'string'
					? creditsConfig.billingPeriodEnd
					: typeof period?.end === 'string'
						? period.end
						: '',
			label:
				periodType === 'USAGE_PERIOD_TYPE_MONTHLY' ? 'mois' : 'hebdo',
		}
		const prepaidBalance = valOf(creditsConfig?.prepaidBalance)
		if (prepaidBalance !== undefined && prepaidBalance > 0)
			quota.prepaidBalance = prepaidBalance
	}

	return quota
}
