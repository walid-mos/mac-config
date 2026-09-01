const SUMMARY_BLOCK_PATTERN = /^\*\*([\s\S]+)\*\*$/u

function removeBold(markdown: string): string {
	return markdown
		.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/gu, '$1')
		.replace(/__(?=\S)([\s\S]*?\S)__/gu, '$1')
}

/** Remove bold and group Codex summaries without reformatting prose. */
export function softenThinkingMarkdown(markdown: string): string {
	const summaries = markdown
		.trim()
		.split(/\n{2,}/u)
		.map(block => SUMMARY_BLOCK_PATTERN.exec(block.trim())?.[1]?.trim())

	if (
		summaries.length === 0 ||
		summaries.some(summary => summary === undefined)
	) {
		return removeBold(markdown)
	}

	const groups: string[] = []
	for (let index = 0; index < summaries.length; index += 3) {
		groups.push(summaries.slice(index, index + 3).join('\n'))
	}
	return groups.join('\n\n')
}
