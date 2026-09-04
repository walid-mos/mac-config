import { Type } from 'typebox'

import { MAX_CONDITION_CHARS } from './contracts.ts'
import { errorMessage, formatStatus, kickoffPrompt } from './presentation.ts'
import { sanitizeDisplayLine } from './sanitize.ts'

import type { GoalState, GoalStatus } from './contracts.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

const CLEAR_ALIASES = new Set([
	'clear',
	'stop',
	'off',
	'reset',
	'none',
	'cancel',
])

export type GoalRegistrationAccess = {
	readonly active: () => GoalState | null
	readonly setGoal: (
		condition: string,
		context: ExtensionContext,
	) => GoalState
	readonly clearGoal: (context: ExtensionContext, status: GoalStatus) => void
	readonly rollbackGoalStart: (
		previous: GoalState | null,
		started: GoalState,
		context: ExtensionContext,
	) => void
	readonly armDispatch: (state: GoalState, context: ExtensionContext) => void
}

export function registerGoalInputs(
	pi: ExtensionAPI,
	access: GoalRegistrationAccess,
): void {
	pi.registerCommand('goal', {
		description:
			'Keep working toward a verifiable condition until it holds',
		getArgumentCompletions: prefix => {
			const hits = ['clear', 'status'].filter(item =>
				item.startsWith(prefix),
			)
			return hits.length
				? hits.map(value => ({ value, label: value }))
				: null
		},
		handler: async (args, context) => {
			const input = args.trim()
			if (!input || input === 'status') {
				context.ui.notify(formatStatus(access.active()), 'info')
				return
			}
			if (CLEAR_ALIASES.has(input)) {
				if (!access.active()) {
					context.ui.notify('No goal set', 'info')
					return
				}
				access.clearGoal(context, 'cleared')
				context.ui.notify('Goal cleared', 'info')
				return
			}
			try {
				const previous = access.active()
				const next = access.setGoal(input, context)
				try {
					access.armDispatch(next, context)
					pi.sendUserMessage(kickoffPrompt(next), {
						deliverAs: 'followUp',
						expandPromptTemplates: true,
					})
				} catch (error) {
					access.rollbackGoalStart(previous, next, context)
					throw error
				}
			} catch (error) {
				context.ui.notify(errorMessage(error), 'error')
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
		async execute(_toolCallId, params, _signal, _onUpdate, context) {
			const next = access.setGoal(params.condition, context)
			return {
				content: [
					{
						type: 'text',
						text: `Goal set: ${sanitizeDisplayLine(next.condition)}`,
					},
				],
			}
		},
	})
}
