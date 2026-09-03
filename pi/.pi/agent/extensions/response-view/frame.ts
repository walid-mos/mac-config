import {
	ansi256ToRgb,
	foregroundAnsi,
	type RgbColor,
	type TerminalColorMode,
} from '../ui/design-system/terminal-color.ts'

import type { Theme } from '@earendil-works/pi-coding-agent'

export const RESPONSE_RIGHT_MARGIN = 8

export type ResponseTheme = Pick<
	Theme,
	'fg' | 'bold' | 'getFgAnsi' | 'getBgAnsi' | 'getColorMode'
>

export interface ResponseFrameOptions {
	width: number
	theme: ResponseTheme
}

const LABEL = 'RÉPONSE'
const SIGNAL = '◇'
const TRACE_LEAD = '╶'
const TRACE_FADE_END = '┈┈ '

const GRADIENT_WIDTH = 24
const EDGE_FADE_RATIO = 0.34
const EDGE_FADE_MIN_WIDTH = 16
const ANSI_FG_RESET = '\u001B[39m'
const ANSI_PREFIX = '\u001B['

interface TerminalColor {
	rgb: RgbColor
	mode: TerminalColorMode
}

function ruleWidth(width: number): number {
	if (!Number.isFinite(width)) return 1
	return Math.max(1, Math.floor(width) - RESPONSE_RIGHT_MARGIN)
}

function parseTerminalColor(ansi: string): TerminalColor {
	if (!ansi.startsWith(ANSI_PREFIX)) {
		throw new Error(
			'response-view requires an ANSI color from the active theme',
		)
	}
	const payload = ansi.slice(ANSI_PREFIX.length)
	const truecolor = /^(?:38|48);2;(\d+);(\d+);(\d+)m$/u.exec(payload)
	if (truecolor) {
		return {
			rgb: [
				Number(truecolor[1]),
				Number(truecolor[2]),
				Number(truecolor[3]),
			],
			mode: 'truecolor',
		}
	}
	const indexed = /^(?:38|48);5;(\d+)m$/u.exec(payload)
	if (indexed)
		return { rgb: ansi256ToRgb(Number(indexed[1])), mode: '256color' }
	throw new Error(
		'response-view requires an ANSI color from the active theme',
	)
}

function smoothstep(value: number): number {
	return value * value * (3 - 2 * value)
}

function edgeFadeWidth(width: number): number {
	return Math.min(
		width,
		Math.max(EDGE_FADE_MIN_WIDTH, Math.round(width * EDGE_FADE_RATIO)),
	)
}

function traceGlyphs(width: number): string {
	if (width <= TRACE_FADE_END.length) return TRACE_FADE_END.slice(-width)
	const solidWidth = width - TRACE_FADE_END.length
	return TRACE_LEAD + '─'.repeat(Math.max(0, solidWidth - 1)) + TRACE_FADE_END
}

function mixColor(from: RgbColor, to: RgbColor, ratio: number): RgbColor {
	return from.map((channel, channelIndex) =>
		Math.round(channel + (to[channelIndex]! - channel) * ratio),
	) as RgbColor
}

/** Per-column base color before the shared edge fade into the canvas. */
type TraceColorAt = (index: number) => RgbColor

function renderTrace(
	width: number,
	theme: ResponseTheme,
	baseColorAt: TraceColorAt,
): string {
	const glyphs = traceGlyphs(width)
	const canvas = parseTerminalColor(theme.getBgAnsi('userMessageBg'))
	const mode = theme.getColorMode()
	const fadeOutWidth = edgeFadeWidth(width)
	const fadeOutStart = width - fadeOutWidth
	let trace = ''
	for (let index = 0; index < width; index += 1) {
		let rgb = baseColorAt(index)
		if (index >= fadeOutStart) {
			const linear =
				fadeOutWidth === 1
					? 1
					: (index - fadeOutStart) / (fadeOutWidth - 1)
			rgb = mixColor(rgb, canvas.rgb, smoothstep(linear))
		}
		trace += `${foregroundAnsi(rgb, mode)}${glyphs[index]}`
	}
	return `${trace}${ANSI_FG_RESET}`
}

function accentGradientTrace(width: number, theme: ResponseTheme): string {
	const accent = parseTerminalColor(theme.getFgAnsi('accent'))
	const muted = parseTerminalColor(theme.getFgAnsi('muted'))
	const gradientWidth = Math.min(
		GRADIENT_WIDTH,
		Math.max(1, width - edgeFadeWidth(width)),
	)
	return renderTrace(width, theme, index => {
		if (index >= gradientWidth) return muted.rgb
		const linear = gradientWidth === 1 ? 1 : index / (gradientWidth - 1)
		return mixColor(accent.rgb, muted.rgb, smoothstep(linear))
	})
}

/** A quiet label followed by a full-width accent-to-muted trace. */
export function responseTopRule(width: number, theme: ResponseTheme): string {
	const targetWidth = ruleWidth(width)
	const labelWidth = SIGNAL.length + 2 + LABEL.length
	if (targetWidth < labelWidth) return theme.fg('accent', SIGNAL)

	const label = [
		theme.fg('accent', theme.bold(SIGNAL)),
		'  ',
		theme.fg('text', theme.bold(LABEL)),
	].join('')
	const traceWidth = targetWidth - labelWidth
	if (traceWidth <= 2) return `${label}${' '.repeat(traceWidth)}`

	const lineWidth = traceWidth - 2
	return `${label}  ${accentGradientTrace(lineWidth, theme)}`
}

/** A labelless full-width muted trace marking an intermediate assistant output. */
export function intermediateTopRule(
	width: number,
	theme: ResponseTheme,
): string {
	const muted = parseTerminalColor(theme.getFgAnsi('muted'))
	return renderTrace(ruleWidth(width), theme, () => muted.rgb)
}

function frameWithRule(
	markdown: string,
	options: ResponseFrameOptions,
	rule: (width: number, theme: ResponseTheme) => string,
): string {
	if (!markdown.trim().length) return markdown
	const top = rule(options.width, options.theme)
	return `${top}\n\n${markdown}`
}

/** Display-only decoration; the session and model context keep the original Markdown. */
export function frameAssistantMarkdown(
	markdown: string,
	options: ResponseFrameOptions,
): string {
	return frameWithRule(markdown, options, responseTopRule)
}

/** Quieter decoration for intermediate outputs followed by tool calls. */
export function frameIntermediateMarkdown(
	markdown: string,
	options: ResponseFrameOptions,
): string {
	return frameWithRule(markdown, options, intermediateTopRule)
}
