import { PI_PALETTE } from '../ui/design-system/palette.ts'
import {
	backgroundAnsi,
	blendHex,
	hexToRgb,
} from '../ui/design-system/terminal-color.ts'

import { railRow } from './frame-chrome.ts'

import type { DiffLine } from './diff.ts'
import type { DiffBackgrounds, FrameTheme, RenderEntry } from './frame-types.ts'

const DIFF_PREFIX = {
	removed: '-',
	added: '+',
	context: ' ',
} as const
const DIFF_BG_OPACITY = 0.15
const DIFF_BG_FADE_OPACITY = [0.1, 0.06, 0.03] as const

interface DiffRowOptions {
	lineNumberWidth: number
	width: number
	theme: FrameTheme
	backgrounds?: DiffBackgrounds
	fadeIndex: number
}

export function diffBackgrounds(
	theme: FrameTheme,
): DiffBackgrounds | undefined {
	if (!theme.getColorMode) return undefined
	return {
		added: PI_PALETTE.green,
		removed: PI_PALETTE.red,
		base: PI_PALETTE.base,
		mode: theme.getColorMode(),
	}
}

export function diffRow(
	entry: NonNullable<RenderEntry['line']>,
	options: DiffRowOptions,
): string {
	const { backgrounds, fadeIndex, lineNumberWidth, theme, width } = options
	const role = diffRole(entry.value, fadeIndex)
	const gutter = diffGutter(entry, lineNumberWidth, role, theme)
	const background = diffBackground(entry.value, backgrounds, fadeIndex)
	return railRow(
		`${gutter}${theme.fg(role, entry.text)}`,
		width,
		theme,
		background && backgroundAnsi(hexToRgb(background.hex), background.mode),
	)
}

function diffRole(line: DiffLine, fadeIndex: number): string {
	if (fadeIndex >= 0) return 'dim'
	if (line.kind === 'removed') return 'toolDiffRemoved'
	if (line.kind === 'added') return 'toolDiffAdded'
	return 'toolDiffContext'
}

function diffGutter(
	entry: NonNullable<RenderEntry['line']>,
	lineNumberWidth: number,
	role: string,
	theme: FrameTheme,
): string {
	const prefix = entry.continuation ? ' ' : DIFF_PREFIX[entry.value.kind]
	if (lineNumberWidth <= 0) return `${theme.fg(role, prefix)} `
	const number =
		entry.continuation || !Number.isInteger(entry.value.lineNumber)
			? ' '.repeat(lineNumberWidth)
			: String(entry.value.lineNumber).padStart(lineNumberWidth, ' ')
	return `${theme.fg(role, prefix)} ${theme.fg('dim', number)}${theme.fg('muted', ' │ ')}`
}

function diffBackground(
	line: DiffLine,
	backgrounds: DiffBackgrounds | undefined,
	fadeIndex: number,
): { hex: string; mode: DiffBackgrounds['mode'] } | undefined {
	if (!backgrounds || line.kind === 'context') return undefined
	const opacity =
		fadeIndex >= 0
			? (DIFF_BG_FADE_OPACITY[fadeIndex] ?? 0)
			: DIFF_BG_OPACITY
	return {
		hex: blendHex(backgrounds.base, backgrounds[line.kind], opacity),
		mode: backgrounds.mode,
	}
}
