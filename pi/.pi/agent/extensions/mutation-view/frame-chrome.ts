import { terminalLineWidth, truncateTerminalLine } from '../ui/terminal-text.ts'

import type {
	FrameTheme,
	MutationFrameSpec,
	MutationFrameStat,
} from './frame-types.ts'

const STYLE = {
	BOLD: '\x1b[1m',
	BOLD_OFF: '\x1b[22m',
} as const
const HEADER_CHROME_WIDTH = 6
const ROW_CHROME_WIDTH = 2
const ANSI_BG_RESET = '\x1b[49m'

export function titleRow(
	spec: MutationFrameSpec,
	width: number,
	theme: FrameTheme,
): string {
	const fullStats = statsLabel(spec.stats, theme)
	const prefix = `${theme.fg('accent', '┌')} ${theme.fg('accent', `${STYLE.BOLD}${spec.tool}${STYLE.BOLD_OFF}`)} ${theme.fg('muted', '─')} `
	const prefixWidth = terminalLineWidth(prefix)
	const canShowStats = width - prefixWidth - terminalLineWidth(fullStats) >= 8
	const stats = canShowStats ? fullStats : ''
	const statsWidth = terminalLineWidth(stats)
	const minimumGap = 1
	const pathBudget = Math.max(
		0,
		width - prefixWidth - statsWidth - HEADER_CHROME_WIDTH,
	)
	const basename = spec.path.split('/').pop() || spec.path
	const pathSource = pathBudget < 12 ? basename : spec.path
	const path = truncateTerminalLine(
		theme.fg('text', pathSource),
		pathBudget,
		'…',
	)
	const used = prefixWidth + terminalLineWidth(path) + statsWidth + minimumGap
	const fill = Math.max(1, width - used - (stats ? 1 : 0))
	const suffix = stats ? ` ${stats}` : ''
	const row = `${prefix}${path} ${theme.fg('muted', '─'.repeat(fill))}${suffix}`
	return truncateTerminalLine(row, width, '…')
}

export function railRow(
	content: string,
	width: number,
	theme: FrameTheme,
	background?: string,
): string {
	if (width <= 1) return theme.fg('muted', '│'.slice(0, width))
	const body = truncateTerminalLine(content, width - ROW_CHROME_WIDTH, '…')
	const rail = theme.fg('muted', '│')
	if (!background) return `${rail} ${body}`
	// Pi trims ordinary trailing spaces from component rows. Non-breaking spaces
	// keep the pastel band rectangular while remaining visually blank.
	const padding = '\u00a0'.repeat(
		Math.max(0, width - ROW_CHROME_WIDTH - terminalLineWidth(body)),
	)
	return `${rail}${background} ${body}${padding}${ANSI_BG_RESET}`
}

export function separatorRow(
	index: number,
	total: number,
	width: number,
	theme: FrameTheme,
): string {
	return railRow(
		theme.fg('dim', `··· édition ${index}/${total}`),
		width,
		theme,
	)
}

export function footerRow(
	hiddenLineCount: number,
	nativeLabel: string,
	expanded: boolean,
	width: number,
	theme: FrameTheme,
): string {
	const text = expanded
		? 'ctrl+o · replier'
		: hiddenLineCount > 0
			? `+${hiddenLineCount} lignes masquées · ctrl+o`
			: `ctrl+o · ${nativeLabel}`
	return truncateTerminalLine(`  ${theme.fg('muted', text)}`, width, '…')
}

function statsLabel(
	stats: ReadonlyArray<MutationFrameStat>,
	theme: FrameTheme,
): string {
	return stats
		.map((stat, index) => {
			const separator = index === 0 ? '' : (stat.separator ?? ' · ')
			return `${theme.fg('muted', separator)}${theme.fg(stat.role, stat.text)}`
		})
		.join('')
}
