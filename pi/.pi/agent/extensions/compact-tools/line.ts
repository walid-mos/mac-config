/**
 * Pure composition of a compact activity row. A grouped row receives a quiet
 * timeline connector (`├─` / `╰─`); a standalone call remains chrome-free.
 * Truncation goes through the shared ANSI-safe terminal primitives.
 */

import { truncateTerminalLine } from '../ui/terminal-text.ts'

import type { CompactRowState, CompactTheme } from './types.ts'

export type CompactRowTone = 'normal' | 'muted' | 'dim'
export type CompactRowConnector = 'middle' | 'last'

export interface CompactRowLayout {
	tone?: CompactRowTone
	connector?: CompactRowConnector
	toolWidth?: number
}

const GLYPHS = {
	pending: { glyph: '●', role: 'accent' },
	ok: { glyph: '✓', role: 'success' },
	error: { glyph: '✗', role: 'error' },
	notice: { glyph: '◇', role: 'muted' },
} as const

export interface CompactRowView {
	tool: string
	subject: string
	state: CompactRowState
	theme: CompactTheme
	/** Expansion flag at last rebuild, so hideOnSuccess rows stay visible. */
	expanded?: boolean
}

function connectorPrefix(
	connector: CompactRowConnector | undefined,
	theme: CompactTheme,
): string {
	if (connector === 'middle') return `${theme.fg('muted', '├─')} `
	if (connector === 'last') return `${theme.fg('muted', '╰─')} `
	return ''
}

/** Compose one responsive activity row, already truncated to `width`. */
export function compactRowLine(
	view: CompactRowView,
	width: number,
	theme: CompactTheme,
	layout: CompactRowLayout = {},
): string {
	const tone = layout.tone ?? 'normal'
	const { glyph, role } = GLYPHS[view.state.status ?? 'pending']
	const toolWidth = Math.max(
		view.tool.length,
		layout.toolWidth ?? view.tool.length,
	)
	const paddedTool = view.tool.padEnd(toolWidth)
	const historical = tone !== 'normal'
	const tool = historical
		? theme.fg(tone, paddedTool)
		: theme.fg('accent', theme.bold(paddedTool))
	const subject = historical
		? theme.fg(tone, view.subject)
		: theme.fg('text', view.subject)
	const summary = view.state.summary

	let line = connectorPrefix(layout.connector, theme)
	line += `${theme.fg(role, glyph)} ${tool}`
	if (view.subject.length > 0) line += ` · ${subject}`
	if (summary && summary.length > 0) line += theme.fg('dim', ` · ${summary}`)
	return truncateTerminalLine(line, width, '…')
}
