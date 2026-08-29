import { fgHex } from '../footer/style.ts'
import {
	hyperlink,
	terminalLineWidth,
	truncateTerminalLine,
} from '../ui/terminal-text.ts'

import { escapeMarkdownOutsideAnsi, fadeAnsiLine } from './ansi-text.ts'
import {
	blendHex,
	CONTENT_FADE_STEPS,
	DOT_FADE_STEPS,
	JSON_COLOR,
} from './json-colors.ts'
import { highlightJsonLine } from './json-syntax.ts'

export const JSON_MAX_LINES = 18

const BOX = {
	CONTENT_FADE_ROWS: 3,
	ROW_CHROME_WIDTH: 4,
	EDGE_CHROME_WIDTH: 5,
	DOTS_VISIBLE_WIDTH: 5,
	MIN_WIDTH: 1,
	CENTER_DIVISOR: 2,
} as const

const BYTE = {
	KIBIBYTE: 1024,
	MEBIBYTE: 1_048_576,
} as const

const STYLE = {
	BOLD: '\x1b[1m',
	BOLD_OFF: '\x1b[22m',
} as const

export type JsonFrameFooter =
	| { kind: 'complete'; linkUrl?: string }
	| { kind: 'streaming' }

export type JsonFrameOptions = {
	isExpanded: boolean
	width: number
	bytes: number
	footer: JsonFrameFooter
}

type EdgeOptions = {
	width: number
	left: string
	right: string
	label: string
}

type RowOptions = {
	width: number
	content: string
	visibleContentWidth: number
}

