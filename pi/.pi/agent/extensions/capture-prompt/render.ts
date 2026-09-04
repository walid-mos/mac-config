import { getCapabilities, Image } from '@earendil-works/pi-tui'
import { basename } from 'node:path'

import type { PromptCapture } from './store.ts'
import type { Theme } from '@earendil-works/pi-coding-agent'

const IMAGE_WIDTH = 10
const FRAME_WIDTH = IMAGE_WIDTH + 2
const TILE_WIDTH = FRAME_WIDTH + 1
const STRIP_GUTTER = 2

export function renderCaptureStrip(
	captures: readonly PromptCapture[],
	offset: number,
	width: number,
	theme: Theme,
): string[] {
	if (captures.length === 0 || width <= 0) return []
	if (!getCapabilities().images || width < TILE_WIDTH + STRIP_GUTTER * 2)
		return [renderFallback(captures, width, theme)]

	const capacity = Math.max(
		1,
		Math.floor((width - STRIP_GUTTER * 2) / TILE_WIDTH),
	)
	const start = Math.min(offset, Math.max(0, captures.length - capacity))
	const visible = captures.slice(start, start + capacity)
	const rendered = visible.map(capture =>
		new Image(
			capture.data,
			capture.mimeType,
			{ fallbackColor: text => theme.fg('muted', text) },
			{
				filename: basename(capture.filePath),
				imageId: capture.imageId,
				maxWidthCells: IMAGE_WIDTH,
				maxHeightCells: 6,
			},
		).render(FRAME_WIDTH),
	)
	const imageRows = Math.max(...rendered.map(lines => lines.length))
	const border = (text: string): string => theme.fg('borderMuted', text)
	const top = visible.map(() => `${border('╭──────────╮')} `).join('')
	const rows = Array.from({ length: imageRows }, (_, row) => {
		const cells = rendered
			.map(
				lines =>
					`${border('│')}${lines[row] ?? ''}${' '.repeat(IMAGE_WIDTH)}${border('│')} `,
			)
			.join('')
		return `${' '.repeat(STRIP_GUTTER)}${cells}`
	})
	const bottom = visible.map(() => `${border('╰──────────╯')} `).join('')
	const labels = visible
		.map(capture => `${center(capture.alias, FRAME_WIDTH)} `)
		.join('')
	const left = start > 0 ? '‹ ' : '  '
	const right = start + visible.length < captures.length ? '›' : ''
	return [
		`${' '.repeat(STRIP_GUTTER)}${top}`,
		...rows,
		`${' '.repeat(STRIP_GUTTER)}${bottom}`,
		`${theme.fg('dim', left)}${theme.fg('accent', theme.bold(labels))}${theme.fg('dim', right)}`,
	]
}

function center(text: string, width: number): string {
	const padding = Math.max(0, width - text.length)
	const left = Math.floor(padding / 2)
	return `${' '.repeat(left)}${text}${' '.repeat(padding - left)}`
}

function renderFallback(
	captures: readonly PromptCapture[],
	width: number,
	theme: Theme,
): string {
	const aliases = captures.map(capture => capture.alias).join(' ')
	const text = `images ${aliases}`
	return theme.fg('dim', text.slice(0, Math.max(0, width)))
}
