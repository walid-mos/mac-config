const TERMINAL_TOKEN_PATTERN =
	/\u001b_G.*?\u001b\\|\u001b\]1337;[^\u0007]*\u0007|\u001b\[[0-?]*[ -/]*[@-~]|\u001b\]8;;[^\u0007]*\u0007|\u001b\]8;;\u0007|\u001b_[^\u0007]*\u0007|./gu
const ANSI_SEQUENCE_PATTERN = /^\u001b(\[|\]|_)/u
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

interface WrapWord {
	text: string
	width: number
	hasAnsi: boolean
	isSpace: boolean
	isBreak: boolean
}

/** ANSI-aware word wrap; each visual line is ≤ `width` visible columns.
 * Words carrying ANSI never split (they keep their sequences intact), so a
 * styled word alone wider than the budget is emitted overflowing — clip it
 * downstream with `truncateTerminalLine`. Plain overlong words hard-break. */
export function wrapTerminalLine(text: string, width: number): string[] {
	const max = Number.isFinite(width) ? Math.max(1, Math.floor(width)) : 1
	const words = collectWrapWords(text)
	const lines: string[] = []
	let line = ''
	let lineWidth = 0
	let hasAnsi = false
	let pendingSpace = ''

	const breakLine = () => {
		lines.push(hasAnsi ? `${line}${SGR_RESET}` : line)
		line = ''
		lineWidth = 0
		hasAnsi = false
		pendingSpace = ''
	}

	for (const word of words) {
		if (word.isBreak) {
			if (line || hasAnsi) breakLine()
			else lines.push('')
			continue
		}
		if (word.isSpace) {
			if (line) pendingSpace = ' '
			continue
		}
		if (lineWidth + pendingSpace.length + word.width <= max) {
			line += pendingSpace + word.text
			lineWidth += pendingSpace.length + word.width
			pendingSpace = ''
			hasAnsi = hasAnsi || word.hasAnsi
			continue
		}
		if (lineWidth > 0) breakLine()
		if (word.width <= max || word.hasAnsi) {
			line = word.text
			lineWidth = word.width
			hasAnsi = word.hasAnsi
			continue
		}
		let chunk = ''
		let chunkWidth = 0
		for (const char of word.text) {
			const charWidth = terminalCharWidth(char)
			if (chunkWidth + charWidth > max) {
				lines.push(chunk)
				chunk = char
				chunkWidth = charWidth
				continue
			}
			chunk += char
			chunkWidth += charWidth
		}
		line = chunk
		lineWidth = chunkWidth
	}
	if (line || hasAnsi || lines.length === 0) breakLine()
	return lines
}

function collectWrapWords(text: string): WrapWord[] {
	const words: WrapWord[] = []
	let word: WrapWord | undefined

	const flush = () => {
		if (word) words.push(word)
		word = undefined
	}

	for (const token of tokenize(text)) {
		if (isAnsiSequence(token)) {
			word = word ?? emptyWrapWord()
			word.text += token
			word.hasAnsi = true
			continue
		}
		if (token === ' ' || token === '\t') {
			flush()
			words.push({
				text: ' ',
				width: 1,
				hasAnsi: false,
				isSpace: true,
				isBreak: false,
			})
			continue
		}
		if (token === '\n') {
			flush()
			words.push({
				text: '\n',
				width: 0,
				hasAnsi: false,
				isSpace: false,
				isBreak: true,
			})
			continue
		}
		word = word ?? emptyWrapWord()
		word.text += token
		word.width += terminalCharWidth(token)
	}
	flush()
	return words
}

function emptyWrapWord(): WrapWord {
	return {
		text: '',
		width: 0,
		hasAnsi: false,
		isSpace: false,
		isBreak: false,
	}
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