export function formatJsonBytes(bytes: number): string {
	if (bytes >= BYTE.MEBIBYTE) {
		return `${(bytes / BYTE.MEBIBYTE).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
	}
	if (bytes >= BYTE.KIBIBYTE) {
		return `${(bytes / BYTE.KIBIBYTE).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`
	}
	return `${bytes.toLocaleString('fr-FR')} o`
}

function normalizedWidth(width: number): number {
	if (!Number.isFinite(width)) return BOX.MIN_WIDTH
	return Math.max(BOX.MIN_WIDTH, Math.floor(width))
}

function boxEdge(options: EdgeOptions): string {
	if (options.width < BOX.EDGE_CHROME_WIDTH) {
		return fgHex(JSON_COLOR.BORDER, '─'.repeat(options.width))
	}
	const labelBudget = options.width - BOX.EDGE_CHROME_WIDTH
	const label = truncateTerminalLine(options.label, labelBudget, '…')
	const fill =
		options.width - BOX.EDGE_CHROME_WIDTH - terminalLineWidth(label)
	return `${fgHex(JSON_COLOR.BORDER, `${options.left}─ `)}${label} ${fgHex(JSON_COLOR.BORDER, `${'─'.repeat(fill)}${options.right}`)}`
}

function boxRow(options: RowOptions): string {
	if (options.width < BOX.ROW_CHROME_WIDTH) {
		return fgHex(JSON_COLOR.BORDER, '│'.repeat(options.width))
	}
	const contentWidth = options.width - BOX.ROW_CHROME_WIDTH
	const padding = Math.max(0, contentWidth - options.visibleContentWidth)
	return `${fgHex(JSON_COLOR.BORDER, '│')} ${options.content}${' '.repeat(padding)} ${fgHex(JSON_COLOR.BORDER, '│')}`
}

function contentRow(line: string, width: number, fadeRatio: number): string {
	const contentWidth = Math.max(0, width - BOX.ROW_CHROME_WIDTH)
	const truncated = truncateTerminalLine(line, contentWidth, '…')
	const escaped = escapeMarkdownOutsideAnsi(truncated)
	const highlighted = highlightJsonLine(escaped)
	const content =
		fadeRatio > 0 ? fadeAnsiLine(highlighted, fadeRatio) : highlighted
	return boxRow({
		width,
		content,
		visibleContentWidth: terminalLineWidth(truncated),
	})
}

function dotsRow(width: number): string {
	const dots = DOT_FADE_STEPS.map(ratio => fgHex(blendDotColor(ratio), '·'))
	const contentWidth = Math.max(0, width - BOX.ROW_CHROME_WIDTH)
	const padding = Math.max(
		0,
		Math.floor(
			(contentWidth - BOX.DOTS_VISIBLE_WIDTH) / BOX.CENTER_DIVISOR,
		),
	)
	const content = truncateTerminalLine(
		`${' '.repeat(padding)}${dots.join(' ')}`,
		contentWidth,
		'',
	)
	return boxRow({
		width,
		content,
		visibleContentWidth: terminalLineWidth(content),
	})
}

function blendDotColor(ratio: number): string {
	return blendHex(JSON_COLOR.BORDER, JSON_COLOR.BASE, ratio)
}

function rowFadeRatio(
	index: number,
	solidRows: number,
	isCapped: boolean,
): number {
	if (!isCapped || index < solidRows) return 0
	return CONTENT_FADE_STEPS[index - solidRows] ?? 0
}

function contentRows(
	lines: string[],
	width: number,
	isCapped: boolean,
): string[] {
	const shown = isCapped ? lines.slice(0, JSON_MAX_LINES) : lines
	const solidRows = isCapped
		? shown.length - BOX.CONTENT_FADE_ROWS
		: shown.length
	const rows = shown.map((line, index) =>
		contentRow(line, width, rowFadeRatio(index, solidRows, isCapped)),
	)
	if (isCapped) rows.push(dotsRow(width))
	return rows
}

function titleLabel(
	bytes: number,
	lineCount: number,
): { ansi: string; plain: string } {
	const plain = `json · ${formatJsonBytes(bytes)} · ${lineCount.toLocaleString('fr-FR')} lignes`
	const ansi = `${fgHex(JSON_COLOR.TITLE, `${STYLE.BOLD}json${STYLE.BOLD_OFF}`)}${fgHex(JSON_COLOR.META, plain.slice('json'.length))}`
	return { ansi, plain }
}

function footerLabel(
	footer: JsonFrameFooter,
	hiddenLineCount: number,
): { color: string; text: string } {
	if (footer.kind === 'streaming') {
		if (hiddenLineCount > 0)
			return {
				color: JSON_COLOR.LINK,
				text: `⤢ +${hiddenLineCount.toLocaleString('fr-FR')} lignes`,
			}
		return { color: JSON_COLOR.LINK, text: 'génération…' }
	}
	if (hiddenLineCount > 0) {
		return {
			color: JSON_COLOR.LINK,
			text: `⤢ +${hiddenLineCount.toLocaleString('fr-FR')} lignes · tout voir`,
		}
	}
	return {
		color: footer.linkUrl ? JSON_COLOR.LINK : JSON_COLOR.META,
		text: 'ouvrir ⤢ · /json open',
	}
}

function renderFooter(
	footer: JsonFrameFooter,
	hiddenLineCount: number,
	width: number,
): string {
	const label = footerLabel(footer, hiddenLineCount)
	let { text } = label
	if (footer.kind === 'complete' && footer.linkUrl)
		text = hyperlink(text, footer.linkUrl)
	return boxEdge({
		width,
		left: '╰',
		right: '╯',
		label: fgHex(label.color, text),
	})
}

export function renderJsonFrame(
	lines: string[],
	options: JsonFrameOptions,
): string {
	const { footer } = options
	const width = normalizedWidth(options.width)
	const isCapped = !options.isExpanded && lines.length > JSON_MAX_LINES
	const hiddenLineCount = isCapped ? lines.length - JSON_MAX_LINES : 0
	const title = titleLabel(options.bytes, lines.length)
	const rows = [boxEdge({ width, left: '╭', right: '╮', label: title.ansi })]
	rows.push(...contentRows(lines, width, isCapped))
	rows.push(renderFooter(footer, hiddenLineCount, width))
	return rows.join('\n')
}
