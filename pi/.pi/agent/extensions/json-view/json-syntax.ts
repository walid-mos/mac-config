import { fgHex } from '../footer/style.ts'

import { JSON_COLOR } from './json-colors.ts'

const STRING_SCAN = {
	ESCAPED_CHARACTER_WIDTH: 2,
} as const

const NUMBER_CHARACTERS = new Set(['-', '+', '.', 'e', 'E'])
const JSON_PUNCTUATION = new Set(['{', '}', '[', ']', ',', ':'])
const JSON_LITERALS = ['true', 'false', 'null']

function isDigit(character: string): boolean {
	return character >= '0' && character <= '9'
}

function stringEnd(line: string, start: number): number {
	let cursor = start + 1
	while (cursor < line.length) {
		const character = line[cursor] ?? ''
		if (character === '\\') {
			cursor += STRING_SCAN.ESCAPED_CHARACTER_WIDTH
			continue
		}
		cursor += 1
		if (character === '"') return cursor
	}
	return line.length
}

function nextNonWhitespace(line: string, start: number): string {
	for (let cursor = start; cursor < line.length; cursor += 1) {
		const character = line[cursor] ?? ''
		if (character.trim()) return character
	}
	return ''
}

function numberEnd(line: string, start: number): number {
	let cursor = start
	while (cursor < line.length) {
		const character = line[cursor] ?? ''
		if (!isDigit(character) && !NUMBER_CHARACTERS.has(character)) break
		cursor += 1
	}
	return cursor
}

function literalEnd(line: string, start: number): number {
	for (const literal of JSON_LITERALS) {
		if (line.startsWith(literal, start)) return start + literal.length
	}
	return start
}

export function highlightJsonLine(line: string): string {
	let highlighted = ''
	let cursor = 0
	while (cursor < line.length) {
		const character = line[cursor] ?? ''
		if (character === '"') {
			const end = stringEnd(line, cursor)
			const color =
				nextNonWhitespace(line, end) === ':'
					? JSON_COLOR.KEY
					: JSON_COLOR.STRING
			highlighted += fgHex(color, line.slice(cursor, end))
			cursor = end
			continue
		}
		if (isDigit(character) || character === '-') {
			const end = numberEnd(line, cursor)
			highlighted += fgHex(JSON_COLOR.NUMBER, line.slice(cursor, end))
			cursor = end
			continue
		}
		const end = literalEnd(line, cursor)
		if (end > cursor) {
			highlighted += fgHex(JSON_COLOR.LITERAL, line.slice(cursor, end))
			cursor = end
			continue
		}
		if (JSON_PUNCTUATION.has(character))
			highlighted += fgHex(JSON_COLOR.PUNCTUATION, character)
		else highlighted += character
		cursor += 1
	}
	return highlighted
}
