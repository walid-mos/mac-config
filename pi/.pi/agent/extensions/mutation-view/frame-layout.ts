import { terminalLineWidth } from '../ui/terminal-text.ts'

import type {
	LogicalEntry,
	MutationFrameSpec,
	RenderEntry,
} from './frame-types.ts'

const ROW_CHROME_WIDTH = 2
const NUMBER_GUTTER_CHROME_WIDTH = 5

interface CodeRowState {
	row: string
	usedWidth: number
}

export function frameWidth(
	availableWidth: number,
	lineNumberWidth: number,
): number {
	const available = normalizedWidth(availableWidth)
	const rightMargin = lineNumberWidth + NUMBER_GUTTER_CHROME_WIDTH
	return Math.max(1, available - rightMargin)
}

export function frameContent(spec: MutationFrameSpec): LogicalEntry[] {
	const content: LogicalEntry[] = []
	spec.diffs.forEach((diff, index) => {
		if (index > 0)
			content.push({
				separator: { index: index + 1, total: spec.diffs.length },
			})
		for (const line of diff) content.push({ line })
	})
	return content
}

export function frameLineNumberWidth(
	content: ReadonlyArray<LogicalEntry>,
): number {
	return Math.max(
		0,
		...content.map(entry =>
			entry.line?.lineNumber === undefined
				? 0
				: String(entry.line.lineNumber).length,
		),
	)
}

export function expandFrameContent(
	content: ReadonlyArray<LogicalEntry>,
	width: number,
	lineNumberWidth: number,
): RenderEntry[] {
	const gutterWidth =
		lineNumberWidth > 0 ? lineNumberWidth + NUMBER_GUTTER_CHROME_WIDTH : 2
	const codeWidth = Math.max(1, width - ROW_CHROME_WIDTH - gutterWidth)
	const rows: RenderEntry[] = []
	for (const entry of content) {
		if (entry.separator) {
			rows.push({ separator: entry.separator })
			continue
		}
		if (!entry.line) continue
		wrapCodeLine(entry.line.text, codeWidth).forEach((text, index) => {
			rows.push({
				line: { value: entry.line!, text, continuation: index > 0 },
			})
		})
	}
	return rows
}

function normalizedWidth(width: number): number {
	if (!Number.isFinite(width)) return 1
	return Math.max(1, Math.floor(width))
}

function appendCodeCharacter(
	rows: string[],
	state: CodeRowState,
	character: string,
	width: number,
): CodeRowState {
	const characterWidth = terminalLineWidth(character)
	if (characterWidth > width) {
		if (state.row) rows.push(state.row)
		rows.push('…')
		return { row: '', usedWidth: 0 }
	}
	if (state.usedWidth > 0 && state.usedWidth + characterWidth > width) {
		rows.push(state.row)
		return { row: character, usedWidth: characterWidth }
	}
	return {
		row: state.row + character,
		usedWidth: state.usedWidth + characterWidth,
	}
}

function wrapCodeLine(text: string, width: number): string[] {
	if (width <= 0 || !text.length) return ['']
	const rows: string[] = []
	let state: CodeRowState = { row: '', usedWidth: 0 }
	for (const character of text)
		state = appendCodeCharacter(rows, state, character, width)
	rows.push(state.row)
	return rows
}
