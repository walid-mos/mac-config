import assert from 'node:assert/strict'
import test from 'node:test'

import { DoubleEscapeEditor } from '../extensions/double-escape/editor.ts'
import {
	DOUBLE_ESCAPE_WINDOW_MS,
	EscapePacer,
} from '../extensions/double-escape/pacer.ts'

import type {
	AppKeybinding,
	KeybindingsManager,
} from '@earendil-works/pi-coding-agent'
import type { EditorComponent } from '@earendil-works/pi-tui'

class RecordingEditor implements EditorComponent {
	readonly inputs: string[] = []
	text = 'prompt'

	render(): string[] {
		return [this.text]
	}

	invalidate(): void {}

	getText(): string {
		return this.text
	}

	setText(text: string): void {
		this.text = text
	}

	handleInput(data: string): void {
		this.inputs.push(data)
	}
}

class ActionRecordingEditor extends RecordingEditor {
	readonly actionHandlers = new Map<AppKeybinding, () => void>()
	onEscape?: () => void
	onCtrlD?: () => void
	onPasteImage?: () => void
	onExtensionShortcut?: (data: string) => boolean

	override handleInput(data: string): void {
		if (data === 'ctrl+o') {
			this.actionHandlers.get('app.tools.expand')?.()
			return
		}
		super.handleInput(data)
	}
}

const escapeKeybindings = {
	matches: (data: string, action: string) =>
		data === 'escape' && action === 'app.interrupt',
} as KeybindingsManager

test('second escape inside the window completes the gesture', () => {
	const pacer = new EscapePacer()
	assert.equal(pacer.registerEscape(0), false)
	assert.equal(pacer.registerEscape(DOUBLE_ESCAPE_WINDOW_MS), true)
})

test('second escape outside the window does not fire', () => {
	const pacer = new EscapePacer()
	assert.equal(pacer.registerEscape(0), false)
	assert.equal(pacer.registerEscape(DOUBLE_ESCAPE_WINDOW_MS + 1), false)
})

test('fired gesture re-arms: a third escape starts a new gesture', () => {
	const pacer = new EscapePacer()
	pacer.registerEscape(0)
	assert.equal(pacer.registerEscape(100), true)
	assert.equal(pacer.registerEscape(200), false)
	assert.equal(pacer.registerEscape(300), true)
})

test('any other key resets the pending first press', () => {
	const pacer = new EscapePacer()
	assert.equal(pacer.registerEscape(0), false)
	pacer.reset()
	assert.equal(pacer.registerEscape(100), false)
})

test('fires at exactly the window boundary, not one ms later', () => {
	const pacer = new EscapePacer()
	pacer.registerEscape(1000)
	assert.equal(pacer.registerEscape(1000 + DOUBLE_ESCAPE_WINDOW_MS), true)

	const late = new EscapePacer()
	late.registerEscape(1000)
	assert.equal(late.registerEscape(1000 + DOUBLE_ESCAPE_WINDOW_MS + 1), false)
})

test("editor wrapper refuse un éditeur sans surface d'actions plutôt que de réimplémenter ses raccourcis", () => {
	assert.throws(
		() => new DoubleEscapeEditor(new RecordingEditor(), escapeKeybindings),
		/CustomEditor action surface/,
	)
})

test('editor wrapper preserves input handled by the previously installed editor', () => {
	const base = new ActionRecordingEditor()
	const editor = new DoubleEscapeEditor(base, escapeKeybindings)

	editor.handleInput('left')

	assert.deepEqual(base.inputs, ['left'])
})

test('editor wrapper exposes the wrapped CustomEditor action surface', () => {
	const base = new ActionRecordingEditor()
	const editor = new DoubleEscapeEditor(base, escapeKeybindings)
	let expanded = false

	// Mirrors InteractiveMode.setCustomEditorComponent wiring app actions onto
	// any custom editor exposing actionHandlers.
	editor.actionHandlers.set('app.tools.expand', () => {
		expanded = true
	})
	editor.handleInput('ctrl+o')

	assert.equal(expanded, true)
	assert.equal(editor.actionHandlers, base.actionHandlers)
})

test('editor wrapper clears the base editor on double escape', () => {
	const base = new ActionRecordingEditor()
	const times = [0, 100]
	const editor = new DoubleEscapeEditor(
		base,
		escapeKeybindings,
		() => times.shift() ?? 100,
	)

	editor.handleInput('escape')
	editor.handleInput('escape')

	assert.equal(base.text, '')
	assert.deepEqual(base.inputs, ['escape'])
})
