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

function updatedQuote(current: string, character: string): string {
	if (current) return character === current ? '' : current
	return character === '"' || character === "'" ? character : ''
}

function updateNesting(nesting: string[], character: string): boolean {
	const closing = SHELL_NESTING_PAIRS[character]
	if (closing) {
		nesting.push(closing)
		return true
	}
	if (character !== nesting.at(-1)) return false
	nesting.pop()
	return true
}

function shellWordEnd(text: string, start: number): number {
	let index = start
	let quote = ''
	const nesting: string[] = []
	while (index < text.length) {
		const character = text[index] ?? ''
		if (character === '\\') {
			index += index + 1 < text.length ? 2 : 1
			continue
		}
		if (quote || character === '"' || character === "'") {
			quote = updatedQuote(quote, character)
			index += 1
			continue
		}
		if (updateNesting(nesting, character)) {
			index += 1
			continue
		}
		if (nesting.length === 0 && isShellDelimiter(character)) break
		index += 1
	}
	return index
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
