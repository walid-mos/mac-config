/**
 * Global column geometry for transcript blocks. Every railed or framed block
 * (mutation-view frames, json-view frames, agent delivery, agent tool bodies,
 * background notices) derives its columns from these tokens, so content lines
 * line up across tools and messages instead of each renderer picking its own
 * indentation.
 */
export const ALIGN = {
	/** Column where every block's rail or header glyph sits. */
	RAIL: 0,
	/** Columns from the row start to block content: rail glyph + one space. */
	CONTENT: 2,
	/** Additional columns per nesting level inside a block. */
	NESTED: 2,
} as const

/**
 * Indent string of block content, `levels` nestings below it:
 * `alignIndent()` is the `│ ` content column, `alignIndent(1)` a detail line.
 */
export function alignIndent(levels = 0): string {
	return `${' '.repeat(ALIGN.CONTENT)}${' '.repeat(ALIGN.NESTED).repeat(levels)}`
}
