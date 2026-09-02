/**
 * Ask User Question Tool - Claude Code style AskUserQuestion, enhanced
 *
 * Features:
 * - Single or multiple questions (tab bar navigation like CC headers)
 * - Options with descriptions + optional "(recommended)" badge
 * - Number keys 1-9 for instant selection
 * - multiSelect per question (Space to toggle, Enter to confirm)
 * - Claude Code style inline input: landing on "Type something." replaces the row
 *   with the editor, rendered at the exact same indentation as any other option
 * - ↑/↓ move the cursor inside the input, and leave it at the buffer's edges
 *   (empty input: ↑ leaves immediately); Esc jumps back to the first option
 * - Single-select submits in one Enter from the editor; multiSelect combines
 *   checked options with the typed text in a single Enter
 * - Open-ended questions: omit options to show only a free-text editor
 * - Cursor pre-positioned on the recommended option
 * - Free-text drafts preserved when navigating between tabs
 * - Review/submit screen for multi-question flows
 *
 * Structure: schema/normalization at the boundary, focused navigation and
 * response state, pure render modules, input routing, and thin TUI wiring.
 * Based on the official Pi questionnaire example.
 */

import { Text } from '@earendil-works/pi-tui'

import { runQuestionnaire } from './questionnaire-component.ts'
import { normalizeQuestions } from './questionnaire-normalization.ts'
import {
	chatFollowUp,
	formatAnswerLines,
	questionnaireKey,
} from './questionnaire-output.ts'
import { AskParams } from './schema.ts'

import type {
	AskResult,
	QuestionnaireInitialState,
} from './questionnaire-model.ts'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

/** Narrow surface actually read from the raw call args (renderCall runs on
 * unvalidated input — verify, don't force). */
type CallArgs = { questions?: { id: string; label?: string }[] }

function isCallArgs(args: unknown): args is CallArgs {
	if (typeof args !== 'object' || args === null) return false
	if (!('questions' in args)) return true
	const { questions } = args
	if (questions === undefined) return true
	return (
		Array.isArray(questions) &&
		questions.every(
			(q: unknown) =>
				typeof q === 'object' &&
				q !== null &&
				'id' in q &&
				typeof (q as { id: unknown }).id === 'string',
		)
	)
}

function reusableText(content: string, previous: unknown): Text {
	const component = previous instanceof Text ? previous : new Text('', 0, 0)
	component.setText(content)
	return component
}

function isAskResult(details: unknown): details is AskResult {
	if (typeof details !== 'object' || details === null) return false
	if (
		!('cancelled' in details) ||
		typeof (details as { cancelled: unknown }).cancelled !== 'boolean'
	)
		return false
	if (
		!('answers' in details) ||
		!Array.isArray((details as { answers: unknown }).answers)
	)
		return false
	return true
}

export default function askUserQuestion(pi: ExtensionAPI) {
	const pendingResumeStates = new Map<string, QuestionnaireInitialState>()
	pi.on('session_shutdown', () => pendingResumeStates.clear())

	pi.registerTool({
		name: 'ask_user_question',
		label: 'Ask User Question',
		description:
			'Ask the user one or more questions with selectable options. ALWAYS prefer this tool over asking questions in plain text when the choices are discrete: clarifying requirements, choosing between approaches, confirming decisions, or getting preferences. The user can pick options (number keys), select multiple when multiSelect is true, or type a custom answer. Mark the best option with recommended: true when you have a preference. Omit options entirely for open-ended questions where you want a free-form answer.',
		parameters: AskParams,
		executionMode: 'sequential',

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (ctx.mode !== 'tui') {
				throw new Error(
					'ask_user_question requires interactive TUI mode',
				)
			}

			const questions = normalizeQuestions(params.questions)
			const key = questionnaireKey(questions)
			const result = await runQuestionnaire(
				factory => ctx.ui.custom(factory),
				questions,
				pendingResumeStates.get(key),
			)

			if (result.chat) {
				pendingResumeStates.set(key, result.chat.initialState)
				await pi.sendUserMessage(chatFollowUp(result.chat.question), {
					deliverAs: 'followUp',
				})
				return {
					content: [{ type: 'text', text: 'Chat paused' }],
					details: result,
					terminate: true,
				}
			}

			pendingResumeStates.delete(key)
			if (result.cancelled) {
				return {
					content: [
						{ type: 'text', text: 'User cancelled the question' },
					],
					details: result,
				}
			}

			return {
				content: [
					{
						type: 'text',
						text: formatAnswerLines(questions, result.answers),
					},
				],
				details: result,
			}
		},

		renderCall(args, theme, context) {
			const qs = isCallArgs(args) ? (args.questions ?? []) : []
			const labels = qs.map(q => q.label ?? q.id).join(', ')
			let text = theme.fg('toolTitle', theme.bold('ask_user_question '))
			text += theme.fg(
				'muted',
				`${qs.length} question${qs.length !== 1 ? 's' : ''}`,
			)
			if (labels) {
				text += theme.fg('dim', ` (${labels})`)
			}
			return reusableText(text, context.lastComponent)
		},

		renderResult(result, _options, theme, context) {
			const details = isAskResult(result.details)
				? result.details
				: undefined
			if (!details) {
				const text = result.content[0]
				return reusableText(
					text?.type === 'text' ? text.text : '',
					context.lastComponent,
				)
			}
			if (details.cancelled) {
				return reusableText(
					theme.fg('warning', 'Cancelled'),
					context.lastComponent,
				)
			}
			if (details.chat) {
				return reusableText(
					theme.fg('muted', 'Chat paused'),
					context.lastComponent,
				)
			}
			const lines = details.answers.map(a => {
				if (a.wasCustom) {
					return `${theme.fg('success', '✓ ')}${theme.fg('accent', a.id)}: ${theme.fg('muted', '(wrote) ')}${a.label}`
				}
				const display =
					a.kind === 'multi' && a.labels.length > 1
						? a.labels.join(', ')
						: a.kind === 'single' && a.index !== undefined
							? `${a.index}. ${a.label}`
							: a.label
				return `${theme.fg('success', '✓ ')}${theme.fg('accent', a.id)}: ${display}`
			})
			return reusableText(lines.join('\n'), context.lastComponent)
		},
	})
}
