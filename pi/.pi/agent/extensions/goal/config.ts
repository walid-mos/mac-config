import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const THINKING_LEVELS = [
	'off',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
	'max',
] as const

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

export type EvaluatorCandidate = {
	readonly provider: string
	readonly id: string
	readonly thinkingLevel: ThinkingLevel
}

function parseCandidate(value: unknown): EvaluatorCandidate {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Evaluator candidate must be an object')
	const candidate = value as Record<string, unknown>
	const { provider, id, thinkingLevel } = candidate
	if (
		typeof provider !== 'string' ||
		!provider.trim() ||
		typeof id !== 'string' ||
		!id.trim() ||
		!THINKING_LEVELS.some(level => level === thinkingLevel) ||
		Object.keys(candidate).some(
			key => !['provider', 'id', 'thinkingLevel'].includes(key),
		)
	)
		throw new Error('Invalid evaluator candidate')
	return { provider, id, thinkingLevel: thinkingLevel as ThinkingLevel }
}

export function loadEvaluatorCandidates(
	path = join(
		process.env.PI_CODING_AGENT_DIR?.trim() ||
			join(homedir(), '.pi', 'agent'),
		'goal.json',
	),
): EvaluatorCandidate[] {
	const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
	if (!Array.isArray(value) || value.length === 0)
		throw new Error(
			'goal.json must contain a non-empty evaluator candidate array',
		)
	return value.map(parseCandidate)
}
