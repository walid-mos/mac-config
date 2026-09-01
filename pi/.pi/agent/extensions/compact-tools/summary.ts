/**
 * Pure extraction of the one-line subject and result summary per tool.
 * No IO, no theme, no pi imports.
 */

import type { ToolViewName } from './registry.ts'
import type { CompactToolResult } from './types.ts'

export { COMPACT_TOOLS } from './registry.ts'
export type CompactToolName = Extract<
	ToolViewName,
	'read' | 'grep' | 'find' | 'ls' | 'bash'
>

type ToolArgs = Record<string, unknown>
type SubjectExtractor = (args: ToolArgs) => string
type ResultSummarizer = (result: CompactToolResult) => string

/** Collapse any string to a single displayable line. */
export function toSingleLine(text: string): string {
	return text.replace(/[\r\n]+/g, ' ').trim()
}

/** Final path segment, POSIX only (the extension targets macOS/Linux). */
export function baseName(path: string): string {
	const parts = path.split('/')
	return parts[parts.length - 1] || path
}

function asToolArgs(value: unknown): ToolArgs {
	return typeof value === 'object' && value !== null
		? (value as ToolArgs)
		: {}
}

function stringArg(args: ToolArgs, key: string): string {
	return toSingleLine(String(args[key] ?? ''))
}

function pathSubject(args: ToolArgs): string {
	return baseName(stringArg(args, 'path'))
}

function quotedPattern(args: ToolArgs): string {
	return `"${stringArg(args, 'pattern')}"`
}

function readSubject(args: ToolArgs): string {
	const path = pathSubject(args)
	const offset = args.offset
	return typeof offset === 'number' && offset > 1
		? `${path} dès la ligne ${offset}`
		: path
}

const SUBJECT_EXTRACTORS: Readonly<Record<ToolViewName, SubjectExtractor>> = {
	bash: args => stringArg(args, 'command'),
	read: readSubject,
	grep: quotedPattern,
	find: quotedPattern,
	ls: args => baseName(stringArg(args, 'path') || '.'),
	edit: pathSubject,
	write: pathSubject,
}

/** Short identity of the call, shown between the tool label and the summary. */
export function subjectFor(tool: string, args: unknown): string {
	const extractor = SUBJECT_EXTRACTORS[tool as ToolViewName]
	return extractor?.(asToolArgs(args)) ?? ''
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
	const value = truncation as Record<string, unknown>
	return {
		totalLines:
			typeof value.totalLines === 'number' ? value.totalLines : undefined,
		marker: value.truncated === true ? ' · tronqué' : '',
	}
}

function countSummary(result: CompactToolResult): string {
	return `${countTextLines(firstText(result))} lignes`
}

function bashSummary(result: CompactToolResult): string {
	if (!result.isError) return ''
	const text = firstText(result)
	const exit = text.match(/Command exited with code (\d+)/)
	if (exit) return `exit ${exit[1]}`
	const timeout = text.match(/timed out after:?\s*(\d+)\s*seconds/)
	return timeout ? `timeout ${timeout[1]}s` : 'erreur'
}

function readSummary(result: CompactToolResult): string {
	const truncation = truncationInfo(result.details)
	const lines = truncation.totalLines ?? countTextLines(firstText(result))
	return `${lines} lignes${truncation.marker}`
}

function limitedSummary(
	result: CompactToolResult,
	key: string,
	unit: string,
): string {
	return limitSummary(result.details, key, unit) ?? countSummary(result)
}

function mutationSummary(result: CompactToolResult): string {
	return result.isError ? firstLine(firstText(result)) : ''
}

const RESULT_SUMMARIZERS: Readonly<Record<ToolViewName, ResultSummarizer>> = {
	bash: bashSummary,
	read: readSummary,
	grep: result =>
		limitedSummary(result, 'matchLimitReached', 'correspondances'),
	find: result => limitedSummary(result, 'resultLimitReached', 'résultats'),
	ls: result => limitedSummary(result, 'entryLimitReached', 'entrées'),
	edit: mutationSummary,
	write: mutationSummary,
}

/** Short state of the result, appended after the subject. Empty when obvious. */
export function summarizeResult(
	tool: string,
	result: CompactToolResult,
): string {
	return RESULT_SUMMARIZERS[tool as ToolViewName]?.(result) ?? ''
}

/** First line of a payload, as a stable one-line summary. */
function firstLine(text: string): string {
	const index = text.indexOf('\n')
	return (index === -1 ? text : text.slice(0, index)).trim()
}
