/**
 * /goal — session-scoped completion loop.
 *
 * /goal <condition>  set (replaces) and start working
 * /goal              status
 * /goal clear        clear (aliases: stop, off, reset, none, cancel)
 */
import { Type } from 'typebox'

import { GoalChrome } from './goal/chrome.ts'
import { GOAL_ENTRY_TYPE, MAX_CONDITION_CHARS } from './goal/contracts.ts'
import { judgeCondition } from './goal/evaluator.ts'
import {
	enactGoalDecision,
	errorMessage,
	formatStatus,
	kickoffPrompt,
} from './goal/presentation.ts'
import {
	createGoal,
	decideEvaluatedGoal,
	nextGoalState,
	restoreActiveGoal,
} from './goal/state.ts'
import { collectTranscriptExcerpt } from './goal/transcript.ts'

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
export { updateProofLedger } from './goal/values.ts'
export {
	decideEvaluatedGoal,
	isTurnCapReached,
	restoreGoalState,
} from './goal/state.ts'
export { countCurrentTurnToolCalls } from './goal/transcript.ts'

const CLEAR_ALIASES = new Set([
	'clear',
	'stop',
	'off',
	'reset',
	'none',
	'cancel',
])

export default function goalExtension(pi: ExtensionAPI): void {
	let active: GoalState | null = null
	let evaluation: AbortController | null = null
	const chrome = new GoalChrome()

	function cancelEvaluation(): void {
		evaluation?.abort()
		evaluation = null
	}

	function persist(state: GoalState): void {
		pi.appendEntry(GOAL_ENTRY_TYPE, state)
	}

	function setGoal(condition: string, ctx: ExtensionContext): GoalState {
		const next = createGoal(condition)
		cancelEvaluation()
		persist(next)
		active = next
		chrome.render(ctx, next)
		ctx.ui.notify(`Goal set: ${next.condition}`, 'info')
		return next
	}

	function clearGoal(ctx: ExtensionContext, status: GoalStatus): void {
		if (!active) return
		cancelEvaluation()
		const closed: GoalState = { ...active, status }
		persist(closed)
		active = status === 'cleared' ? null : closed
		chrome.render(ctx, active)
	}

	pi.registerCommand('goal', {
		description:
			'Keep working toward a verifiable condition until it holds',
		getArgumentCompletions: prefix => {
			const hits = ['clear', 'status'].filter(item =>
				item.startsWith(prefix),
			)
			return hits.length > 0
				? hits.map(value => ({ value, label: value }))
				: null
		},
		handler: async (args, ctx) => {
			const input = args.trim()
			if (!input || input === 'status') {
				ctx.ui.notify(formatStatus(active), 'info')
				return
			}
			if (CLEAR_ALIASES.has(input.split(/\s+/u)[0] ?? '')) {
				if (!active || active.status !== 'active') {
					ctx.ui.notify('No goal set', 'info')
					return
				}
				clearGoal(ctx, 'cleared')
				ctx.ui.notify('Goal cleared', 'info')
				return
			}
			try {
				const next = setGoal(input, ctx)
				pi.sendUserMessage(kickoffPrompt(next), {
					expandPromptTemplates: true,
				})
			} catch (error: unknown) {
				ctx.ui.notify(errorMessage(error), 'error')
			}
		},
	})

	pi.registerTool({
		name: 'goal_set',
		label: 'Goal Set',
		description:
			'Set (or replace) the active /goal condition so the loop auto-continues across turns. Call when the user asks for goal-driven work ("travaille jusqu\'à", "jusqu\'à ce que les tests passent") or before starting substantial verifiable work.',
		promptSnippet: 'Set a goal condition for auto-continue across turns',
		promptGuidelines: [
			'Use goal_set to engage the /goal auto-continue loop; the condition must be provable from command outputs, not declarations.',
		],
		parameters: Type.Object({
			condition: Type.String({
				minLength: 1,
				maxLength: MAX_CONDITION_CHARS,
				description: 'Verifiable condition for the auto-continue loop',
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const next = setGoal(params.condition, ctx)
			return {
				content: [
					{ type: 'text', text: `Goal set: ${next.condition}` },
				],
			}
		},
	})

	pi.on('session_start', async (_event, ctx) => {
		cancelEvaluation()
		active = restoreActiveGoal(ctx.sessionManager.getEntries())
		chrome.render(ctx, active)
	})

	pi.on('session_shutdown', async (_event, ctx) => {
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
			const excerpt = collectTranscriptExcerpt(
				ctx.sessionManager.getBranch(),
			)
			const counters = {
				turnsEvaluated: current.turnsEvaluated + 1,
				noToolTurns:
					excerpt.toolCallCount > 0 ? 0 : current.noToolTurns + 1,
			}
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
			const decision = decideEvaluatedGoal(current, counters, judged)
			const next = nextGoalState(current, counters, decision)
			persist(next)
			active = next
			chrome.render(ctx, next)
			enactGoalDecision(pi, ctx, next, decision)
		} finally {
			if (evaluation === controller) evaluation = null
		}
	})
}
