const FENCE_RULE = {
	MAX_INDENT: 3,
	MIN_MARKERS: 3,
} as const

type MarkdownLine = {
	start: number
	textEnd: number
	end: number
	hasLineBreak: boolean
}

type FenceOpener = {
	start: number
	contentStart: number
	marker: string
	markerCount: number
	language: string
}

export type MarkdownFence = {
	start: number
	end: number
	content: string
	language: string
	isClosed: boolean
}

function splitMarkdownLines(markdown: string): MarkdownLine[] {
	const lines: MarkdownLine[] = []
	let start = 0
	while (start < markdown.length) {
		const lineBreak = markdown.indexOf('\n', start)
		if (lineBreak < 0) {
			lines.push({
				start,
				textEnd: markdown.length,
				end: markdown.length,
				hasLineBreak: false,
			})
			break
		}
		const hasCarriageReturn = markdown[lineBreak - 1] === '\r'
		lines.push({
			start,
			textEnd: hasCarriageReturn ? lineBreak - 1 : lineBreak,
			end: lineBreak + 1,
			hasLineBreak: true,
		})
		start = lineBreak + 1
	}
	return lines
}

function leadingSpaces(line: string): number {
	let count = 0
	while (line[count] === ' ') count += 1
	return count
}

function markerRunLength(line: string, start: number, marker: string): number {
	let cursor = start
	while (line[cursor] === marker) cursor += 1
	return cursor - start
}

function parseFenceOpener(
	markdown: string,
	line: MarkdownLine,
): FenceOpener | undefined {
	if (!line.hasLineBreak) return undefined
	const lineText = markdown.slice(line.start, line.textEnd)
	const indent = leadingSpaces(lineText)
	if (indent > FENCE_RULE.MAX_INDENT) return undefined
	const marker = lineText[indent]
	if (marker !== '`' && marker !== '~') return undefined
	const markerCount = markerRunLength(lineText, indent, marker)
	if (markerCount < FENCE_RULE.MIN_MARKERS) return undefined
	const trailing = lineText.slice(indent + markerCount)
	if (marker === '`' && trailing.includes('`')) return undefined
	const [language = ''] = trailing.trim().split(/\s+/)
	return {
		start: line.start,
		contentStart: line.end,
		marker,
		markerCount,
		language: language.toLowerCase(),
	}
}

function isFenceCloser(
	markdown: string,
	line: MarkdownLine,
	opener: FenceOpener,
): boolean {
	const lineText = markdown.slice(line.start, line.textEnd)
	const indent = leadingSpaces(lineText)
	if (indent > FENCE_RULE.MAX_INDENT || lineText[indent] !== opener.marker)
		return false
	const markerCount = markerRunLength(lineText, indent, opener.marker)
	if (markerCount < opener.markerCount) return false
	return !lineText.slice(indent + markerCount).trim().length
}

function closedFence(
	markdown: string,
	opener: FenceOpener,
	closer: MarkdownLine,
): MarkdownFence {
	return {
		start: opener.start,
		end: closer.textEnd,
		content: markdown.slice(opener.contentStart, closer.start),
		language: opener.language,
		isClosed: true,
	}
}

export function scanMarkdownFences(markdown: string): MarkdownFence[] {
	const fences: MarkdownFence[] = []
	let opener: FenceOpener | undefined
	for (const line of splitMarkdownLines(markdown)) {
		if (!opener) {
			opener = parseFenceOpener(markdown, line)
			continue
		}
		if (!isFenceCloser(markdown, line, opener)) continue
		fences.push(closedFence(markdown, opener, line))
		opener = undefined
	}
	if (opener) {
		fences.push({
			start: opener.start,
			end: markdown.length,
			content: markdown.slice(opener.contentStart),
			language: opener.language,
			isClosed: false,
		})
	}
	return fences
}

export function overlapsFence(
	fences: MarkdownFence[],
	start: number,
	end: number,
): boolean {
	return fences.some(fence => start < fence.end && end > fence.start)
}
