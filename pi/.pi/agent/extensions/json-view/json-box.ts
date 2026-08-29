import { Buffer } from 'node:buffer'

import { renderJsonFrame } from './json-frame.ts'
import { prettyJson } from './json-value.ts'

import type { JsonBlock } from './detect-json.ts'
import type { JsonFrameFooter } from './json-frame.ts'

export type JsonRenderOptions = {
	expanded: boolean
	width: number
	linkUrl?: string
}

function completeFooter(linkUrl: string | undefined): JsonFrameFooter {
	if (linkUrl) return { kind: 'complete', linkUrl }
	return { kind: 'complete' }
}

export function renderJsonBox(
	block: JsonBlock,
	options: JsonRenderOptions,
): string {
	const pretty = prettyJson(block.parsed)
	return renderJsonFrame(pretty.split('\n'), {
		isExpanded: options.expanded,
		width: options.width,
		bytes: Buffer.byteLength(pretty),
		footer: completeFooter(options.linkUrl),
	})
}

export function renderOpenJson(
	content: string,
	options: JsonRenderOptions,
): string {
	const withoutTrailingLines = content.replace(/\n+$/, '')
	return renderJsonFrame(withoutTrailingLines.split('\n'), {
		isExpanded: options.expanded,
		width: options.width,
		bytes: Buffer.byteLength(content),
		footer: { kind: 'streaming' },
	})
}
