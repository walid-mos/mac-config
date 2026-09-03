/**
 * Framed block scaffolding for the questionnaire, built on the shared
 * ui/frame.ts primitives so ask widgets render with the exact Catppuccin
 * geometry of json-view and mutation-view blocks. Deliberately free of
 * pi-tui imports so the transcript renderers stay unit-testable with
 * `node --test`.
 */

import {
	backgroundColorSequence,
	foregroundHex as fgHex,
} from '../ui/design-system/terminal-color.ts'
import {
	frameContentWidth,
	frameEdge,
	frameRow,
	frameWidth,
	type FramePalette,
} from '../ui/frame.ts'
import {
	terminalLineWidth,
	truncateTerminalLine,
	wrapTerminalLine,
} from '../ui/terminal-text.ts'

import { boldAnsi, Q_COLOR } from './questionnaire-theme.ts'

const SGR_RESET = '\x1b[0m'

export const Q_FRAME: FramePalette = {
	border: Q_COLOR.BORDER,
	base: Q_COLOR.BASE,
}

/** Visible columns available between the `│ … │` chrome. */
export function innerWidth(width: number): number {
	return frameContentWidth(frameWidth(width))
}

/** One framed content row: truncated to the chrome, padded, railed. */
export function frameRowFor(line: string, width: number): string {
	const blockWidth = frameWidth(width)
	const content = truncateTerminalLine(
		line,
		frameContentWidth(blockWidth),
		'…',
	)
	return frameRow({
		width: blockWidth,
		content,
		visibleContentWidth: terminalLineWidth(content),
		...Q_FRAME,
	})
}

/** Full-row background band for the focused row; padded with non-breaking
 * spaces so the band stays rectangular (pi trims plain trailing spaces).
 * The truncation reset would cut the band short, so it is stripped and the
 * band closes background + foreground itself. */
export function innerBand(line: string, width: number): string {
	const body = truncateTerminalLine(line, width, '…')
	const bare = body.endsWith(SGR_RESET)
		? body.slice(0, -SGR_RESET.length)
		: body
	const padding = '\u00a0'.repeat(
		Math.max(0, width - terminalLineWidth(bare)),
	)
	return `${backgroundColorSequence(Q_COLOR.SELECTED_BG)}${bare}${padding}\x1b[49m\x1b[39m`
}

/** Rounded block: labelled top edge, content rows, labelled bottom edge. */
export function framedBlock(
	width: number,
	title: string,
	inner: readonly string[],
	footer: string,
): string[] {
	const blockWidth = frameWidth(width)
	return [
		frameEdge({
			width: blockWidth,
			left: '╭',
			right: '╮',
			label: title,
			...Q_FRAME,
		}),
		...inner.map(line => frameRowFor(line, width)),
		frameEdge({
			width: blockWidth,
			left: '╰',
			right: '╯',
			label: footer,
			...Q_FRAME,
		}),
	]
}

/** `ask · meta` edge label: bold accent title, dim meta. */
export function blockTitle(label: string, meta?: string): string {
	const base = fgHex(Q_COLOR.ACCENT, boldAnsi(label))
	return meta ? `${base}${fgHex(Q_COLOR.DIM, ` · ${meta}`)}` : base
}

/** Word-wrap `text` under `prefix`, continuation lines hanging-indented. */
export function pushWrapped(
	sink: (line: string) => void,
	prefix: string,
	text: string,
	width: number,
): void {
	const prefixWidth = terminalLineWidth(prefix)
	const wrapped = wrapTerminalLine(text, Math.max(1, width - prefixWidth))
	const continuation = ' '.repeat(prefixWidth)
	for (let index = 0; index < wrapped.length; index++) {
		sink(
			index === 0
				? `${prefix}${wrapped[index]}`
				: `${continuation}${wrapped[index]}`,
		)
	}
}
