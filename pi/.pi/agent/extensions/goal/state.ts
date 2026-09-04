import {
	DEFAULT_MAX_TURNS,
	MAX_CONDITION_CHARS,
	MAX_TURNS,
	STUCK_NO_PROGRESS_TURNS,
} from './contracts.ts'
import { updateProofLedger } from './values.ts'

import type {
	GoalLoopDecision,
	GoalState,
	GoalTurnCounters,
	ParsedEvaluatorReply,
} from './contracts.ts'
export function createGoal(condition: string): GoalState {
	const normalized = condition.trim()
	if (!normalized) throw new Error('Goal condition must not be empty.')
	if (normalized.length > MAX_CONDITION_CHARS)
		throw new Error(
			`Condition too long (${normalized.length} > ${MAX_CONDITION_CHARS})`,
		)
	return {
		condition: normalized,
		startedAt: new Date().toISOString(),
		turnsEvaluated: 0,
		noProgressTurns: 0,
		maxTurns: parseMaxTurns(normalized),
		lastVerdict: null,
		lastReason: '',
		proofs: [],
		status: 'active',
	}
}

function parseMaxTurns(condition: string): number {
	const match = condition.match(/stop after (\d+) turns?/i)
	if (!match) return DEFAULT_MAX_TURNS
	const parsed = Number(match[1])
	if (!Number.isSafeInteger(parsed) || parsed < 1) return DEFAULT_MAX_TURNS
	return Math.min(parsed, MAX_TURNS)
}

export function isTurnCapReached(
	turnsEvaluated: number,
	maxTurns: number,
): boolean {
	return turnsEvaluated >= maxTurns
}

export function decideEvaluatedGoal(
	current: GoalState,
	counters: GoalTurnCounters,
	judged: ParsedEvaluatorReply,
): GoalLoopDecision {
	if (!judged.ok) return { action: 'pause', reason: judged.reason }
	const proofs = updateProofLedger(
		current.proofs,
		judged.proofs,
		judged.invalidatedProofs,
	)
	if (judged.verdict === 'met' && proofs.length === 0) {
		return {
			action: 'pause',
			reason: 'Evaluator returned met without verified proofs.',
			proofs,
		}
	}
	if (judged.verdict !== 'not_yet') {
		return {
			action: 'stop',
			verdict: judged.verdict,
			reason: judged.reason,
			proofs,
		}
	}
	if (isTurnCapReached(counters.turnsEvaluated, current.maxTurns)) {
		return {
			action: 'stop',
			verdict: 'stuck',
			reason: `Turn cap reached (${current.maxTurns}).`,
			proofs,
		}
	}
	if (counters.noProgressTurns >= STUCK_NO_PROGRESS_TURNS) {
		return {
			action: 'stop',
			verdict: 'stuck',
			reason: `No verifiable proof progress for ${counters.noProgressTurns} turns.`,
			proofs,
		}
	}
	return { action: 'continue', reason: judged.reason, proofs }
}

export function nextGoalState(
	current: GoalState,
	counters: GoalTurnCounters,
	decision: GoalLoopDecision,
): GoalState {
	if (decision.action === 'pause') {
		return {
			...current,
			...counters,
			lastReason: decision.reason,
			proofs: decision.proofs ?? current.proofs,
			status: 'paused',
		}
	}
	if (decision.action === 'continue') {
		return {
			...current,
			...counters,
			lastVerdict: 'not_yet',
			lastReason: decision.reason,
			proofs: decision.proofs,
			status: 'active',
		}
	}
	return {
		...current,
		...counters,
		lastVerdict: decision.verdict,
		lastReason: decision.reason,
		proofs: decision.proofs ?? current.proofs,
		status: decision.verdict,
	}
}
