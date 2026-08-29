import { parseJson } from './json-value.ts'

import type { JsonValue } from './json-value.ts'

const REPAIR = {
	MAX_CANDIDATES: 12,
} as const

const JSON_VALUE_PREFIXES = new Set(['"', '-', '{', '[', 't', 'f', 'n'])

type StringScan = {
	isInsideString: boolean
	isEscaped: boolean
}

type JsonStructureScan = {
	balancedEnd: number
	expectedClosings: string[]
	stringScan: StringScan
	structuralOffsets: number[]
	hasMismatchedClosing: boolean
}

function advanceStringScan(character: string, scan: StringScan): StringScan {
	if (!scan.isInsideString) {
		if (character === '"') return { isInsideString: true, isEscaped: false }
		return scan
	}
	if (scan.isEscaped) return { isInsideString: true, isEscaped: false }
	if (character === '\\') return { isInsideString: true, isEscaped: true }
	if (character === '"') return { isInsideString: false, isEscaped: false }
	return scan
}

function closingCharacter(character: string): string | undefined {
	if (character === '{') return '}'
	if (character === '[') return ']'
	return undefined
}

function isClosingCharacter(character: string): boolean {
	return character === '}' || character === ']'
}

type ClosingState = 'balanced' | 'mismatch' | 'open' | 'other'

class JsonStructureScanner {
	private expectedClosings: string[]
	private stringScan: StringScan = {
		isInsideString: false,
		isEscaped: false,
	}
	private structuralOffsets: number[]

	constructor(firstClose: string, openIndex: number) {
		this.expectedClosings = [firstClose]
		this.structuralOffsets = [openIndex]
	}

	private consumeString(character: string): boolean {
		if (!this.stringScan.isInsideString && character !== '"') return false
		this.stringScan = advanceStringScan(character, this.stringScan)
		return true
	}

	private consumeOpening(character: string, cursor: number): boolean {
		const nestedClose = closingCharacter(character)
		if (!nestedClose) return false
		this.expectedClosings.push(nestedClose)
		this.structuralOffsets.push(cursor)
		return true
	}

	private consumeClosing(character: string): ClosingState {
		if (!isClosingCharacter(character)) return 'other'
		if (this.expectedClosings.at(-1) !== character) return 'mismatch'
		this.expectedClosings.pop()
		if (!this.expectedClosings.length) return 'balanced'
		return 'open'
	}

	private snapshot(
		balancedEnd: number,
		closingState: ClosingState,
	): JsonStructureScan {
		return {
			balancedEnd,
			expectedClosings: this.expectedClosings,
			stringScan: this.stringScan,
			structuralOffsets: this.structuralOffsets,
			hasMismatchedClosing: closingState === 'mismatch',
		}
	}

	scan(text: string, openIndex: number): JsonStructureScan {
		for (let cursor = openIndex + 1; cursor < text.length; cursor += 1) {
			const character = text[cursor] ?? ''
			if (this.consumeString(character)) continue
			if (this.consumeOpening(character, cursor)) continue
			if (character === ',') this.structuralOffsets.push(cursor)
			const closingState = this.consumeClosing(character)
			if (closingState === 'mismatch')
				return this.snapshot(-1, closingState)
			if (closingState === 'balanced')
				return this.snapshot(cursor + 1, closingState)
		}
		return this.snapshot(-1, 'open')
	}
}

function invalidStructure(): JsonStructureScan {
	return {
		balancedEnd: -1,
		expectedClosings: [],
		stringScan: { isInsideString: false, isEscaped: false },
		structuralOffsets: [],
		hasMismatchedClosing: true,
	}
}

function scanJsonStructure(text: string, openIndex: number): JsonStructureScan {
	const firstClose = closingCharacter(text[openIndex] ?? '')
	if (!firstClose) return invalidStructure()
	return new JsonStructureScanner(firstClose, openIndex).scan(text, openIndex)
}

export function findBalancedEnd(text: string, openIndex: number): number {
	return scanJsonStructure(text, openIndex).balancedEnd
}

function repairCandidates(content: string): string[] {
	const candidates = new Set([content])
	const offsets = scanJsonStructure(content, 0).structuralOffsets
	for (const offset of offsets.toReversed()) {
		if (candidates.size >= REPAIR.MAX_CANDIDATES) break
		candidates.add(content.slice(0, offset))
		if (content[offset] !== ',')
			candidates.add(content.slice(0, offset + 1))
	}
	return [...candidates].slice(0, REPAIR.MAX_CANDIDATES)
}

function closeIncompleteCandidate(candidate: string): string | undefined {
	const structure = scanJsonStructure(candidate, 0)
	if (structure.hasMismatchedClosing) return undefined
	let suffix = ''
	if (structure.stringScan.isEscaped) suffix += '\\'
	if (structure.stringScan.isInsideString) suffix += '"'
	return candidate + suffix + structure.expectedClosings.toReversed().join('')
}

function isEmptyJsonContainer(parsed: JsonValue): boolean {
	if (Array.isArray(parsed)) return !parsed.length
	if (parsed === null || typeof parsed !== 'object') return true
	return !Object.keys(parsed).length
}

function isDigit(character: string): boolean {
	return character >= '0' && character <= '9'
}

function isPlausibleDiscardedTail(
	content: string,
	candidateLength: number,
): boolean {
	let discarded = content.slice(candidateLength).trimStart()
	if (discarded.startsWith(',')) discarded = discarded.slice(1).trimStart()
	if (!discarded.length) return true
	const firstCharacter = discarded[0] ?? ''
	return JSON_VALUE_PREFIXES.has(firstCharacter) || isDigit(firstCharacter)
}

export function parsesAsIncompleteJson(content: string): boolean {
	for (const candidate of repairCandidates(content)) {
		if (!candidate.length) continue
		const repaired = closeIncompleteCandidate(candidate)
		if (!repaired) continue
		const parsedJson = parseJson(repaired)
		if (!parsedJson.isValid || isEmptyJsonContainer(parsedJson.parsed))
			continue
		if (isPlausibleDiscardedTail(content, candidate.length)) return true
	}
	return false
}
