import { PI_PALETTE as LATTE } from '../ui/design-system/palette.ts'
import {
	foregroundHex as fgHex,
	hexToRgb as rgb,
	rgbToHex,
} from '../ui/design-system/terminal-color.ts'

import { FOOTER_GLYPHS as ICONS, thinSeparator as thinSep } from './style.ts'

import type { OpenAIQuota, QuotaCache } from './types.ts'

/**
 * Smooth RGB gradient by remaining ratio.
 * Anchors: 100% green → 60% yellow → 40% peach → 20% red (held below).
 */
const QUOTA_STOPS: [number, string][] = [
	[1.0, LATTE.green],
	[0.6, LATTE.yellow],
	[0.4, LATTE.peach],
	[0.2, LATTE.red],
]

function lerpChannel(a: number, b: number, t: number): number {
	return Math.round(a + (b - a) * t)
}

function dim(text: string): string {
	return fgHex(LATTE.subtext0, text)
}

function quotaColor(remaining: number, limit: number): string {
	if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0)
		return LATTE.subtext0
	const r = Math.max(0, Math.min(1, remaining / limit))

	// Find bracketing stops (stops are sorted high → low)
	let upper = QUOTA_STOPS[0]!
	let lower = QUOTA_STOPS[QUOTA_STOPS.length - 1]!
	for (let i = 0; i < QUOTA_STOPS.length - 1; i++) {
		if (r <= QUOTA_STOPS[i]![0] && r >= QUOTA_STOPS[i + 1]![0]) {
			upper = QUOTA_STOPS[i]!
			lower = QUOTA_STOPS[i + 1]!
			break
		}
	}
	if (r > upper[0]) return upper[1]
	if (r < lower[0]) return lower[1]

	const span = upper[0] - lower[0]
	const t = span === 0 ? 0 : (r - lower[0]) / span
	const [ar, ag, ab] = rgb(upper[1])
	const [br, bg, bb] = rgb(lower[1])
	return rgbToHex([
		lerpChannel(br, ar, t),
		lerpChannel(bg, ag, t),
		lerpChannel(bb, ab, t),
	])
}

/** Color for credit balance (no limit to compare against): thresholds in $. */
function balanceColor(balance: number): string {
	if (balance >= 10) return LATTE.green
	if (balance >= 5) return LATTE.yellow
	if (balance >= 2) return LATTE.peach
	return LATTE.red
}

/** Circle fraction dial by remaining ratio (visually distinct from context bar). */
function quotaDial(ratio: number): string {
	if (ratio > 0.87) return '●'
	if (ratio > 0.62) return '◕'
	if (ratio > 0.37) return '◑'
	if (ratio > 0.12) return '◔'
	return '○'
}

/** Dial + colored percentage of remaining quota. */
function quotaGauge(remaining: number, limit: number): string {
	if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) {
		return fgHex(LATTE.subtext0, '—')
	}
	// At hard zero remaining, still show 0% (not NaN / broken ANSI).
	const ratio = Math.max(0, Math.min(1, remaining / limit))
	const pct = Math.round(ratio * 100)
	const color = quotaColor(remaining, limit)
	return `${fgHex(color, quotaDial(ratio))} ${fgHex(color, `${pct}%`)}`
}

