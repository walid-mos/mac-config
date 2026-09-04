/**
 * Correlate /goal pause and resume with blocking user prompts.
 *
 * Persist an active goal as paused at ui_prompt_start so evaluation cannot
 * continue during interaction. Only a successful ask_user_question result
 * auto-resumes, when the current assistant run consumes that result.
 */
import { isGoalResumeIntent, resumedGoalPrompt, resumeGoal } from './resume.ts'
import { isRecord } from './values.ts'

import type { GoalChrome } from './chrome.ts'
import type { GoalState } from './contracts.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolResultEvent,
} from '@earendil-works/pi-coding-agent'

const USER_INPUT_PAUSE_REASON = 'Goal paused: waiting for user input.'

export type GoalUserPauseAccess = {
	readonly active: () => GoalState | null
	readonly setActive: (state: GoalState) => void
	readonly pauseGoal: (
		current: GoalState,
		reason: string,
		ctx: ExtensionContext,
	) => void
	readonly persist: (state: GoalState) => void
	readonly chrome: GoalChrome
}

function isAskUserQuestionDetails(details: unknown): details is {
	readonly questions: unknown[]
	readonly answers: unknown[]
	readonly cancelled: boolean
	readonly chat?: unknown
} {
	return (
		isRecord(details) &&
		Array.isArray(details.questions) &&
		Array.isArray(details.answers) &&
		typeof details.cancelled === 'boolean'
	)
}

function isSuccessfulAskUserQuestion(event: ToolResultEvent): boolean {
	if (event.toolName !== 'ask_user_question' || event.isError) return false
	if (!isAskUserQuestionDetails(event.details)) return false
	return (
		event.details.cancelled === false &&
		event.details.chat === undefined &&
		event.details.answers.length > 0
	)
}

function isInterrupted(state: GoalState): boolean {
	return state.status === 'paused' || state.status === 'stuck'
}

export function bindGoalUserPause(
	pi: ExtensionAPI,
	access: GoalUserPauseAccess,
): { readonly reset: () => void } {
	let pending = false

	function reset(): void {
		pending = false
	}

	function applyResume(current: GoalState, ctx: ExtensionContext): GoalState {
		pending = false
		const resumed = resumeGoal(current)
		access.persist(resumed)
		access.setActive(resumed)
		access.chrome.render(ctx, resumed)
		ctx.ui.notify('Goal resumed', 'info')
		return resumed
	}

	pi.on('ui_prompt_start', (_event, ctx) => {
		const current = access.active()
		if (!current) return
		if (current.status === 'active') {
			access.pauseGoal(current, USER_INPUT_PAUSE_REASON, ctx)
			pending = true
			return
		}
		if (
			isInterrupted(current) &&
			current.lastReason === USER_INPUT_PAUSE_REASON
		) {
			pending = true
		}
	})

	pi.on('tool_result', (event, ctx) => {
		if (!pending) return
		pending = false
		if (!isSuccessfulAskUserQuestion(event)) return
		const current = access.active()
		if (!current || !isInterrupted(current)) return
		applyResume(current, ctx)
	})

	pi.on('input', (event, ctx) => {
		const current = access.active()
		if (
			event.source === 'extension' ||
			!current ||
			!isInterrupted(current) ||
			!isGoalResumeIntent(event.text)
		)
			return { action: 'continue' }
		const resumed = applyResume(current, ctx)
		return {
			action: 'transform',
			text: resumedGoalPrompt(event.text, resumed),
		}
	})

	return { reset }
}
