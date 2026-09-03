/**
 * House design tokens for the questionnaire UI.
 *
 * Colors come from the shared Catppuccin Latte palette (ui/design-system) —
 * the same tokens json-view and mutation-view render with — so the ask
 * widget, its transcript frames and every other tool output share one visual
 * language. The palette keeps the structural QuestionnairePalette surface,
 * which leaves the render modules theme-agnostic.
 */

import { PI_PALETTE } from '../ui/design-system/palette.ts'
import { blendHex } from '../ui/design-system/terminal-color.ts'
import {
	backgroundHex,
	foregroundHex as fgHex,
} from '../ui/design-system/terminal-color.ts'

import type { QuestionnairePalette } from './questionnaire-render-primitives.ts'

export const Q_COLOR = {
	BORDER: PI_PALETTE.overlay1,
	BASE: PI_PALETTE.base,
	ACCENT: PI_PALETTE.mauve,
	TEXT: PI_PALETTE.text,
	MUTED: PI_PALETTE.subtext0,
	DIM: PI_PALETTE.overlay0,
	SUCCESS: PI_PALETTE.green,
	WARNING: PI_PALETTE.peach,
	DANGER: PI_PALETTE.red,
	// Soft lilac: the cursor band reads as a tint of the accent rather than
	// an opaque gray slab.
	SELECTED_BG: blendHex(PI_PALETTE.mauve, PI_PALETTE.base, 0.85),
} as const

/** Shared glyph vocabulary: markers, badges, status icons.
 * Checkbox glyphs come from the Geometric Shapes block (same family as
 * the radios) because U+2610/U+2611 fall back to a tiny font in several
 * monospace faces: '▣' filled square = checked, '□' hollow = unchecked. */
export const GLYPH = {
	radioOn: '◉',
	radioOff: '○',
	checkOn: '▣',
	checkOff: '□',
	desc: '↳',
	star: '★',
	pen: '✎',
	done: '✔',
	cancel: '✗',
	chat: '⌨',
	enter: '↵',
} as const

const BOLD = '\x1b[1m'
const BOLD_OFF = '\x1b[22m'

export function boldAnsi(text: string): string {
	return `${BOLD}${text}${BOLD_OFF}`
}

const FG: Record<Parameters<QuestionnairePalette['fg']>[0], string> = {
	accent: Q_COLOR.ACCENT,
	muted: Q_COLOR.MUTED,
	dim: Q_COLOR.DIM,
	warning: Q_COLOR.WARNING,
	success: Q_COLOR.SUCCESS,
	text: Q_COLOR.TEXT,
}

/** QuestionnairePalette over the house tokens — no runtime theme dependency. */
export function createQuestionnairePalette(): QuestionnairePalette {
	return {
		fg: (color, text) => fgHex(FG[color], text),
		bg: (_color, text) => backgroundHex(Q_COLOR.SELECTED_BG, text),
		bold: boldAnsi,
	}
}
