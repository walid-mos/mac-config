import { GoalChrome } from './goal/chrome.ts'
import { GOAL_ENTRY_TYPE } from './goal/contracts.ts'
import { GoalDispatchWatchdog } from './goal/dispatch-watchdog.ts'
import { judgeCondition } from './goal/evaluator.ts'
import { enactGoalDecision } from './goal/presentation.ts'
import { registerGoalInputs } from './goal/registration.ts'
import { restoreResumableGoal } from './goal/restoration.ts'
import {
	isGoalResumeIntent,
	resumedGoalPrompt,
	resumeGoal,
} from './goal/resume.ts'
/**
 * /goal — session-scoped completion loop.
 *
 * /goal <condition>  set (replaces) and start working
 * /goal              status
 * /goal clear        clear (aliases: stop, off, reset, none, cancel)
 */
import { sanitizeDisplayLine } from './goal/sanitize.ts'
import { createGoal, decideEvaluatedGoal, nextGoalState } from './goal/state.ts'
import {
	collectTranscriptExcerpt,
	settledTurnFailure,
} from './goal/transcript.ts'
import { hasProofLedgerProgress } from './goal/values.ts'

import type { GoalState, GoalStatus } from './goal/contracts.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

export { goalChromeLines, paintChrome } from './goal/chrome.ts'
export { parseEvaluatorText } from './goal/evaluation-reply.ts'
export {
	evaluateWithFallback,
	selectEvaluatorAttempts,
} from './goal/evaluator.ts'
export { restoreGoalState } from './goal/restoration.ts'
export { isGoalResumeIntent, resumeGoal } from './goal/resume.ts'
export { updateProofLedger } from './goal/values.ts'
export { decideEvaluatedGoal, isTurnCapReached } from './goal/state.ts'
export { countCurrentTurnToolCalls } from './goal/transcript.ts'

export default function goalExtension(pi: ExtensionAPI): void {
	let active: GoalState | null = null
	let evaluation: AbortController | null = null
	const chrome = new GoalChrome()
	const dispatchWatchdog = new GoalDispatchWatchdog()

	function cancelEvaluation(): void {
		evaluation?.abort()
		evaluation = null
	}

	function pauseGoal(
		current: GoalState,
		reason: string,
		ctx: ExtensionContext,
	): void {
		if (active !== current) return
		const paused: GoalState = {
			...current,
			lastVerdict: 'stuck',
			lastReason: reason,
			status: 'paused',
		}
		persist(paused)
		active = paused
		chrome.render(ctx, paused)
		ctx.ui.notify(reason, 'warning')
	}

	function armDispatch(state: GoalState, ctx: ExtensionContext): void {
		dispatchWatchdog.arm(() =>
			pauseGoal(state, 'Goal paused: continuation did not start.', ctx),
		)
	}

	function persist(state: GoalState): void {
		pi.appendEntry(GOAL_ENTRY_TYPE, state)
	}

	function setGoal(condition: string, ctx: ExtensionContext): GoalState {
		const next = createGoal(condition)
		dispatchWatchdog.cancel()
		cancelEvaluation()
		persist(next)
		active = next
		chrome.render(ctx, next)
		ctx.ui.notify(
			`Goal set: ${sanitizeDisplayLine(next.condition)}`,
			'info',
		)
		return next
	}

	function clearGoal(ctx: ExtensionContext, status: GoalStatus): void {
		if (!active) return
		dispatchWatchdog.cancel()
		cancelEvaluation()
		const closed: GoalState = { ...active, status }
		persist(closed)
		active = status === 'cleared' ? null : closed
		chrome.render(ctx, active)
	}

	function rollbackGoalStart(
		previous: GoalState | null,
		started: GoalState,
		ctx: ExtensionContext,
	): void {
		dispatchWatchdog.cancel()
		cancelEvaluation()
		persist(previous ?? { ...started, status: 'cleared' })
		active = previous
		chrome.render(ctx, previous)
	}

	registerGoalInputs(pi, {
		active: () => active,
		setGoal,
		clearGoal,
		rollbackGoalStart,
		armDispatch,
	})

	function restoreBranchGoal(ctx: ExtensionContext): void {
		dispatchWatchdog.cancel()
		cancelEvaluation()
		active = restoreResumableGoal(ctx.sessionManager.getBranch())
		chrome.render(ctx, active)
	}

	pi.on('input', (event, ctx) => {
		const current = active
		if (
			event.source === 'extension' ||
			!current ||
			(current.status !== 'paused' && current.status !== 'stuck') ||
			!isGoalResumeIntent(event.text)
		)
			return { action: 'continue' }
		const resumed = resumeGoal(current)
		persist(resumed)
		active = resumed
		chrome.render(ctx, resumed)
		ctx.ui.notify('Goal resumed', 'info')
		return {
			action: 'transform',
			text: resumedGoalPrompt(event.text, resumed),
		}
	})

	pi.on('session_start', async (_event, ctx) => {
		restoreBranchGoal(ctx)
	})

	pi.on('agent_start', async () => {
		dispatchWatchdog.started()
		cancelEvaluation()
	})

	pi.on('session_tree', async (_event, ctx) => {
		restoreBranchGoal(ctx)
	})

	pi.on('session_shutdown', async (_event, ctx) => {
		dispatchWatchdog.cancel()
		cancelEvaluation()
		active = null
		chrome.clear(ctx.ui)
	})

	pi.on('agent_settled', async (_event, ctx) => {
		const current = active
		if (!current || current.status !== 'active' || evaluation) return

		const controller = new AbortController()
		evaluation = controller
		try {
			const branch = ctx.sessionManager.getBranch()
			const turnFailure = settledTurnFailure(branch)
			if (turnFailure) {
				pauseGoal(current, turnFailure, ctx)
				return
			}
			const excerpt = collectTranscriptExcerpt(branch)
			const judged = await judgeCondition(
				ctx,
				current.condition,
				excerpt.text,
				current.proofs,
				controller.signal,
			)
			if (
				controller.signal.aborted ||
				evaluation !== controller ||
				active !== current
			)
				return
			const proofProgress =
				judged.ok &&
				hasProofLedgerProgress(
					current.proofs,
					judged.proofs,
					judged.invalidatedProofs,
				)
			const counters = {
				turnsEvaluated: current.turnsEvaluated + 1,
				noProgressTurns:
					excerpt.toolCallCount > 0 && proofProgress
						? 0
						: current.noProgressTurns + 1,
			}
			const decision = decideEvaluatedGoal(current, counters, judged)
			const next = nextGoalState(current, counters, decision)
			persist(next)
			active = next
			chrome.render(ctx, next)
			const dispatchError = enactGoalDecision(
				pi,
				ctx,
				next,
				decision,
				() => armDispatch(next, ctx),
			)
			if (dispatchError) {
				dispatchWatchdog.cancel()
				const stopped: GoalState = {
					...next,
					lastVerdict: 'stuck',
					lastReason: `Continuation failed: ${dispatchError}`,
					status: 'stuck',
				}
				persist(stopped)
				active = stopped
				chrome.render(ctx, stopped)
				ctx.ui.notify(stopped.lastReason, 'error')
			}
		} finally {
			if (evaluation === controller) evaluation = null
		}
	})
}
