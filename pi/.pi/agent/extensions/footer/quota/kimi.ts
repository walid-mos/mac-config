import { finiteNumber, isRecord } from '../value.ts'

import { fetchJson, readToken } from './shared.ts'

import type { KimiQuota } from '../types.ts'

export async function pollKimiQuota(): Promise<KimiQuota | undefined> {
	const token = readToken('kimi-coding')
	if (!token) return undefined

	const response = await fetchJson(
		'https://api.kimi.com/coding/v1/usages',
		token,
	)
	const data = isRecord(response) ? response : undefined
	const limits: unknown[] = Array.isArray(data?.limits) ? data.limits : []
	const fiveHourRaw = limits.find((limit: unknown) => {
		const window = (
			limit as { window?: { duration?: number; timeUnit?: string } }
		)?.window
		return (
			window?.duration === 300 && window.timeUnit === 'TIME_UNIT_MINUTE'
		)
	}) as { detail?: unknown } | undefined
	const weeklyLimitRaw = limits.find((limit: unknown) => {
		const window = (
			limit as { window?: { duration?: number; timeUnit?: string } }
		)?.window
		const unit = window?.timeUnit ?? ''
		return (
			unit.includes('WEEK') ||
			(unit === 'TIME_UNIT_DAY' && (window?.duration ?? 0) >= 7) ||
			(window?.duration === 10_080 && unit.includes('MINUTE'))
		)
	}) as { detail?: unknown } | undefined

	const fiveHour = parseWindow(fiveHourRaw?.detail ?? fiveHourRaw)
	if (!fiveHour) return undefined
	const weekly =
		parseWindow(data?.usage) ??
		parseWindow(weeklyLimitRaw?.detail ?? weeklyLimitRaw)
	return {
		fiveHour,
		weekly: weekly ?? { used: 0, limit: 0, remaining: 0, reset: '' },
	}
}

function parseWindow(
	detail: unknown,
	resetFallback?: unknown,
): KimiQuota['fiveHour'] | undefined {
	if (!isRecord(detail)) return undefined
	const used = finiteNumber(detail.used) ?? 0
	const limit = finiteNumber(detail.limit)
	const remaining =
		finiteNumber(detail.remaining) ??
		(limit === undefined ? undefined : Math.max(0, limit - used))
	const resetRaw =
		detail.resetTime ?? detail.reset_time ?? detail.resetAt ?? resetFallback
	if (limit === undefined || remaining === undefined) return undefined
	return {
		used,
		limit,
		remaining,
		reset: typeof resetRaw === 'string' ? resetRaw : '',
	}
}
