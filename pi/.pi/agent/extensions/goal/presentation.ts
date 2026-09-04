import { formatElapsed } from './chrome.ts'
import { sanitizeDisplayLine } from './sanitize.ts'

import type { GoalLoopDecision, GoalState } from './contracts.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

export const GOAL_KICKOFF_PROMPT_PREFIX = '/skill:goal'
export const GOAL_CONTINUE_PROMPT_PREFIX = 'Goal toujours actif:'

export function enactGoalDecision(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	next: GoalState,
	decision: GoalLoopDecision,
	onDispatch?: () => void,
): string | null {
	if (decision.action === 'continue') {
		try {
			onDispatch?.()
			pi.sendUserMessage(continuePrompt(next), { deliverAs: 'followUp' })
		} catch (error: unknown) {
			return errorMessage(error)
		}
		ctx.ui.notify(
			`◎ goal not yet: ${sanitizeDisplayLine(decision.reason)}`,
			'info',
		)
		return null
	}
	if (decision.action === 'pause') {
		ctx.ui.notify(
			`Goal paused: ${sanitizeDisplayLine(decision.reason)}`,
			'warning',
		)
		return null
	}
	ctx.ui.notify(
		`Goal ${decision.verdict}: ${sanitizeDisplayLine(decision.reason)}`,
		decision.verdict === 'met' ? 'info' : 'warning',
	)
	return null
}

export function formatStatus(state: GoalState | null): string {
	if (!state) return 'No goal set'
	const reason = state.lastReason
		? `\nLast: ${sanitizeDisplayLine(state.lastReason)}`
		: ''
	const durationLabel = state.status === 'active' ? 'Running' : 'Elapsed'
	return [
		`Goal (${state.status}): ${sanitizeDisplayLine(state.condition)}`,
		`${durationLabel} ${formatElapsed(state.startedAt)}, ${state.turnsEvaluated} evaluated turns, cap ${state.maxTurns}`,
		reason,
	]
		.filter(Boolean)
		.join('\n')
}

export function kickoffPrompt(state: GoalState): string {
	return [
		GOAL_KICKOFF_PROMPT_PREFIX,
		'',
		`Goal actif: ${sanitizeDisplayLine(state.condition)}`,
		'',
		"Travaille jusqu'à ce que la condition soit prouvée dans le transcript.",
		'Ne demande rien. Un step vérifiable par tour.',
	].join('\n')
}

function continuePrompt(state: GoalState): string {
	return [
		`${GOAL_CONTINUE_PROMPT_PREFIX} ${sanitizeDisplayLine(state.condition)}`,
		'Dernier verdict: not_yet.',
		`Tours évalués: ${state.turnsEvaluated}/${state.maxTurns}.`,
		'Continue. Ne demande rien. Prouve la condition par une sortie de commande.',
	].join('\n')
}

export function errorMessage(error: unknown): string {
	return sanitizeDisplayLine(
		error instanceof Error ? error.message : 'Unable to set goal.',
	)
}
