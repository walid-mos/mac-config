/**
 * Shared rounded-frame primitives: labelled edges, padded rows, and the
 * cap + fade scaffolding for tall content. json-view (JSON blocks) and
 * mutation-view (file changes) build on them so every block shares the same
 * Catppuccin geometry. Colors are raw hex rendered with truecolor escapes.
 */

import {
	blendHex,
	foregroundHex as fgHex,
} from './design-system/terminal-color.ts'
import { terminalLineWidth, truncateTerminalLine } from './terminal-text.ts'

/** Solid rows shown before the fade + dots row when content exceeds the cap. */
export const FRAME_MAX_LINES = 18

/** Trailing content rows progressively faded inside a capped frame. */
export const FRAME_FADE_ROWS = 3

const FADE = {
	CONTENT_ROWS: 3,
	CONTENT_STEPS: [0.5, 0.72, 0.88],
	DOT_STEPS: [0.55, 0.75, 0.9],
	DOTS_VISIBLE_WIDTH: 5,
	CENTER_DIVISOR: 2,
} as const

const GEOMETRY = {
	ROW_CHROME_WIDTH: 4,
	EDGE_CHROME_WIDTH: 5,
	MIN_WIDTH: 1,
} as const

export interface FramePalette {
	/** Border + chrome color (LATTE overlay1 in both consumers). */
	border: string
	/** Background color the block fades toward. */
	base: string
}

type EdgeOptions = {
	width: number
	left: string
	right: string
	label: string
} & FramePalette

type RowOptions = {
	width: number
	content: string
	visibleContentWidth: number
} & FramePalette

function normalizedWidth(width: number): number {
	if (!Number.isFinite(width)) return GEOMETRY.MIN_WIDTH
	return Math.max(GEOMETRY.MIN_WIDTH, Math.floor(width))
}

/** Visible width left for content between the `│ … │` chrome. */
export function frameContentWidth(width: number): number {
	return Math.max(0, width - GEOMETRY.ROW_CHROME_WIDTH)
}

/** Top/bottom border row with an embedded (possibly styled) label. */
export function frameEdge(options: EdgeOptions): string {
	if (options.width < GEOMETRY.EDGE_CHROME_WIDTH) {
		return fgHex(options.border, '─'.repeat(options.width))
	}
	const labelBudget = options.width - GEOMETRY.EDGE_CHROME_WIDTH
	const label = truncateTerminalLine(options.label, labelBudget, '…')
	const fill =
		options.width - GEOMETRY.EDGE_CHROME_WIDTH - terminalLineWidth(label)
	return `${fgHex(options.border, `${options.left}─ `)}${label} ${fgHex(options.border, `${'─'.repeat(fill)}${options.right}`)}`
}

/** Content row: `│ content …padding │`, already ≤ width. */
export function frameRow(options: RowOptions): string {
	if (options.width < GEOMETRY.ROW_CHROME_WIDTH) {
		return fgHex(options.border, '│'.repeat(options.width))
	}
	const contentWidth = options.width - GEOMETRY.ROW_CHROME_WIDTH
	const padding = Math.max(0, contentWidth - options.visibleContentWidth)
	return `${fgHex(options.border, '│')} ${options.content}${' '.repeat(padding)} ${fgHex(options.border, '│')}`
}

/** Fade ratio of a content row inside a capped frame; 0 = fully solid. */
export function frameRowFadeRatio(
	index: number,
	solidRows: number,
	isCapped: boolean,
): number {
	if (!isCapped || index < solidRows) return 0
	return FADE.CONTENT_STEPS[index - solidRows] ?? 0
}

/** Centered `· · ·` row closing a capped frame, dots fading toward the base. */
export function frameDotsRow(width: number, palette: FramePalette): string {
	const dots = FADE.DOT_STEPS.map(ratio =>
		fgHex(blendHex(palette.border, palette.base, ratio), '·'),
	)
	const contentWidth = Math.max(0, width - GEOMETRY.ROW_CHROME_WIDTH)
	const padding = Math.max(
		0,
		Math.floor(
			(contentWidth - FADE.DOTS_VISIBLE_WIDTH) / FADE.CENTER_DIVISOR,
		),
	)
	const content = truncateTerminalLine(
		`${' '.repeat(padding)}${dots.join(' ')}`,
		contentWidth,
		'',
	)
	return frameRow({
		width,
		content,
		visibleContentWidth: terminalLineWidth(content),
		...palette,
	})
}

export { normalizedWidth as frameWidth }
