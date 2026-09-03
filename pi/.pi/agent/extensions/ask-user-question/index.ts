/**
 * Ask User Question Tool - OMP-style AskUserQuestion
 *
 * Features:
 * - Single or multiple questions (chip tab bar navigation)
 * - Options with descriptions + optional "★ recommended" badge
 * - Radio ◉/○ markers for single-select, ☑/☐ checkboxes for multi-select
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
 * Visual language: every surface — the interactive dialog, the pending call
 * preview and the verbose answer replay — renders as a rounded Catppuccin
 * block built on the shared design-system frame primitives, like json-view
 * and mutation-view. The pending preview collapses once answers arrive, so
 * the transcript shows exactly one block per tool call, OMP-style.
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
import {
	renderCallLines,
	renderResultLines,
} from './questionnaire-transcript.ts'
import { AskParams } from './schema.ts'

import type {
	AskResult,
	QuestionnaireInitialState,
} from './questionnaire-model.ts'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import type { Component } from '@earendil-works/pi-tui'

/** Width-aware component: builds its ANSI lines at the actual viewport
 * width, unlike Text which is constructed from a fixed string. */
class FrameComponent implements Component {
	private build: (width: number) => string[]

	constructor(build: (width: number) => string[]) {
		this.build = build
	}

	setBuilder(build: (width: number) => string[]): void {
		this.build = build
	}

	render(width: number): string[] {
		return this.build(Math.max(1, Math.floor(width)))
	}
}

function reusableFrame(
	build: (width: number) => string[],
	previous: unknown,
): Component {
	if (previous instanceof FrameComponent) {
		previous.setBuilder(build)
		return previous
	}
	return new FrameComponent(build)
}

function reusableText(content: string, previous: unknown): Text {
	const component = previous instanceof Text ? previous : new Text('', 0, 0)
	component.setText(content)
	return component
}

function isAskResult(details: unknown): details is AskResult {
	if (typeof details !== 'object' || details === null) return false
	const record = details as Record<string, unknown>
	return (
		typeof record.cancelled === 'boolean' &&
		Array.isArray(record.answers) &&
		Array.isArray(record.questions)
	)
}

export default function askUserQuestion(pi: ExtensionAPI) {
	const pendingResumeStates = new Map<string, QuestionnaireInitialState>()
	pi.on('session_shutdown', () => pendingResumeStates.clear())

	pi.registerTool({
		name: 'ask_user_question',
		label: 'Ask User Question',
		description:
			'Ask the user one or more questions with selectable options in interactive TUI mode. ALWAYS prefer this tool over questions in plain text; if TUI is unavailable, stop and report that clarification requires it. Group related questions in one call. The user can pick options (number keys), select multiple when multiSelect is true, or type a custom answer. Mark the best option with recommended: true when you have a preference. Omit options entirely for open-ended questions and do not suggest answers. If the user cancels, choose the most reasonable default and report that choice.',
		parameters: AskParams,
		executionMode: 'sequential',
		// The tool draws its own framed block; no default shell card.
		renderShell: 'self',

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

		renderCall(args, _theme, context) {
			// Shared per-tool-row state written by renderResult below: once
			// answers exist, the preview collapses and the replay frame alone
			// represents the call.
			const state = context.state as { answered?: boolean }
			if (state.answered) {
				return reusableFrame(() => [], context.lastComponent)
			}
			return reusableFrame(
				width => renderCallLines(args, width),
				context.lastComponent,
			)
		},

		renderResult(result, _options, _theme, context) {
			const state = context.state as { answered?: boolean }
			if (!state.answered) {
				state.answered = true
				// Collapse the pending preview on the next display pass; the
				// replay frame below is the single block for this call.
				// Async on purpose: a synchronous invalidate would re-enter
				// the in-flight updateDisplay and render the replay twice.
				queueMicrotask(() => context.invalidate())
			}
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
			return reusableFrame(
				width => renderResultLines(details, width),
				context.lastComponent,
			)
		},
	})
}
