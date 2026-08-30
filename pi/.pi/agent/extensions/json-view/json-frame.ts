import { fgHex } from '../footer/style.ts'
import {
	frameContentWidth,
	frameDotsRow,
	frameEdge,
	frameRow,
	frameRowFadeRatio,
	frameWidth,
	FRAME_FADE_ROWS,
	FRAME_MAX_LINES,
	type FramePalette,
} from '../ui/frame.ts'
import {
	hyperlink,
	terminalLineWidth,
	truncateTerminalLine,
} from '../ui/terminal-text.ts'

import { escapeMarkdownOutsideAnsi, fadeAnsiLine } from './ansi-text.ts'
import { JSON_COLOR } from './json-colors.ts'
import { highlightJsonLine } from './json-syntax.ts'

export const JSON_MAX_LINES = FRAME_MAX_LINES

const STYLE = {
	BOLD: '\x1b[1m',
	BOLD_OFF: '\x1b[22m',
} as const

const PALETTE: FramePalette = {
	border: JSON_COLOR.BORDER,
	base: JSON_COLOR.BASE,
}

export type JsonFrameFooter =
	| { kind: 'complete'; linkUrl?: string }
	| { kind: 'streaming' }

export type JsonFrameOptions = {
	isExpanded: boolean
	width: number
	bytes: number
	footer: JsonFrameFooter
}

const BYTE = {
	KIBIBYTE: 1024,
	MEBIBYTE: 1_048_576,
} as const

export function formatJsonBytes(bytes: number): string {
	if (bytes >= BYTE.MEBIBYTE) {
		return `${(bytes / BYTE.MEBIBYTE).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
	}
	if (bytes >= BYTE.KIBIBYTE) {
		return `${(bytes / BYTE.KIBIBYTE).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`
	}
	return `${bytes.toLocaleString('fr-FR')} o`
}

function contentRow(line: string, width: number, fadeRatio: number): string {
	const truncated = truncateTerminalLine(line, frameContentWidth(width), '…')
	const escaped = escapeMarkdownOutsideAnsi(truncated)
	const highlighted = highlightJsonLine(escaped)
	const content =
		fadeRatio > 0 ? fadeAnsiLine(highlighted, fadeRatio) : highlighted
	return frameRow({
		width,
		content,
		visibleContentWidth: terminalLineWidth(truncated),
		...PALETTE,
	})
}

function contentRows(
	lines: string[],
	width: number,
	isCapped: boolean,
): string[] {
	const shown = isCapped ? lines.slice(0, JSON_MAX_LINES) : lines
	const solidRows = isCapped ? shown.length - FRAME_FADE_ROWS : shown.length
	const rows = shown.map((line, index) =>
		contentRow(line, width, frameRowFadeRatio(index, solidRows, isCapped)),
	)
	if (isCapped) rows.push(frameDotsRow(width, PALETTE))
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
	return frameEdge({
		width,
		left: '╰',
		right: '╯',
		label: fgHex(label.color, text),
		...PALETTE,
	})
}

export function renderJsonFrame(
	lines: string[],
	options: JsonFrameOptions,
): string {
	const { footer } = options
	const width = frameWidth(options.width)
	const isCapped = !options.isExpanded && lines.length > JSON_MAX_LINES
	const hiddenLineCount = isCapped ? lines.length - JSON_MAX_LINES : 0
	const title = titleLabel(options.bytes, lines.length)
	const rows = [
		frameEdge({
			width,
			left: '╭',
			right: '╮',
			label: title.ansi,
			...PALETTE,
		}),
	]
	rows.push(...contentRows(lines, width, isCapped))
	rows.push(renderFooter(footer, hiddenLineCount, width))
	return rows.join('\n')
}
