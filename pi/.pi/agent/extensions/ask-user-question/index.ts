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
 * Structure: schema.ts (tool params + normalization) / questionnaire-state.ts
 * (pure state machine) / questionnaire-render.ts (pure renderer) /
 * questionnaire-component.ts (TUI wiring). Based on the official pi
 * questionnaire.ts example.
 */

import { Text } from '@earendil-works/pi-tui'

import { runQuestionnaire } from './questionnaire-component'
import { AskParams, normalizeQuestions } from './schema'

import type {
	Answer,
	AskResult,
	Question,
	QuestionnaireInitialState,
} from './questionnaire-model'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

type ToolText = {
	content: { type: 'text'; text: string }[]
	details: AskResult
}

function errorResult(message: string): ToolText {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions: [], answers: [], cancelled: true },
	}
}

function formatAnswerLine(qLabel: string, a: Answer): string {
	if (a.wasCustom) return `${qLabel}: user wrote: ${a.label}`
	if (a.kind === 'multi' && a.labels.length > 1)
		return `${qLabel}: user selected multiple: ${a.labels.join(', ')}`
	const prefix =
		a.kind === 'single' && a.index !== undefined ? `${a.index}. ` : ''
	return `${qLabel}: user selected: ${prefix}${a.label}`
}

function questionnaireKey(questions: Question[]): string {
	return JSON.stringify(
		questions.map(question => ({
			id: question.id,
			label: question.label,
			prompt: question.prompt,
			options: question.options.map(option => ({
				value: option.value,
				label: option.label,
				description: option.description,
				recommended: option.recommended,
			})),
			allowOther: question.allowOther,
			multiSelect: question.multiSelect,
		})),
	)
}

function chatFollowUp(question: Question): string {
	return [
		`The user wants to chat about the question "${question.label}": ${question.prompt}`,
		'Discuss it with the user. When they are ready to answer, call ask_user_question again with the same questionnaire to resume their saved responses.',
	].join('\n')
}

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

	pi.registerTool({
		name: 'ask_user_question',
		label: 'Ask User Question',
		description:
			'Ask the user one or more questions with selectable options. ALWAYS prefer this tool over asking questions in plain text when the choices are discrete: clarifying requirements, choosing between approaches, confirming decisions, or getting preferences. The user can pick options (number keys), select multiple when multiSelect is true, or type a custom answer. Mark the best option with recommended: true when you have a preference. Omit options entirely for open-ended questions where you want a free-form answer.',
		parameters: AskParams,
		executionMode: 'sequential',

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (ctx.mode !== 'tui') {
				return errorResult(
					'Error: UI not available (running in non-interactive mode)',
				)
			}
			if (params.questions.length === 0) {
				return errorResult('Error: No questions provided')
			}

			const questions: Question[] = normalizeQuestions(params.questions)
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

			const answerLines = result.answers.map(a => {
				const qLabel = questions.find(q => q.id === a.id)?.label ?? a.id
				return formatAnswerLine(qLabel, a)
			})

			return {
				content: [{ type: 'text', text: answerLines.join('\n') }],
				details: result,
			}
		},

		renderCall(args, theme, _context) {
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
			return new Text(text, 0, 0)
		},

		renderResult(result, _options, theme, _context) {
			const details = isAskResult(result.details)
				? result.details
				: undefined
			if (!details) {
				const text = result.content[0]
				return new Text(text?.type === 'text' ? text.text : '', 0, 0)
			}
			if (details.cancelled) {
				return new Text(theme.fg('warning', 'Cancelled'), 0, 0)
			}
			if (details.chat) {
				return new Text(theme.fg('muted', 'Chat paused'), 0, 0)
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
			return new Text(lines.join('\n'), 0, 0)
		},
	})
}
