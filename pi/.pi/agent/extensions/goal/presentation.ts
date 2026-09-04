import { formatElapsed } from './chrome.ts'

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
): void {
	if (decision.action === 'continue') {
		ctx.ui.notify(`◎ goal not yet: ${decision.reason}`, 'info')
		pi.sendUserMessage(continuePrompt(next), { deliverAs: 'followUp' })
		return
	}
	if (decision.action === 'pause') {
		ctx.ui.notify(`Goal paused: ${decision.reason}`, 'warning')
		return
	}
	ctx.ui.notify(
		`Goal ${decision.verdict}: ${decision.reason}`,
		decision.verdict === 'met' ? 'info' : 'warning',
	)
}

export function formatStatus(state: GoalState | null): string {
	if (!state) return 'No goal set'
	const reason = state.lastReason ? `\nLast: ${state.lastReason}` : ''
	const durationLabel = state.status === 'active' ? 'Running' : 'Elapsed'
	return [
		`Goal (${state.status}): ${state.condition}`,
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
		`Goal actif: ${state.condition}`,
		'',
		"Travaille jusqu'à ce que la condition soit prouvée dans le transcript.",
		'Ne demande rien. Un step vérifiable par tour.',
	].join('\n')
}

function continuePrompt(state: GoalState): string {
	return [
		`${GOAL_CONTINUE_PROMPT_PREFIX} ${state.condition}`,
		`Dernier verdict: not_yet — ${state.lastReason}`,
		`Tours évalués: ${state.turnsEvaluated}/${state.maxTurns}.`,
		'Continue. Ne demande rien. Prouve la condition par une sortie de commande.',
	].join('\n')
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unable to set goal.'
}
