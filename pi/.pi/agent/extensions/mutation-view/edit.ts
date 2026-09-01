import { diffLines, type DiffLine } from './diff.ts'
import {
	mutationFrameRows,
	type FrameTheme,
	type MutationFrameComponent,
} from './frame.ts'

import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolResult,
} from '../compact-tools/types.ts'

export type EditFrameComponent = MutationFrameComponent

interface TextEdit {
	oldText: string
	newText: string
}

function parseTextEdit(value: unknown): TextEdit | undefined {
	if (typeof value !== 'object' || value === null) return undefined
	const candidate = value as Record<string, unknown>
	if (
		typeof candidate.oldText !== 'string' ||
		typeof candidate.newText !== 'string'
	)
		return undefined
	return { oldText: candidate.oldText, newText: candidate.newText }
}

function parseTextEdits(value: unknown): TextEdit[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined
	const edits: TextEdit[] = []
	for (const valueEntry of value) {
		const edit = parseTextEdit(valueEntry)
		if (!edit) return undefined
		edits.push(edit)
	}
	return edits
}

export function parseEditArgs(
	args: unknown,
): { path: string; edits: TextEdit[] } | undefined {
	if (typeof args !== 'object' || args === null) return undefined
	const candidate = args as Record<string, unknown>
	if (typeof candidate.path !== 'string' || candidate.path.length === 0)
		return undefined
	const edits = parseTextEdits(candidate.edits)
	return edits ? { path: candidate.path, edits } : undefined
}

export function parseNativeEditDiff(diff: string): DiffLine[] {
	return diff
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.filter(line => line.length > 0)
		.map(line => {
			const match = /^([- +])\s*(\d+) (.*)$/.exec(line)
			if (!match) return { kind: 'context', text: line.trim() }
			const kind =
				match[1] === '+'
					? 'added'
					: match[1] === '-'
						? 'removed'
						: 'context'
			return { kind, lineNumber: Number(match[2]), text: match[3] }
		})
}

export function editFrameRows(
	path: string,
	edits: ReadonlyArray<{ oldText: string; newText: string }>,
	diffs: ReadonlyArray<ReadonlyArray<DiffLine>>,
	width: number,
	theme: FrameTheme,
	expanded = false,
): string[] {
	const noun = edits.length === 1 ? 'édition' : 'éditions'
	const removed = diffs.flat().filter(line => line.kind === 'removed').length
	const added = diffs.flat().filter(line => line.kind === 'added').length
	return mutationFrameRows(
		{
			tool: 'edit',
			path,
			stats: [
				{ text: `−${removed}`, role: 'toolDiffRemoved' },
				{ text: `+${added}`, role: 'toolDiffAdded', separator: ' ' },
				{ text: `${edits.length} ${noun}`, role: 'muted' },
			],
			nativeLabel: 'diff complet',
			highlightChanges: true,
			expanded,
			diffs,
		},
		width,
		theme,
	)
}

export function createEditFrameComponent(
	path: string,
	edits: ReadonlyArray<{ oldText: string; newText: string }>,
	theme: FrameTheme,
	resolvedDiffs?: ReadonlyArray<ReadonlyArray<DiffLine>>,
	expanded = false,
): EditFrameComponent {
	let diffs: ReadonlyArray<ReadonlyArray<DiffLine>> | undefined =
		resolvedDiffs
	const compute = (): ReadonlyArray<ReadonlyArray<DiffLine>> =>
		(diffs ??= edits.map(edit => diffLines(edit.oldText, edit.newText)))
	return {
		render(width: number): string[] {
			return editFrameRows(path, edits, compute(), width, theme, expanded)
		},
		invalidate(): void {},
	}
}

export function editCollapsedBody(
	result: CompactToolResult,
	options: { expanded?: boolean; isPartial?: boolean },
	theme: CompactTheme,
	context: CompactRenderContext,
): CompactComponent {
	const parsed = parseEditArgs(context.args)
	const details = result.details as { diff?: unknown } | undefined
	if (!parsed || result.isError || typeof details?.diff !== 'string') {
		return { render: () => [], invalidate: () => {} }
	}
	return createEditFrameComponent(
		parsed.path,
		parsed.edits,
		theme,
		[parseNativeEditDiff(details.diff)],
		options.expanded === true,
	)
}
