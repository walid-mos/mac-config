const REDACTED = '[REDACTED]'
export const SECRET_KIND_PATTERN =
	'api[_-]?key|secret[_-]?access[_-]?key|private[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|secret|client[_-]?secret'
const SECRET_NAME = `(?:(?:[a-z0-9]+[_-])*(?:${SECRET_KIND_PATTERN}))`

const JSON_ASSIGNMENT = new RegExp(
	`(["']${SECRET_NAME}["']\\s*:\\s*)(["'])(?:\\\\.|(?!\\2)[\\s\\S])*(?:\\2|$)`,
	'giu',
)
const JSON_LITERAL_ASSIGNMENT = new RegExp(
	`(["']${SECRET_NAME}["']\\s*:\\s*)(?!["'])[^,\\s}\\]]+`,
	'giu',
)
const SHELL_SECRET_PREFIX = new RegExp(
	`\\b${SECRET_NAME}\\b(?:\\s*(?:=|:)\\s*|\\s+)`,
	'giu',
)
const BEARER = /(\bBearer\s+)[A-Za-z0-9._~+/=-]+/giu
const BASIC_AUTHORIZATION = /(\bAuthorization\s*:\s*Basic\s+)[A-Za-z0-9+/=]+/giu
const URL_PASSWORD = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)([^\s@/]+)(@)/giu
const KNOWN_TOKEN =
	/\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{12,}|xox[a-z]-[A-Za-z0-9-]{10,})\b/gu
const PRIVATE_KEY_BLOCK =
	/-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/gu

const SHELL_NESTING_PAIRS: Readonly<Record<string, string>> = {
	'(': ')',
	'[': ']',
	'{': '}',
}

function isShellDelimiter(character: string): boolean {
	return /[\s;|&<>]/u.test(character)
}

type ShellContext = { closing: string; quote: string }

function nestedClosing(text: string, index: number, quote: string): string {
	const character = text[index] ?? ''
	if (quote !== "'" && character === '$' && text[index + 1] === '(')
		return ')'
	if (quote !== "'" && character === '`') return '`'
	if (quote) return ''
	return SHELL_NESTING_PAIRS[character] ?? ''
}

type ShellScan = { contexts: ShellContext[]; index: number }

function isQuote(character: string): boolean {
	return character === '"' || character === "'"
}

function isWordBoundary(scan: ShellScan, character: string): boolean {
	return scan.contexts.length === 1 && isShellDelimiter(character)
}

function advanceShellCharacter(text: string, scan: ShellScan): boolean {
	const character = text[scan.index] ?? ''
	const active = scan.contexts.at(-1) ?? scan.contexts[0]!
	if (character === '\\') {
		scan.index = Math.min(text.length, scan.index + 2)
		return true
	}
	if (!active.quote && active.closing === character) {
		scan.contexts.pop()
		scan.index += 1
		return true
	}
	const closing = nestedClosing(text, scan.index, active.quote)
	if (closing) {
		scan.contexts.push({ closing, quote: '' })
		scan.index += character === '$' ? 2 : 1
		return true
	}
	if (active.quote) {
		if (character === active.quote) active.quote = ''
		scan.index += 1
		return true
	}
	if (isQuote(character)) {
		active.quote = character
		scan.index += 1
		return true
	}
	if (isWordBoundary(scan, character)) return false
	scan.index += 1
	return true
}

function shellWordEnd(text: string, start: number): number {
	const scan: ShellScan = {
		contexts: [{ closing: '', quote: '' }],
		index: start,
	}
	while (scan.index < text.length && advanceShellCharacter(text, scan)) {
		// The scanner advances one complete shell token at a time.
	}
	return scan.index
}

function redactShellSecrets(text: string): string {
	let redacted = ''
	let cursor = 0
	SHELL_SECRET_PREFIX.lastIndex = 0
	for (
		let match = SHELL_SECRET_PREFIX.exec(text);
		match;
		match = SHELL_SECRET_PREFIX.exec(text)
	) {
		const valueStart = match.index + match[0].length
		const valueEnd = shellWordEnd(text, valueStart)
		if (valueEnd === valueStart) continue
		redacted += `${text.slice(cursor, valueStart)}${REDACTED}`
		cursor = valueEnd
		SHELL_SECRET_PREFIX.lastIndex = valueEnd
	}
	return `${redacted}${text.slice(cursor)}`
}

/** Redacts only high-confidence credential forms to avoid damaging normal logs. */
export function redactSecrets(text: string): string {
	const structured = text
		.replace(BEARER, `$1${REDACTED}`)
		.replace(BASIC_AUTHORIZATION, `$1${REDACTED}`)
		.replace(URL_PASSWORD, `$1${REDACTED}$3`)
		.replace(JSON_ASSIGNMENT, `$1$2${REDACTED}$2`)
		.replace(JSON_LITERAL_ASSIGNMENT, `$1${REDACTED}`)
		.replace(KNOWN_TOKEN, REDACTED)
		.replace(PRIVATE_KEY_BLOCK, REDACTED)
	return redactShellSecrets(structured)
}
