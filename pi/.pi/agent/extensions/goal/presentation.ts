import { formatElapsed } from './chrome.ts'

import type { GoalLoopDecision, GoalState } from './contracts.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

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
	return [
		`Goal (${state.status}): ${state.condition}`,
		`Running ${formatElapsed(state.startedAt)}, ${state.turnsEvaluated} evaluated turns, cap ${state.maxTurns}`,
		reason,
	]
		.filter(Boolean)
		.join('\n')
}

export function kickoffPrompt(state: GoalState): string {
	return [
		'/skill:goal',
		'',
		`Goal actif: ${state.condition}`,
		'',
		"Travaille jusqu'à ce que la condition soit prouvée dans le transcript.",
		'Ne demande rien. Un step vérifiable par tour.',
	].join('\n')
}

function continuePrompt(state: GoalState): string {
	return [
		`Goal toujours actif: ${state.condition}`,
		`Dernier verdict: not_yet — ${state.lastReason}`,
		`Tours évalués: ${state.turnsEvaluated}/${state.maxTurns}.`,
		'Continue. Ne demande rien. Prouve la condition par une sortie de commande.',
	].join('\n')
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unable to set goal.'
}
