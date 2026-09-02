import { type Editor, Key, matchesKey } from '@earendil-works/pi-tui'

import type { Question } from './questionnaire-model.ts'
import type {
	QuestionnaireEffect,
	QuestionnaireState,
} from './questionnaire-state.ts'

export interface SelectionKeybindings {
	matches(data: string, action: 'tui.select.up' | 'tui.select.down'): boolean
}

type ApplyEffects = (effects: QuestionnaireEffect[]) => void
type SwitchTab = (delta: -1 | 1) => void

/** Editor cursor position, or undefined when the editor does not have focus. */
function editorCursor(
	state: QuestionnaireState,
	editor: Editor,
): { line: number; col: number } | undefined {
	if (!state.editorHasFocus()) return undefined
	return editor.getCursor()
}

function cursorOnFirstRow(state: QuestionnaireState, editor: Editor): boolean {
	return editorCursor(state, editor)?.line === 0
}

function cursorOnLastRow(state: QuestionnaireState, editor: Editor): boolean {
	const cursor = editorCursor(state, editor)
	if (!cursor) return false
	return cursor.line === editor.getLines().length - 1
}

function cursorAtBufferStart(editor: Editor): boolean {
	const cursor = editor.getCursor()
	return cursor.line === 0 && cursor.col === 0
}

function cursorAtBufferEnd(editor: Editor): boolean {
	const cursor = editor.getCursor()
	const lines = editor.getLines()
	const lastLine = lines.at(-1)
	if (lastLine === undefined) return false
	return cursor.line === lines.length - 1 && cursor.col >= lastLine.length
}

/** Route keyboard input into questionnaire state transitions. */
export class QuestionnaireInputController {
	private readonly state: QuestionnaireState
	private readonly editor: Editor
	private readonly keybindings: SelectionKeybindings
	private readonly switchTab: SwitchTab
	private readonly applyEffects: ApplyEffects

	constructor(
		state: QuestionnaireState,
		editor: Editor,
		keybindings: SelectionKeybindings,
		switchTab: SwitchTab,
		applyEffects: ApplyEffects,
	) {
		this.state = state
		this.editor = editor
		this.keybindings = keybindings
		this.switchTab = switchTab
		this.applyEffects = applyEffects
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.ctrl('g'))) {
			this.applyEffects(this.state.requestChat())
			return
		}
		if (this.state.editorHasFocus()) {
			this.handleEditorKey(data)
			return
		}
		if (this.handleTabKey(data)) return
		if (this.handleSubmitTabKey(data)) return
		this.handleOptionKey(data)
	}

	private handleEditorKey(data: string): void {
		if (this.handleEditorTabKey(data)) return
		if (this.handleEditorVerticalKey(data)) return
		if (matchesKey(data, Key.escape)) {
			this.applyEffects(this.state.escape())
			return
		}
		this.editor.handleInput(data)
		this.applyEffects(['render'])
	}

	private handleEditorTabKey(data: string): boolean {
		if (this.state.isMulti) {
			if (matchesKey(data, Key.tab)) {
				this.switchTab(1)
				return true
			}
			if (matchesKey(data, Key.shift('tab'))) {
				this.switchTab(-1)
				return true
			}
		}
		if (!this.state.canNavigateTabsFromInputEdges()) return false
		if (matchesKey(data, Key.right) && cursorAtBufferEnd(this.editor)) {
			this.switchTab(1)
			return true
		}
		if (matchesKey(data, Key.left) && cursorAtBufferStart(this.editor)) {
			this.switchTab(-1)
			return true
		}
		return false
	}

	private handleEditorVerticalKey(data: string): boolean {
		const question = this.state.currentQuestion()
		if (question && matchesKey(data, Key.up)) {
			if (
				!this.state.isOpenEnded(question) &&
				cursorOnFirstRow(this.state, this.editor)
			) {
				this.applyEffects(this.state.moveCursor(-1))
				return true
			}
			return false
		}
		if (
			question &&
			matchesKey(data, Key.down) &&
			cursorOnLastRow(this.state, this.editor)
		) {
			this.applyEffects(this.state.moveCursor(1))
			return true
		}
		return false
	}

	private handleTabKey(data: string): boolean {
		if (!this.state.isMulti) return false
		if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
			this.switchTab(1)
			return true
		}
		if (matchesKey(data, Key.shift('tab')) || matchesKey(data, Key.left)) {
			this.switchTab(-1)
			return true
		}
		return false
	}

	private handleSubmitTabKey(data: string): boolean {
		if (!this.state.isOnSubmitTab()) return false
		if (matchesKey(data, Key.enter) && this.state.allAnswered()) {
			this.applyEffects(['submit'])
		} else if (matchesKey(data, Key.escape)) {
			this.applyEffects(['cancel'])
		}
		return true
	}

	private handleOptionKey(data: string): void {
		if (this.keybindings.matches(data, 'tui.select.up')) {
			this.applyEffects(this.state.moveCursor(-1))
			return
		}
		if (this.keybindings.matches(data, 'tui.select.down')) {
			this.applyEffects(this.state.moveCursor(1))
			return
		}
		const question = this.state.currentQuestion()
		if (!question) return
		if (this.handleDigitKey(data, question)) return
		this.handleSelectKey(data, question)
	}

	private handleDigitKey(data: string, question: Question): boolean {
		if (!/^[1-9]$/.test(data)) return false
		const index = Number.parseInt(data, 10) - 1
		if (index < this.state.currentOptions().length) {
			this.applyEffects(
				question.multiSelect
					? this.state.toggleMultiOption(index)
					: this.state.selectOption(index),
			)
		}
		return true
	}

	private handleSelectKey(data: string, question: Question): boolean {
		if (question.multiSelect && matchesKey(data, Key.space)) {
			this.applyEffects(this.state.toggleMultiOption(this.state.cursor))
			return true
		}
		if (matchesKey(data, Key.enter)) {
			const effects = this.state.isChatAction()
				? this.state.requestChat()
				: question.multiSelect
					? this.state.commitMultiSelection(question)
					: this.state.selectOption(this.state.cursor)
			this.applyEffects(effects)
			return true
		}
		if (matchesKey(data, Key.escape)) {
			this.applyEffects(this.state.escape())
			return true
		}
		return false
	}
}
