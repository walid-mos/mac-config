import { truncateTerminalLine } from '../ui/terminal-text.ts'

import { compactRowLine } from './line.ts'

import type { CompactRowView } from './line.ts'
import type { CompactRowStackState, StackEntry } from './stack-state.ts'

export const MAX_VISIBLE_STACK_CALLS = 6
const MAX_TOOL_COLUMN_WIDTH = 12

export function renderCompactStack(
	state: CompactRowStackState,
	id: string,
	fallbackView: CompactRowView,
	width: number,
): string[] {
	if (fallbackView.expanded)
		return [compactRowLine(fallbackView, width, fallbackView.theme)]
	const group = state.groupById.get(id)
	if (!group || group.length < 2)
		return [compactRowLine(fallbackView, width, fallbackView.theme)]

	const visible = group
		.map(memberId => ({ id: memberId, entry: state.entries.get(memberId) }))
		.filter(
			(member): member is { id: string; entry: StackEntry } =>
				member.entry !== undefined && !member.entry.view.expanded,
		)
	if (visible.length < 2)
		return [compactRowLine(fallbackView, width, fallbackView.theme)]
	if (visible[visible.length - 1]?.id !== id) return []

	const hidden = visible.slice(0, -MAX_VISIBLE_STACK_CALLS)
	const shown = visible.slice(-MAX_VISIBLE_STACK_CALLS)
	const toolWidth = Math.min(
		MAX_TOOL_COLUMN_WIDTH,
		Math.max(...shown.map(({ entry }) => entry.view.tool.length)),
	)
	const lines = shown.map(({ entry }, index) =>
		compactRowLine(entry.view, width, entry.view.theme, {
			tone: index === shown.length - 1 ? 'normal' : 'muted',
			connector: index === shown.length - 1 ? 'last' : 'middle',
			toolWidth,
		}),
	)
	if (hidden.length > 0)
		lines.unshift(collapsedHistoryLine(hidden, width, fallbackView.theme))
	return lines
}

function collapsedHistoryLine(
	hidden: Array<{ entry: StackEntry }>,
	width: number,
	theme: CompactRowView['theme'],
): string {
	const errors = hidden.filter(
		({ entry }) => entry.view.state.status === 'error',
	).length
	let line = `${theme.fg('muted', '│')}  ${theme.fg('dim', `⋯ ${hidden.length} étapes précédentes`)}`
	if (errors > 0)
		line += ` ${theme.fg('error', `· ${errors} erreur${errors > 1 ? 's' : ''}`)}`
	return truncateTerminalLine(line, width, '…')
}
