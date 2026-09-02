/**
 * The interactive questionnaire TUI component, run through ctx.ui.custom().
 * Thin wiring: keyboard input -> QuestionnaireState transitions -> effects
 * (render/advance/submit/cancel) applied against the TUI; rendering itself
 * lives in questionnaire-render.ts.
 */

import {
	type Component,
	Editor,
	type EditorTheme,
	type Focusable,
	type TUI,
} from '@earendil-works/pi-tui'

import {
	QuestionnaireInputController,
	type SelectionKeybindings,
} from './questionnaire-input.ts'
import { renderQuestionnaire } from './questionnaire-render.ts'
import { createQuestionnairePalette } from './questionnaire-theme.ts'
import {
	type EditorPort,
	type QuestionnaireEffect,
	QuestionnaireState,
} from './questionnaire-state.ts'

import type {
	AskResult,
	Question,
	QuestionnaireInitialState,
} from './questionnaire-model.ts'
import type { QuestionnairePalette } from './questionnaire-render.ts'

interface CustomComponent extends Component, Focusable {
	handleInput(data: string): void
}

type CustomFactory<T> = (
	tui: TUI,
	theme: QuestionnairePalette,
	keybindings: SelectionKeybindings,
	done: (result: T) => void,
) => CustomComponent

export function runQuestionnaire(
	custom: <T>(factory: CustomFactory<T>) => Promise<T>,
	questions: Question[],
	initialState?: QuestionnaireInitialState,
): Promise<AskResult> {
	return custom<AskResult>((tui, _theme, keybindings, done) => {
		// House tokens only: the interactive dialog matches the transcript
		// frames, regardless of the runtime theme.
		const theme = createQuestionnairePalette()
		const editorTheme: EditorTheme = {
			borderColor: s => theme.fg('accent', s),
			selectList: {
				selectedPrefix: t => theme.fg('accent', t),
				selectedText: t => theme.fg('accent', t),
				description: t => theme.fg('muted', t),
				scrollInfo: t => theme.fg('dim', t),
				noMatch: t => theme.fg('warning', t),
			},
		}
		const editor = new Editor(tui, editorTheme, { paddingX: 0 })
		const editorPort: EditorPort = {
			getText: () => editor.getText(),
			setText: text => editor.setText(text),
		}
		const state = new QuestionnaireState(
			questions,
			editorPort,
			initialState,
		)

		let cachedLines: string[] | undefined
		let cachedWidth: number | undefined

		function refresh(): void {
			cachedLines = undefined
			cachedWidth = undefined
			tui.requestRender()
		}

		function finish(cancelled: boolean): void {
			done({ questions, answers: state.collectedAnswers(), cancelled })
		}

		function finishChat(): void {
			const chat = state.chatRequest()
			if (chat)
				done({
					questions,
					answers: state.collectedAnswers(),
					cancelled: false,
					chat,
				})
		}

		function switchTab(delta: -1 | 1): void {
			state.enterTab(
				(state.tab + delta + state.totalTabs) % state.totalTabs,
			)
			refresh()
		}

		function applyEffects(effects: QuestionnaireEffect[]): void {
			for (const effect of effects) {
				applyEffect(effect)
				if (
					effect === 'submit' ||
					effect === 'cancel' ||
					effect === 'chat'
				)
					return // terminal
			}
		}

		function applyEffect(effect: QuestionnaireEffect): void {
			switch (effect) {
				case 'render':
					refresh()
					return
				case 'advance': {
					const target = state.advanceTarget()
					if (target === 'submit') finish(false)
					else {
						state.enterTab(target)
						refresh()
					}
					return
				}
				case 'submit':
					finish(false)
					return
				case 'cancel':
					finish(true)
					return
				case 'chat':
					finishChat()
					return
			}
		}

		// Enter inside the always-visible free-text editor.
		editor.onSubmit = value => applyEffects(state.submitEditorText(value))
		const inputController = new QuestionnaireInputController(
			state,
			editor,
			keybindings,
			switchTab,
			applyEffects,
		)

		return {
			get focused(): boolean {
				return editor.focused
			},
			set focused(value: boolean) {
				editor.focused = value
			},
			render(width: number): string[] {
				if (!cachedLines || cachedWidth !== width) {
					cachedLines = renderQuestionnaire(
						state,
						questions,
						editor,
						theme,
						width,
					)
					cachedWidth = width
				}
				return cachedLines
			},
			invalidate: () => {
				editor.invalidate()
				cachedLines = undefined
				cachedWidth = undefined
			},
			handleInput: data => inputController.handleInput(data),
		}
	})
}
