import { footerRow, railRow, separatorRow, titleRow } from './frame-chrome.ts'
import { diffBackgrounds, diffRow } from './frame-diff.ts'
import {
	expandFrameContent,
	frameContent,
	frameLineNumberWidth,
	frameWidth,
} from './frame-layout.ts'

import type { FrameTheme, MutationFrameSpec } from './frame-types.ts'

export type {
	FrameTheme,
	MutationFrameComponent,
	MutationFrameSpec,
	MutationFrameStat,
} from './frame-types.ts'

const MUTATION_MAX_LINES = 18
const MUTATION_FADE_ROWS = 3

export function mutationFrameRows(
	spec: MutationFrameSpec,
	width: number,
	theme: FrameTheme,
): string[] {
	const content = frameContent(spec)
	const lineNumberWidth = frameLineNumberWidth(content)
	const w = frameWidth(width, lineNumberWidth)
	const contentRows = expandFrameContent(content, w, lineNumberWidth)
	const isCapped =
		spec.expanded !== true && contentRows.length > MUTATION_MAX_LINES
	const shown = isCapped
		? contentRows.slice(0, MUTATION_MAX_LINES)
		: contentRows
	const solidRows = isCapped
		? shown.length - MUTATION_FADE_ROWS
		: shown.length
	const backgrounds = spec.highlightChanges
		? diffBackgrounds(theme)
		: undefined
	const rows = [titleRow(spec, w, theme), railRow('', w, theme)]
	shown.forEach((entry, index) => {
		if (entry.separator) {
			rows.push(
				separatorRow(
					entry.separator.index,
					entry.separator.total,
					w,
					theme,
				),
			)
		} else if (entry.line) {
			rows.push(
				diffRow(entry.line, {
					lineNumberWidth,
					width: w,
					theme,
					backgrounds,
					fadeIndex: index - solidRows,
				}),
			)
		}
	})
	if (isCapped) rows.push(railRow(theme.fg('dim', '· · ·'), w, theme))
	rows.push(railRow('', w, theme))
	rows.push(
		footerRow(
			contentRows.length - shown.length,
			spec.nativeLabel,
			spec.expanded === true,
			w,
			theme,
		),
	)
	return rows
}