/** Reset time: HH:MM if <24h away, else short date. */
function fmtReset(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return '?'
	const diffH = (d.getTime() - Date.now()) / 3_600_000
	if (diffH < 24) {
		return d.toLocaleTimeString('fr-FR', {
			hour: '2-digit',
			minute: '2-digit',
		})
	}
	return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

function openaiQuotaPart(quota: OpenAIQuota, compact = false): string {
	const head = quota.plan
		? `${dim('openai')} ${fgHex(LATTE.mauve, quota.plan)}`
		: dim('openai')
	const resets = compact
		? []
		: quota.windows.map(window => window.reset).filter(Boolean)
	const extras = quota.windows.map(
		window =>
			`${dim(window.label)} ${quotaGauge(100 - window.usedPercent, 100)}`,
	)
	if (resets.length > 0) {
		extras.push(
			dim(
				`${ICONS.reset} ${resets.map(r => fmtReset(r)).join(' \u00b7 ')}`,
			),
		)
	}
	if (quota.credits !== undefined) {
		const col = balanceColor(quota.credits)
		extras.push(
			`${fgHex(col, '◉')} ${fgHex(col, `$${quota.credits.toFixed(2)}`)} ${dim('crédits')}`,
		)
	}
	if (quota.resets !== undefined) {
		extras.push(dim(`${quota.resets} reset${quota.resets > 1 ? 's' : ''}`))
	}
	if (extras.length === 0) return `${head} ${fgHex(LATTE.subtext0, '—')}`
	return `${head} ${extras.join(` ${thinSep()} `)}`
}

export function providerQuotaParts(
	quotas: QuotaCache,
	provider: string | undefined,
	compact = false,
): string[] {
	const p = (provider ?? '').toLowerCase()
	const showXai = p.includes('xai')
	const showKimi = p.includes('kimi')
	const showOr = p.includes('openrouter')
	const showOpenai = p.includes('openai')
	const showAll = !showXai && !showKimi && !showOr && !showOpenai

	const parts: string[] = []

	if (quotas.kimi && (showKimi || showAll)) {
		const { fiveHour, weekly } = quotas.kimi
		const resets = [fiveHour.reset, weekly.reset].filter(r => !compact && r)
		let part = `${dim('kimi')} ${dim('5h')} ${quotaGauge(fiveHour.remaining, fiveHour.limit)}`
		if (Number.isFinite(weekly.limit) && weekly.limit > 0) {
			part += ` ${thinSep()} ${dim('sem')} ${quotaGauge(weekly.remaining, weekly.limit)}`
		}
		if (resets.length > 0) {
			part += ` ${thinSep()} ${dim(`${ICONS.reset} ${resets.map(r => fmtReset(r)).join(' \u00b7 ')}`)}`
		}
		parts.push(part)
	}

	if (quotas.openrouter && (showOr || showAll)) {
		const orq = quotas.openrouter
		const col = balanceColor(orq.balance)
		let part = `${dim('openrouter')} ${fgHex(col, '\u25c9')} ${fgHex(col, `$${orq.balance.toFixed(2)}`)}`
		if (orq.weekly) {
			part += ` ${thinSep()} ${dim('hebdo')} ${quotaGauge(orq.weekly.remaining, orq.weekly.limit)}`
			if (!compact && orq.weekly.reset) {
				part += ` ${thinSep()} ${dim(`${ICONS.reset} ${fmtReset(orq.weekly.reset)}`)}`
			}
		}
		parts.push(part)
	}

	if (quotas.openai && (showOpenai || showAll)) {
		parts.push(openaiQuotaPart(quotas.openai, compact))
	}

	if (quotas.xai && (showXai || showAll)) {
		const x = quotas.xai
		const bits: string[] = []
		if (x.tier) bits.push(fgHex(LATTE.mauve, x.tier))
		const xresets: string[] = []
		if (x.monthly && x.monthly.limit > 0 && x.pool?.label !== 'mois') {
			const remaining = x.monthly.limit - x.monthly.used
			bits.push(
				`${dim('mois')} ${quotaGauge(remaining, x.monthly.limit)}`,
			)
			if (x.monthly.reset) xresets.push(x.monthly.reset)
		}
		if (x.pool && Number.isFinite(x.pool.usedPercent)) {
			const remaining = 100 - x.pool.usedPercent
			bits.push(`${dim(x.pool.label)} ${quotaGauge(remaining, 100)}`)
			if (x.pool.reset) xresets.push(x.pool.reset)
		}
		if (!compact && xresets.length > 0) {
			bits.push(
				dim(
					`${ICONS.reset} ${xresets.map(r => fmtReset(r)).join(' \u00b7 ')}`,
				),
			)
		}
		if (x.prepaidBalance && x.prepaidBalance > 0) {
			const col = balanceColor(x.prepaidBalance)
			bits.push(
				`${fgHex(col, '\u25c9')} ${fgHex(col, `$${x.prepaidBalance.toFixed(2)}`)}`,
			)
		}
		parts.push(
			bits.length > 0
				? `${dim('xai')} ${bits.join(` ${thinSep()} `)}`
				: `${dim('xai')} ${dim('\u2014')}`,
		)
	}

	return parts
}

export function quotaContent(parts: string[]): string {
	if (parts.length === 0) return ''
	return `${fgHex(LATTE.subtext0, ICONS.quota)} ${parts.join(` ${thinSep()} `)}`
}
