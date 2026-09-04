import { terminalLineWidth, truncateTerminalLine } from '../ui/terminal-text.ts'

import {
	estimatedOutputTokens,
	generationDurationMs,
	hasLiveTokenEstimate,
	type ActivityStripState,
} from './state.ts'

import type { Theme } from '@earendil-works/pi-coding-agent'

const CLOCK_FRAMES = ['◴', '◷', '◶', '◵'] as const
const FRAME_MS = 250
const MIN_TIMELINE_WIDTH = 8
const MAX_TIMELINE_WIDTH = 12

export function renderActivityLine(
	state: ActivityStripState,
	width: number,
	theme: Theme,
): string {
	const left = renderElapsed(state, theme)
	for (const right of tokenVariants(state, theme)) {
		const availableWidth =
			width - terminalLineWidth(left) - terminalLineWidth(right) - 4
		if (availableWidth < MIN_TIMELINE_WIDTH) continue
		const timelineWidth = Math.min(MAX_TIMELINE_WIDTH, availableWidth)
		const breathingRoom = ' '.repeat(availableWidth - timelineWidth)
		return `${left}  ${renderTimeline(state, timelineWidth, theme)}${breathingRoom}  ${right}`
	}
	return truncateTerminalLine(left, width, '…')
}

function renderElapsed(state: ActivityStripState, theme: Theme): string {
	const marker = state.frozen
		? theme.fg('dim', '✓')
		: theme.fg('muted', clockFrame(state.elapsedMs))
	return `  ${marker} ${theme.fg('muted', formatElapsed(state.elapsedMs))}`
}

function renderTimeline(
	state: ActivityStripState,
	width: number,
	theme: Theme,
): string {
	if (state.frozen) return theme.fg('dim', '─'.repeat(width))
	const headWidth = Math.min(3, width)
	const travel = Math.max(1, width - headWidth + 1)
	const head = Math.floor(state.elapsedMs / FRAME_MS) % travel
	const before = theme.fg('dim', '─'.repeat(head))
	const pulse = theme.fg('muted', '━'.repeat(headWidth))
	const after = theme.fg('dim', '─'.repeat(width - head - headWidth))
	return `${before}${pulse}${after}`
}

function tokenVariants(
	state: ActivityStripState,
	theme: Theme,
): readonly string[] {
	const output = estimatedOutputTokens(state)
	if (state.inputTokens + output + state.cacheTokens === 0)
		return [theme.fg('dim', 'tokens en attente')]
	const estimate = hasLiveTokenEstimate(state) ? '~' : ''
	const generationMs = generationDurationMs(state)
	const full = [
		...(state.inputTokens > 0
			? [`${formatTokenCount(state.inputTokens)} input`]
			: []),
		`${estimate}${formatTokenCount(output)} output`,
		...(state.cacheTokens > 0
			? [`${formatTokenCount(state.cacheTokens)} cache`]
			: []),
		`${formatTokenRate(output, generationMs)} tok/s`,
	]
	const compact = [
		...(state.inputTokens > 0
			? [`${formatTokenCount(state.inputTokens)}↓`]
			: []),
		`${estimate}${formatTokenCount(output)}↑`,
		...(state.cacheTokens > 0
			? [`${formatTokenCount(state.cacheTokens)}↻`]
			: []),
		`${formatTokenRate(output, generationMs)}/s`,
	]
	const outputOnly = [
		`${estimate}${formatTokenCount(output)} tokens`,
		`${formatTokenRate(output, generationMs)}/s`,
	]
	return [
		renderTokenParts(full, theme),
		renderTokenParts(compact, theme),
		renderTokenParts(outputOnly, theme),
	]
}

function renderTokenParts(parts: readonly string[], theme: Theme): string {
	return parts
		.map(part => theme.fg('muted', part))
		.join(theme.fg('dim', ' · '))
}

function clockFrame(elapsedMs: number): string {
	return CLOCK_FRAMES[Math.floor(elapsedMs / FRAME_MS) % CLOCK_FRAMES.length]!
}

export function formatElapsed(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatTokenCount(tokens: number): string {
	const safe = Math.max(0, Math.floor(tokens))
	if (safe >= 1_000_000) return `${compactNumber(safe / 1_000_000)}M`
	if (safe >= 1_000) return `${compactNumber(safe / 1_000)}k`
	return String(safe)
}

function formatTokenRate(tokens: number, generationMs: number): string {
	const seconds = Math.max(1, generationMs / 1_000)
	return formatTokenCount(Math.round(tokens / seconds))
}

function compactNumber(value: number): string {
	return value >= 10 ? String(Math.round(value)) : value.toFixed(1)
}
