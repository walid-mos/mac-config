const JSON_INDENT_SPACES = 2

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [property: string]: JsonValue }

export type JsonParseOutcome =
	| { isValid: true; parsed: JsonValue }
	| { isValid: false }

function isJsonValue(jsonCandidate: unknown): jsonCandidate is JsonValue {
	if (jsonCandidate === null) return true
	if (typeof jsonCandidate === 'boolean' || typeof jsonCandidate === 'string')
		return true
	if (typeof jsonCandidate === 'number') return Number.isFinite(jsonCandidate)
	if (Array.isArray(jsonCandidate)) return jsonCandidate.every(isJsonValue)
	if (typeof jsonCandidate !== 'object') return false
	return Object.values(jsonCandidate).every(isJsonValue)
}

export function parseJson(source: string): JsonParseOutcome {
	try {
		const parsed: unknown = JSON.parse(source)
		if (isJsonValue(parsed)) return { isValid: true, parsed }
	} catch {
		return { isValid: false }
	}
	return { isValid: false }
}

export function prettyJson(parsed: JsonValue): string {
	return JSON.stringify(parsed, null, JSON_INDENT_SPACES)
}
