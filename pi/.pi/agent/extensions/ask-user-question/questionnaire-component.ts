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
	Key,
	matchesKey,
	type TUI,
} from '@earendil-works/pi-tui'

import { renderQuestionnaire } from './questionnaire-render.ts'
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

interface SelectionKeybindings {
	matches(data: string, action: 'tui.select.up' | 'tui.select.down'): boolean
}

type CustomFactory<T> = (
	tui: TUI,
	theme: QuestionnairePalette,
	keybindings: SelectionKeybindings,
	done: (result: T) => void,
) => CustomComponent

/** Editor cursor position, or undefined when the editor doesn't have focus. */
function editorCursor(
	state: QuestionnaireState,
	editor: Editor,
): { line: number; col: number } | undefined {
	if (!state.editorHasFocus()) return undefined
	return editor.getCursor()
}

/** True when ↑ can leave the editor for the option above. */
function cursorOnFirstRow(state: QuestionnaireState, editor: Editor): boolean {
	return editorCursor(state, editor)?.line === 0
}

/** True when ↓ can leave the editor for the option below. */
function cursorOnLastRow(state: QuestionnaireState, editor: Editor): boolean {
	const cursor = editorCursor(state, editor)
	if (!cursor) return false
	return cursor.line === editor.getLines().length - 1
}

/** True when ←/→ should navigate between questionnaire tabs instead of moving
 * within the editor buffer. */
function cursorAtBufferStart(editor: Editor): boolean {
	const cursor = editor.getCursor()
	return cursor.line === 0 && cursor.col === 0
}

function cursorAtBufferEnd(editor: Editor): boolean {
	const cursor = editor.getCursor()
	const lines = editor.getLines()
	const lastLine = lines[lines.length - 1]
	if (lastLine === undefined) return false
	return cursor.line === lines.length - 1 && cursor.col >= lastLine.length
}

export function runQuestionnaire(
	custom: <T>(factory: CustomFactory<T>) => Promise<T>,
	questions: Question[],
	initialState?: QuestionnaireInitialState,
): Promise<AskResult> {
	return custom<AskResult>((tui, theme, keybindings, done) => {
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

		/** Tab navigation while the editor is focused: Tab/Shift+Tab always switch
		 * tabs in multi-questionnaires; ←/→ only at the input's buffer edges.
		 * Inside the buffer, ←/→ retain the editor's normal cursor movement.
		 * Returns true when the key was handled. */
		function handleEditorTabNav(data: string): boolean {
			if (state.isMulti) {
				if (matchesKey(data, Key.tab)) {
					switchTab(1)
					return true
				}
				if (matchesKey(data, Key.shift('tab'))) {
					switchTab(-1)
					return true
				}
			}
			if (!state.canNavigateTabsFromInputEdges()) return false
			if (matchesKey(data, Key.right) && cursorAtBufferEnd(editor)) {
				switchTab(1)
				return true
			}
			if (matchesKey(data, Key.left) && cursorAtBufferStart(editor)) {
				switchTab(-1)
				return true
			}
			return false
		}

		/** ↑/↓ at the editor's buffer edges leave the editor for the neighbouring
		 * option row; inside the buffer they move the cursor.
		 * Returns true when the key was handled. */
		function handleEditorVerticalNav(data: string): boolean {
			const q = state.currentQuestion()
			if (q && matchesKey(data, Key.up)) {
				if (!state.isOpenEnded(q) && cursorOnFirstRow(state, editor)) {
					applyEffects(state.moveCursor(-1))
					return true
				}
				return false
			}
			if (
				q &&
				matchesKey(data, Key.down) &&
				cursorOnLastRow(state, editor)
			) {
				applyEffects(state.moveCursor(1))
				return true
			}
			return false
		}

		function handleEditorKey(data: string): void {
			if (handleEditorTabNav(data)) return
			if (handleEditorVerticalNav(data)) return
			if (matchesKey(data, Key.escape)) {
				applyEffects(state.escape())
				return
			}
			editor.handleInput(data)
			refresh()
		}

		/** Number keys 1-9: instant select (single) or toggle (multi).
		 * Returns true when the key was handled. */
		function handleDigitKey(data: string, q: Question): boolean {
			if (!/^[1-9]$/.test(data)) return false
			const idx = Number.parseInt(data, 10) - 1
			if (idx < state.currentOptions().length) {
				applyEffects(
					q.multiSelect
						? state.toggleMultiOption(idx)
						: state.selectOption(idx),
				)
			}
			return true
		}

		/** Space (multi toggle), Enter (confirm) and Escape.
		 * Returns true when the key was handled. */
		function handleSelectKey(data: string, q: Question): boolean {
			if (q.multiSelect && matchesKey(data, Key.space)) {
				applyEffects(state.toggleMultiOption(state.cursor))
				return true
			}
			if (matchesKey(data, Key.enter)) {
				const effects = state.isChatAction()
					? state.requestChat()
					: q.multiSelect
						? state.commitMultiSelection(q)
						: state.selectOption(state.cursor)
				applyEffects(effects)
				return true
			}
			if (matchesKey(data, Key.escape)) {
				applyEffects(state.escape())
				return true
			}
			return false
		}

		function handleOptionKey(data: string): void {
			if (keybindings.matches(data, 'tui.select.up')) {
				applyEffects(state.moveCursor(-1))
				return
			}
			if (keybindings.matches(data, 'tui.select.down')) {
				applyEffects(state.moveCursor(1))
				return
			}
			const q = state.currentQuestion()
			if (!q) return
			if (handleDigitKey(data, q)) return
			if (handleSelectKey(data, q)) return
		}

		function handleInput(data: string): void {
			if (matchesKey(data, Key.ctrl('g'))) {
				applyEffects(state.requestChat())
				return
			}

			// Editor focused (cursor on "Type something." or open-ended question):
			// route everything to the always-visible editor, including digits.
			if (state.editorHasFocus()) {
				handleEditorKey(data)
				return
			}

			if (state.isMulti) {
				if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
					switchTab(1)
					return
				}
				if (
					matchesKey(data, Key.shift('tab')) ||
					matchesKey(data, Key.left)
				) {
					switchTab(-1)
					return
				}
			}

			if (state.isOnSubmitTab()) {
				if (matchesKey(data, Key.enter) && state.allAnswered())
					applyEffects(['submit'])
				else if (matchesKey(data, Key.escape)) applyEffects(['cancel'])
				return
			}

			handleOptionKey(data)
		}

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
			handleInput,
		}
	})
}
