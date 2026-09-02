import {
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from '@earendil-works/pi-tui'

/** Minimal color surface structurally compatible with the full Pi theme. */
export interface QuestionnairePalette {
	fg(
		color: 'accent' | 'muted' | 'dim' | 'warning' | 'success' | 'text',
		text: string,
	): string
	bg(color: 'selectedBg', text: string): string
	bold(text: string): string
}

export type LineSink = (line: string) => void

export function clippedLineSink(lines: string[], width: number): LineSink {
	return line =>
		lines.push(
			visibleWidth(line) <= width ? line : truncateToWidth(line, width),
		)
}

/** Wrap text and push each visual line, hanging-indented under `prefix`. */
export function pushWrappedWithPrefix(
	sink: LineSink,
	prefix: string,
	text: string,
	width: number,
): void {
	const prefixWidth = visibleWidth(prefix)
	if (prefixWidth >= width) {
		for (const line of wrapTextWithAnsi(prefix + text, width)) sink(line)
		return
	}
	const wrapped = wrapTextWithAnsi(text, width - prefixWidth)
	const continuation = ' '.repeat(prefixWidth)
	for (let index = 0; index < wrapped.length; index++) {
		sink(`${index === 0 ? prefix : continuation}${wrapped[index]}`)
	}
}
