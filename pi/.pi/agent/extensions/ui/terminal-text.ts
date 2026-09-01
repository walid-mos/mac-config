const TERMINAL_TOKEN_PATTERN =
	/\u001b\[[0-?]*[ -/]*[@-~]|\u001b\]8;;[^\u0007]*\u0007|\u001b\]8;;\u0007|./gu
const ANSI_SEQUENCE_PATTERN = /^\u001b(\[|\]8;;)/u
const OSC_8_CLOSE = '\u001b]8;;\u0007'
const SGR_RESET = '\u001b[0m'

export function hyperlink(text: string, url: string): string {
	return `\u001b]8;;${url}\u0007${text}${OSC_8_CLOSE}`
}

/** Visible terminal column width, ignoring ANSI and OSC 8 sequences. */
export function terminalLineWidth(line: string): number {
	return tokenize(line).reduce(
		(total, token) =>
			isAnsiSequence(token) ? total : total + terminalCharWidth(token),
		0,
	)
}

/** ANSI-safe truncation that never leaves an OSC 8 hyperlink open. */
export function truncateTerminalLine(
	line: string,
	width: number,
	ellipsis = '',
): string {
	const safeWidth = Number.isFinite(width)
		? Math.max(0, Math.floor(width))
		: 0
	if (terminalLineWidth(line) <= safeWidth) return line

	const marker = terminalLineWidth(ellipsis) <= safeWidth ? ellipsis : ''
	const budget = safeWidth - terminalLineWidth(marker)
	let output = ''
	let used = 0
	let linkOpen = false
	let hasAnsi = false

	for (const token of tokenize(line)) {
		if (isAnsiSequence(token)) {
			hasAnsi = true
			if (token.startsWith('\u001b]8;;')) linkOpen = token !== OSC_8_CLOSE
			output += token
			continue
		}
		const tokenWidth = terminalCharWidth(token)
		if (used + tokenWidth > budget) break
		used += tokenWidth
		output += token
	}

	output += marker
	if (linkOpen) output += OSC_8_CLOSE
	return hasAnsi ? `${output}${SGR_RESET}` : output
}

function tokenize(line: string): string[] {
	return line.match(TERMINAL_TOKEN_PATTERN) ?? []
}

function isAnsiSequence(token: string): boolean {
	return ANSI_SEQUENCE_PATTERN.test(token)
}

function terminalCharWidth(token: string): number {
	const codePoint = token.codePointAt(0) ?? 0
	if (
		(codePoint >= 0x1100 && codePoint <= 0x115f) ||
		(codePoint >= 0x2329 && codePoint <= 0x232a) ||
		(codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
		(codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
		(codePoint >= 0xf900 && codePoint <= 0xfaff) ||
		(codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
		(codePoint >= 0xff00 && codePoint <= 0xff60) ||
		(codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
		(codePoint >= 0x1f300 && codePoint <= 0x1faff)
	) {
		return 2
	}
	return 1
}
