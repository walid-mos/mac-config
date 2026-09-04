import type { ThinkingLevel } from './config.ts'
import type { Api, Model } from '@earendil-works/pi-ai'

export const GOAL_ENTRY_TYPE = 'goal-state'
export const MAX_CONDITION_CHARS = 4000
export const DEFAULT_MAX_TURNS = 25
export const MAX_TURNS = 100
export const STUCK_NO_TOOL_TURNS = 2
export const MAX_PROOF_ITEMS = 32
export const MAX_PROOF_ITEM_CHARS = 300
export const MAX_EVALUATOR_DIAGNOSTIC_CHARS = 500
export const MAX_EVALUATOR_MODEL_CHARS = 100
export const MAX_EVALUATOR_ATTEMPT_REASON_CHARS = 120
export const MAX_EVALUATOR_REASON_CHARS = 500
export const MAX_EVALUATOR_ATTEMPTS = 2
export const EVALUATOR_TIMEOUT_MS = 120_000

export type GoalVerdict = 'not_yet' | 'met' | 'impossible' | 'stuck'

export type GoalStatus = 'active' | 'met' | 'impossible' | 'cleared' | 'stuck'

export type EvaluatorModelIdentity = {
	readonly provider: string
	readonly id: string
}

export type EvaluatorAttempt = EvaluatorModelIdentity & {
	readonly model: Model<Api>
	readonly thinkingLevel: ThinkingLevel
}

export type ParsedEvaluatorReply =
	| {
			ok: true
			verdict: Exclude<GoalVerdict, 'stuck'>
			reason: string
			proofs: string[]
			invalidatedProofs: string[]
	  }
	| { ok: false; reason: string }

export type GoalTurnCounters = {
	turnsEvaluated: number
	noToolTurns: number
}

export type GoalLoopDecision =
	| { action: 'continue'; reason: string; proofs: string[] }
	| { action: 'pause'; reason: string }
	| {
			action: 'stop'
			verdict: Exclude<GoalVerdict, 'not_yet'>
			reason: string
			proofs?: string[]
	  }

export type GoalState = {
	condition: string
	startedAt: string
	/** Completed /goal cycles evaluated after the agent settles. */
	turnsEvaluated: number
	noToolTurns: number
	maxTurns: number
	lastVerdict: GoalVerdict | null
	lastReason: string
	/** Cumulative command/read-back facts retained when older transcript evidence is clipped. */
	proofs: string[]
	status: GoalStatus
}
