import {
	DEFAULT_MAX_TURNS,
	GOAL_ENTRY_TYPE,
	MAX_CONDITION_CHARS,
	MAX_EVALUATOR_REASON_CHARS,
	MAX_TURNS,
	STUCK_NO_PROGRESS_TURNS,
} from './contracts.ts'
import {
	isRecord,
	isStringArray,
	normalizeBoundedText,
	normalizeProofs,
	updateProofLedger,
} from './values.ts'

import type {
	GoalLoopDecision,
	GoalState,
	GoalStatus,
	GoalTurnCounters,
	GoalVerdict,
	ParsedEvaluatorReply,
} from './contracts.ts'
import type { SessionEntry } from '@earendil-works/pi-coding-agent'

const GOAL_STATE_KEYS = new Set([
	'condition',
	'startedAt',
	'turnsEvaluated',
	'noProgressTurns',
	'maxTurns',
	'lastVerdict',
	'lastReason',
	'proofs',
	'status',
])

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

export function restoreActiveGoal(
	entries: readonly SessionEntry[],
): GoalState | null {
	let restored: GoalState | null = null
	for (const entry of entries) {
		if (entry.type !== 'custom' || entry.customType !== GOAL_ENTRY_TYPE)
			continue
		restored = restoreGoalState(entry.data)
	}
	return restored
}

export function restoreGoalState(value: unknown): GoalState | null {
	if (!isGoalState(value) || value.status !== 'active') return null
	return {
		condition: value.condition.trim(),
		startedAt: value.startedAt,
		turnsEvaluated: value.turnsEvaluated,
		noProgressTurns: value.noProgressTurns,
		maxTurns: value.maxTurns,
		lastVerdict: isGoalVerdict(value.lastVerdict)
			? value.lastVerdict
			: null,
		lastReason: normalizeBoundedText(
			value.lastReason,
			MAX_EVALUATOR_REASON_CHARS,
		),
		proofs: normalizeProofs(value.proofs),
		status: 'active',
	}
}

function isGoalState(value: unknown): value is GoalState {
	if (!isRecord(value)) return false
	const keys = Object.keys(value)
	if (
		keys.length !== GOAL_STATE_KEYS.size ||
		keys.some(key => !GOAL_STATE_KEYS.has(key))
	)
		return false
	return (
		isCondition(value.condition) &&
		isTimestamp(value.startedAt) &&
		isCounter(value.turnsEvaluated) &&
		isCounter(value.noProgressTurns) &&
		isMaxTurns(value.maxTurns) &&
		typeof value.lastReason === 'string' &&
		isStringArray(value.proofs) &&
		isGoalStatus(value.status)
	)
}

function isCondition(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.trim().length > 0 &&
		value.trim().length <= MAX_CONDITION_CHARS
	)
}

function isTimestamp(value: unknown): value is string {
	return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isCounter(value: unknown): value is number {
	return (
		typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
	)
}

function isMaxTurns(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 1 &&
		value <= MAX_TURNS
	)
}

function isGoalVerdict(value: unknown): value is GoalVerdict {
	return (
		value === 'met' ||
		value === 'not_yet' ||
		value === 'impossible' ||
		value === 'stuck'
	)
}

function isGoalStatus(value: unknown): value is GoalStatus {
	return (
		value === 'active' ||
		value === 'paused' ||
		value === 'met' ||
		value === 'impossible' ||
		value === 'cleared' ||
		value === 'stuck'
	)
}
