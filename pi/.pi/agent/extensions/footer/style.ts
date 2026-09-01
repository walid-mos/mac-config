import { PI_PALETTE } from '../ui/design-system/palette.ts'
import { foregroundHex } from '../ui/design-system/terminal-color.ts'

export const FOOTER_GLYPHS = {
	model: '\u{f06a9}',
	folder: '\u{f07b}',
	branch: '\u{e0a0}',
	thinking: '\u{f0eb}',
	context: '\u{f200}',
	quota: '\u{f0109}',
	reset: '↺',
	barFull: '▰',
	barEmpty: '▱',
	separator: '│',
} as const

export const FOOTER_LAYOUT = {
	contextBarWidth: 8,
	gitBarWidth: 6,
} as const

export const THINKING_COLORS: Readonly<Record<string, string>> = {
	off: PI_PALETTE.overlay1,
	minimal: PI_PALETTE.subtext0,
	low: PI_PALETTE.sapphire,
	medium: PI_PALETTE.blue,
	high: PI_PALETTE.mauve,
	xhigh: PI_PALETTE.peach,
	max: PI_PALETTE.red,
}

export function thinSeparator(): string {
	return foregroundHex(PI_PALETTE.surface1, FOOTER_GLYPHS.separator)
}
