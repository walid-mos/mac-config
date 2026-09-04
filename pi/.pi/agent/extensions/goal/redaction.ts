const REDACTED = '[REDACTED]'
export const SECRET_KIND_PATTERN =
	'api[_-]?key|secret[_-]?access[_-]?key|private[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|secret|client[_-]?secret'
const SECRET_NAME = `(?:(?:[a-z0-9]+[_-])*(?:${SECRET_KIND_PATTERN}))`

const JSON_ASSIGNMENT = new RegExp(
	`(["']${SECRET_NAME}["']\\s*:\\s*)(["'])(?:\\\\.|(?!\\2)[\\s\\S])*(?:\\2|$)`,
	'giu',
)
const SECRET_PREFIX = `\\b${SECRET_NAME}\\b(?:\\s*(?:=|:)\\s*|\\s+)`
const SHELL_QUOTED_FRAGMENT = `(?:\\$?'(?:\\\\.|[^'\\\\])*'|\\$?"(?:\\\\.|[^"\\\\])*")`
const SHELL_WORD = `(?:${SHELL_QUOTED_FRAGMENT}|\\\\.|[^\\s"'\\\\,;|&()<>]+)+`
const SHELL_SECRET_ASSIGNMENT = new RegExp(
	`(${SECRET_PREFIX})${SHELL_WORD}`,
	'giu',
)
const UNTERMINATED_SECRET_ASSIGNMENT = new RegExp(
	`(${SECRET_PREFIX})(?:\\$?)(["'])(?:\\\\.|(?!\\2)[\\s\\S])*$`,
	'giu',
)
const BEARER = /(\bBearer\s+)[A-Za-z0-9._~+/=-]+/giu
const BASIC_AUTHORIZATION = /(\bAuthorization\s*:\s*Basic\s+)[A-Za-z0-9+/=]+/giu
const URL_PASSWORD = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)([^\s@/]+)(@)/giu
const KNOWN_TOKEN =
	/\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{12,}|xox[a-z]-[A-Za-z0-9-]{10,})\b/gu
const PRIVATE_KEY_BLOCK =
	/-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/gu

/** Redacts only high-confidence credential forms to avoid damaging normal logs. */
export function redactSecrets(text: string): string {
	return text
		.replace(BEARER, `$1${REDACTED}`)
		.replace(BASIC_AUTHORIZATION, `$1${REDACTED}`)
		.replace(URL_PASSWORD, `$1${REDACTED}$3`)
		.replace(JSON_ASSIGNMENT, `$1$2${REDACTED}$2`)
		.replace(SHELL_SECRET_ASSIGNMENT, `$1${REDACTED}`)
		.replace(UNTERMINATED_SECRET_ASSIGNMENT, `$1${REDACTED}`)
		.replace(KNOWN_TOKEN, REDACTED)
		.replace(PRIVATE_KEY_BLOCK, REDACTED)
}
