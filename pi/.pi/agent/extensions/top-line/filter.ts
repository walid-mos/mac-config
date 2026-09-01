const SGR = /\x1b\[[0-9;]*m/g
const BOX_DRAWING_HORIZONTAL = '─'

/**
 * True when a rendered editor line is a bare horizontal rule (only `─`,
 * modulo SGR color codes). Scroll indicators (`↑ 3 ───`), autocomplete
 * entries and prompt text all carry other characters and are never rules.
 */
export function isHorizontalRule(line: string): boolean {
	const plain = line.replace(SGR, '')
	if (plain.length === 0) return false
	for (const char of plain) {
		if (char !== BOX_DRAWING_HORIZONTAL) return false
	}
	return true
}

/**
 * Keep the top border line of the editor, drop the bottom one.
 *
 * The default editor renders [top rule, …text…, bottom rule, …autocomplete…].
 * Line 0 is always kept (it may be the `↑ N` scroll indicator, never a rule
 * when scrolled); every other pure-rule line is removed so the prompt shows
 * only its top line.
 */
export function keepTopRuleOnly(lines: string[]): string[] {
	return lines.filter((line, index) => index === 0 || !isHorizontalRule(line))
}
