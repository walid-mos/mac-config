/**
 * Pure extraction of the one-line subject and result summary per tool.
 * No IO, no theme, no pi imports.
 */

import type { ToolViewName } from './registry.ts'
import type { CompactToolResult } from './types.ts'

export { COMPACT_TOOLS } from './registry.ts'
export type CompactToolName = Extract<
	ToolViewName,
	'read' | 'grep' | 'find' | 'ls'
>

/** Collapse any string to a single displayable line. */
export function toSingleLine(text: string): string {
	return text.replace(/[\r\n]+/g, ' ').trim()
}

/** Final path segment, POSIX only (the extension targets macOS/Linux). */
export function baseName(path: string): string {
	const parts = path.split('/')
	return parts[parts.length - 1] || path
}

/** Short identity of the call, shown between the tool label and the summary. */
export function subjectFor(
	tool: string,
	args: Record<string, unknown> | undefined,
): string {
	const a = args ?? {}
	switch (tool) {
		case 'bash':
			return toSingleLine(String(a.command ?? ''))
		case 'read': {
			const path = String(a.path ?? '')
			const offset =
				typeof a.offset === 'number' && a.offset > 1
					? ` dès la ligne ${a.offset}`
					: ''
			return `${baseName(path)}${offset}`
		}
		case 'grep':
			return `"${toSingleLine(String(a.pattern ?? ''))}"`
		case 'find':
			return `"${toSingleLine(String(a.pattern ?? ''))}"`
		case 'ls':
			return baseName(String(a.path ?? '.'))
		case 'edit':
		case 'write':
			return baseName(String(a.path ?? ''))
		case 'background': {
			const action = toSingleLine(String(a.action ?? ''))
			const target = toSingleLine(String(a.job ?? a.source ?? ''))
			return target ? `${action} · ${target}` : action
		}
		default:
			return ''
	}
}

/** Number of lines in a raw text payload (0 for empty). */
export function countTextLines(text: string): number {
	if (text.length === 0) return 0
	return text.split('\n').length
}

function firstText(result: CompactToolResult): string {
	const block = result.content.find(
		entry => entry.type === 'text' && typeof entry.text === 'string',
	)
	return block && typeof block.text === 'string' ? block.text : ''
}

function limitSummary(
	details: unknown,
	key: string,
	unit: string,
): string | undefined {
	if (typeof details !== 'object' || details === null) return undefined
	const value = (details as Record<string, unknown>)[key]
	return typeof value === 'number' ? `${value}+ ${unit}` : undefined
}

/** "tronqué" marker when the built-in truncation object reports a cut. */
function truncationInfo(details: unknown): {
	totalLines?: number
	marker: string
} {
	if (typeof details !== 'object' || details === null) return { marker: '' }
	const truncation = (details as Record<string, unknown>).truncation
	if (typeof truncation !== 'object' || truncation === null)
		return { marker: '' }
	const t = truncation as Record<string, unknown>
	return {
		totalLines: typeof t.totalLines === 'number' ? t.totalLines : undefined,
		marker: t.truncated === true ? ' · tronqué' : '',
	}
}

/** Short state of the result, appended after the subject. Empty when obvious. */
export function summarizeResult(
	tool: string,
	args: Record<string, unknown> | undefined,
	result: CompactToolResult,
): string {
	const details = result.details
	switch (tool) {
		case 'bash': {
			if (!result.isError) return ''
			const text = firstText(result)
			const exit = text.match(/Command exited with code (\d+)/)
			if (exit) return `exit ${exit[1]}`
			const timeout = text.match(/timed out after:?\s*(\d+)\s*seconds/)
			if (timeout) return `timeout ${timeout[1]}s`
			return 'erreur'
		}
		case 'read': {
			const truncation = truncationInfo(details)
			const lines =
				truncation.totalLines ?? countTextLines(firstText(result))
			return `${lines} lignes${truncation.marker}`
		}
		case 'grep':
			return (
				limitSummary(details, 'matchLimitReached', 'correspondances') ??
				`${countTextLines(firstText(result))} lignes`
			)
		case 'find':
			return (
				limitSummary(details, 'resultLimitReached', 'résultats') ??
				`${countTextLines(firstText(result))} lignes`
			)
		case 'ls':
			return (
				limitSummary(details, 'entryLimitReached', 'entrées') ??
				`${countTextLines(firstText(result))} lignes`
			)
		case 'edit':
		case 'write':
			// Success is carried entirely by the mutation frame; errors fit a line.
			return result.isError ? firstLine(firstText(result)) : ''
		case 'background':
			return firstLine(firstText(result))
		default:
			return ''
	}
}

/** First line of a payload, as a stable one-line summary. */
function firstLine(text: string): string {
	const index = text.indexOf('\n')
	return (index === -1 ? text : text.slice(0, index)).trim()
}
