import {
	GOAL_ENTRY_TYPE,
	MAX_CONDITION_CHARS,
	MAX_EVALUATOR_REASON_CHARS,
	MAX_TURNS,
} from './contracts.ts'
import {
	isRecord,
	isStringArray,
	normalizeBoundedText,
	normalizeProofs,
} from './values.ts'

import type { GoalState, GoalStatus, GoalVerdict } from './contracts.ts'
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

function normalizedGoalState(value: unknown): GoalState | null {
	if (!isGoalState(value)) return null
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
		status: value.status,
	}
}

export function restoreGoalState(value: unknown): GoalState | null {
	const restored = normalizedGoalState(value)
	return restored && isResumableStatus(restored.status) ? restored : null
}

export function restoreResumableGoal(
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

function isResumableStatus(status: GoalStatus): boolean {
	return status === 'active' || status === 'paused' || status === 'stuck'
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
