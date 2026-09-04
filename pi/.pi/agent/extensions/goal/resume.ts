import { sanitizeDisplayLine } from './sanitize.ts'

import type { GoalState } from './contracts.ts'

const RESUME_SIGNALS = new Set([
	'avance',
	'avancez',
	'continue',
	'continues',
	'continuez',
	'continuons',
	'continuer',
	'go',
	'poursuis',
	'poursuivez',
	'poursuivons',
	'poursuivre',
	'reprend',
	'reprends',
	'reprenez',
	'reprenons',
	'reprendre',
	'reprenne',
	'reprennes',
	'resume',
	'resumez',
	'vas-y',
])
const STOP_SIGNALS = new Set(['annule', 'annuler', 'stop'])
const NEGATION_AFTER = new Set(['jamais', 'pas'])
const NEGATION_BEFORE = new Set(['never', 'not'])

function intentWords(text: string): readonly string[] {
	return (
		text
			.normalize('NFKD')
			.replace(/\p{M}/gu, '')
			.toLowerCase()
			.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)?/gu) ?? []
	)
}

function hasResumeNegation(
	words: readonly string[],
	signalIndex: number,
): boolean {
	const previous = words[signalIndex - 1]
	const leading = words.slice(Math.max(0, signalIndex - 3), signalIndex)
	const trailing = words.slice(signalIndex + 1, signalIndex + 4)
	if (
		words[0] === 'pas' ||
		(previous !== undefined && NEGATION_BEFORE.has(previous)) ||
		trailing.some(word => NEGATION_AFTER.has(word))
	)
		return true
	return (
		trailing.includes('plus') &&
		leading.some(word => word === 'n' || word === 'ne')
	)
}

/** Recognize an explicit natural-language request to continue interrupted work. */
export function isGoalResumeIntent(text: string): boolean {
	const words = intentWords(text)
	if (
		words.length === 0 ||
		words.some(word => STOP_SIGNALS.has(word)) ||
		words[0] === 'arrete' ||
		words[0] === 'arreter'
	)
		return false
	const signalIndex = words.findIndex(word => RESUME_SIGNALS.has(word))
	return signalIndex >= 0 && !hasResumeNegation(words, signalIndex)
}

export function resumeGoal(previous: GoalState): GoalState {
	if (previous.status !== 'paused' && previous.status !== 'stuck')
		throw new Error('Only an interrupted goal can be resumed.')
	return {
		...previous,
		startedAt: new Date().toISOString(),
		turnsEvaluated: 0,
		noProgressTurns: 0,
		lastVerdict: null,
		lastReason: 'Resumed by user.',
		status: 'active',
	}
}

export function resumedGoalPrompt(userText: string, state: GoalState): string {
	return [
		userText.trim(),
		'',
		`Goal actif repris: ${sanitizeDisplayLine(state.condition)}`,
		'Continue le travail et produis la prochaine preuve vérifiable.',
	].join('\n')
}
