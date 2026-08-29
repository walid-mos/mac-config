import { findBalancedEnd, parsesAsIncompleteJson } from './json-structure.ts'
import { parseJson } from './json-value.ts'
import { overlapsFence, scanMarkdownFences } from './markdown-fences.ts'

import type { JsonValue } from './json-value.ts'
import type { MarkdownFence } from './markdown-fences.ts'

export const MIN_RAW_LENGTH = 60

const RAW_START_PATTERN = /^[ \t]*(?:\{|\[)/gm

type RawAnchor = {
	lineStart: number
	openIndex: number
}

export type JsonBlock = {
	source: 'fence' | 'raw'
	start: number
	end: number
	raw: string
	parsed: JsonValue
}

export type OpenJson = {
	start: number
	content: string
}

export type JsonDetection = {
	blocks: JsonBlock[]
	openFence: OpenJson | undefined
	openRaw: OpenJson | undefined
}

function fenceBlock(fence: MarkdownFence): JsonBlock | undefined {
	if (!fence.isClosed) return undefined
	const raw = fence.content.trim()
	if (!raw.length) return undefined
	if (fence.language && fence.language !== 'json') return undefined
	if (!fence.language && raw.length < MIN_RAW_LENGTH) return undefined
	const parsedJson = parseJson(raw)
	if (!parsedJson.isValid) return undefined
	return {
		source: 'fence',
		start: fence.start,
		end: fence.end,
		raw,
		parsed: parsedJson.parsed,
	}
}

function rawOpenIndex(match: RegExpMatchArray, lineStart: number): number {
	const [matched] = match
	const braceOffset = matched.indexOf('{')
	if (braceOffset >= 0) return lineStart + braceOffset
	return lineStart + matched.indexOf('[')
}

function rawAnchors(markdown: string, fences: MarkdownFence[]): RawAnchor[] {
	const anchors: RawAnchor[] = []
	for (const match of markdown.matchAll(RAW_START_PATTERN)) {
		const lineStart = match.index ?? 0
		const openIndex = rawOpenIndex(match, lineStart)
		if (!overlapsFence(fences, lineStart, openIndex + 1)) {
			anchors.push({ lineStart, openIndex })
		}
	}
	return anchors
}

function extractFenceBlocks(fences: MarkdownFence[]): JsonBlock[] {
	const blocks: JsonBlock[] = []
	for (const fence of fences) {
		const block = fenceBlock(fence)
		if (block) blocks.push(block)
	}
	return blocks
}

function extractRawBlocks(
	markdown: string,
	fences: MarkdownFence[],
	initialBlocks: JsonBlock[],
): JsonBlock[] {
	const blocks = [...initialBlocks]
	const occupied = initialBlocks.map(
		block => [block.start, block.end] satisfies [number, number],
	)
	for (const anchor of rawAnchors(markdown, fences)) {
		const end = findBalancedEnd(markdown, anchor.openIndex)
		const hasOpenRoot =
			end < 0 && parsesAsIncompleteJson(markdown.slice(anchor.openIndex))
		if (hasOpenRoot) break
		if (end < 0) continue
		if (
			occupied.some(
				([start, stop]) => anchor.lineStart < stop && end > start,
			)
		)
			continue
		const raw = markdown.slice(anchor.openIndex, end)
		if (raw.length < MIN_RAW_LENGTH && !raw.includes('\n')) continue
		const parsedJson = parseJson(raw)
		if (!parsedJson.isValid) continue
		const block = {
			source: 'raw',
			start: anchor.lineStart,
			end,
			raw,
			parsed: parsedJson.parsed,
		} satisfies JsonBlock
		blocks.push(block)
		occupied.push([anchor.lineStart, end])
	}
	return blocks.toSorted((left, right) => left.start - right.start)
}

function findOpenFence(fences: MarkdownFence[]): OpenJson | undefined {
	const openFence = fences.find(fence => !fence.isClosed)
	if (!openFence) return undefined
	if (openFence.language === 'json')
		return { start: openFence.start, content: openFence.content }
	if (openFence.language || !/^[ \t]*(?:\{|\[)/.test(openFence.content))
		return undefined
	return { start: openFence.start, content: openFence.content }
}

function findOpenRaw(
	markdown: string,
	fences: MarkdownFence[],
): OpenJson | undefined {
	for (const anchor of rawAnchors(markdown, fences)) {
		const content = markdown.slice(anchor.openIndex)
		if (findBalancedEnd(content, 0) >= 0) continue
		if (!content.includes('\n') && content.length < MIN_RAW_LENGTH) continue
		if (parsesAsIncompleteJson(content))
			return { start: anchor.lineStart, content }
	}
	return undefined
}

export function detectJsonMarkdown(markdown: string): JsonDetection {
	const fences = scanMarkdownFences(markdown)
	const fenceBlocks = extractFenceBlocks(fences)
	const blocks = extractRawBlocks(markdown, fences, fenceBlocks)
	const openFence = findOpenFence(fences)
	let openRaw: OpenJson | undefined
	if (!blocks.length && !openFence) openRaw = findOpenRaw(markdown, fences)
	return { blocks, openFence, openRaw }
}
