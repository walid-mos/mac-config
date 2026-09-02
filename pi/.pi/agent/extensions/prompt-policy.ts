import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

const PI_DOCUMENTATION_HEADER = '\n\nPi documentation ('
const SECTION_BOUNDARIES = [
	'\n\n<project_context>',
	'\n\nThe following skills',
	'\nCurrent working directory:',
] as const
const PI_TASK =
	/(?:\bpi\b|\.pi\/|pi-coding-agent|@earendil-works\/pi|AGENTS\.md|SYSTEM\.md|APPEND_SYSTEM\.md|\/skill:)/iu

function documentationBounds(
	systemPrompt: string,
): { start: number; end: number } | undefined {
	const start = systemPrompt.indexOf(PI_DOCUMENTATION_HEADER)
	if (start < 0) return undefined

	const boundaries = SECTION_BOUNDARIES.map(marker =>
		systemPrompt.indexOf(marker, start + PI_DOCUMENTATION_HEADER.length),
	).filter(index => index >= 0)
	const end =
		boundaries.length > 0 ? Math.min(...boundaries) : systemPrompt.length
	return { start, end }
}

export function applyPiDocumentationPolicy(
	systemPrompt: string,
	userPrompt: string,
): string {
	const bounds = documentationBounds(systemPrompt)
	if (!bounds) return systemPrompt
	if (!PI_TASK.test(userPrompt))
		return (
			systemPrompt.slice(0, bounds.start) + systemPrompt.slice(bounds.end)
		)

	const section = systemPrompt
		.slice(bounds.start, bounds.end)
		.split('\n')
		.filter(
			line =>
				!line.startsWith('- When working on pi topics') &&
				!line.startsWith('- Always read pi .md files completely'),
		)
	section.push(
		'- For Pi work, read only the documentation sections directly relevant to the task and follow references required by that work.',
		'- Read a complete Pi document only when implementing against its full contract or when the relevant section requires surrounding context.',
	)
	return (
		systemPrompt.slice(0, bounds.start) +
		section.join('\n') +
		systemPrompt.slice(bounds.end)
	)
}

export default function promptPolicy(pi: ExtensionAPI): void {
	pi.on('before_agent_start', event => ({
		systemPrompt: applyPiDocumentationPolicy(
			event.systemPrompt,
			event.prompt,
		),
	}))
}
