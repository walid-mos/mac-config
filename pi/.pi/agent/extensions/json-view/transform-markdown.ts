import { detectJsonMarkdown } from './detect-json.ts'
import { renderJsonBox, renderOpenJson } from './json-box.ts'

import type { JsonBlock } from './detect-json.ts'
import type { JsonRenderOptions } from './json-box.ts'
import type { JsonValue } from './json-value.ts'

export type JsonTransformOptions = {
	expanded: boolean
	width: number
	persist?: (raw: string, parsed: JsonValue) => string | undefined
}

type CompleteRender = {
	markdown: string
	cursor: number
}

function padBeforeBlock(markdown: string): string {
	if (!markdown.length) return ''
	if (/\n[ \t]*\n$/.test(markdown)) return markdown
	if (markdown.endsWith('\n')) return `${markdown}\n`
	return `${markdown}\n\n`
}

function completeBlockOptions(
	options: JsonTransformOptions,
	block: JsonBlock,
): JsonRenderOptions {
	const sharedOptions = { expanded: options.expanded, width: options.width }
	const linkUrl = options.persist?.(block.raw, block.parsed)
	if (linkUrl) return { ...sharedOptions, linkUrl }
	return sharedOptions
}

function renderCompleteBlocks(
	source: string,
	blocks: JsonBlock[],
	options: JsonTransformOptions,
): CompleteRender {
	let transformed = ''
	let cursor = 0
	for (const block of blocks) {
		transformed += source.slice(cursor, block.start)
		transformed = padBeforeBlock(transformed)
		transformed += renderJsonBox(
			block,
			completeBlockOptions(options, block.parsed),
		)
		transformed += '\n\n'
		cursor = block.end
	}
	return { markdown: transformed, cursor }
}

function renderOpenBlock(
	prefix: string,
	content: string,
	options: JsonTransformOptions,
): string {
	const padded = padBeforeBlock(prefix)
	const frame = renderOpenJson(content, {
		expanded: options.expanded,
		width: options.width,
	})
	return `${padded}${frame}\n\n`
}

function appendTail(prefix: string, tail: string): string {
	if (!prefix.endsWith('\n\n')) return prefix + tail
	return prefix + tail.replace(/^\n+/, '')
}

export function transformMarkdown(
	markdown: string,
	options: JsonTransformOptions,
): string {
	const detection = detectJsonMarkdown(markdown)
	if (!detection.blocks.length && !detection.openFence && !detection.openRaw)
		return markdown

	const complete = renderCompleteBlocks(markdown, detection.blocks, options)
	if (detection.openFence) {
		const prefix =
			complete.markdown +
			markdown.slice(complete.cursor, detection.openFence.start)
		return renderOpenBlock(prefix, detection.openFence.content, options)
	}

	const tail = markdown.slice(complete.cursor)
	let { openRaw } = detection
	if (complete.cursor > 0) openRaw = detectJsonMarkdown(tail).openRaw
	if (openRaw) {
		const openFrame = renderOpenBlock(
			tail.slice(0, openRaw.start),
			openRaw.content,
			options,
		)
		return complete.markdown + openFrame
	}
	return appendTail(complete.markdown, tail)
}
