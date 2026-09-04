import assert from 'node:assert/strict'
import test from 'node:test'

import { registerEditorDecorator } from '../extensions/ui/editor-decorator.ts'
import { createEditorProxy } from '../extensions/ui/editor-proxy.ts'

import type {
	EditorFactory,
	ExtensionAPI,
} from '@earendil-works/pi-coding-agent'
import type { EditorComponent } from '@earendil-works/pi-tui'

test('les décorateurs composés ne se réinstallent pas à chaque session', () => {
	type SessionHandler = (event: unknown, context: unknown) => void
	const handlers: SessionHandler[] = []
	const pi = {
		on(event: string, handler: SessionHandler) {
			assert.equal(event, 'session_start')
			handlers.push(handler)
		},
	} as unknown as ExtensionAPI
	const base = {
		render: () => ['base'],
		invalidate() {},
		handleInput() {},
	} as unknown as EditorComponent
	const rootFactory = (() => base) as EditorFactory
	let current: EditorFactory | undefined = rootFactory
	const context = {
		ui: {
			getEditorComponent: () => current,
			setEditorComponent: (factory: EditorFactory) => {
				current = factory
			},
		},
	}
	const decorations: string[] = []
	registerEditorDecorator(pi, rootFactory, editor => {
		decorations.push('first')
		return editor
	})
	registerEditorDecorator(pi, rootFactory, editor => {
		decorations.push('second')
		return editor
	})

	for (const handler of handlers) handler({}, context)
	const composed = current
	assert.notEqual(composed, rootFactory)
	for (const handler of handlers) handler({}, context)
	assert.equal(current, composed)

	composed?.({} as never, {} as never, {} as never)
	assert.deepEqual(decorations, ['first', 'second'])
})

test('proxy forwards new properties and callbacks without taking ownership', () => {
	const base = {
		actionHandlers: new Map(),
		getText: () => '',
		setText() {},
		handleInput() {},
		render: () => [],
		invalidate() {},
	}
	const editor = createEditorProxy(base, {})
	let called = false
	const callback = (): void => {
		called = true
	}
	assert.equal(editor.onEscape, undefined)
	editor.onEscape = callback
	assert.equal(Reflect.get(base, 'onEscape'), callback)
	assert.equal(editor.onEscape, callback)
	editor.onEscape()
	assert.equal(called, true)
	Reflect.set(editor, 'futureProperty', 42)
	assert.equal(Reflect.get(base, 'futureProperty'), 42)
	Reflect.set(base, 'futureProperty', 43)
	assert.equal(Reflect.get(editor, 'futureProperty'), 43)
	assert.ok('futureProperty' in editor)
	assert.equal(editor.actionHandlers, base.actionHandlers)
})

test('proxy keeps base private receivers and stable, replaceable methods', () => {
	class Editor {
		actionHandlers = new Map()
		#text = 'prompt'
		getText(): string {
			return this.#text
		}
		setText(text: string): void {
			this.#text = text
		}
		get text(): string {
			return this.#text
		}
		set text(text: string) {
			this.#text = text
		}
		handleInput(): void {}
		render(): string[] {
			return [this.#text]
		}
		invalidate(): void {}
	}
	const base = new Editor()
	const editor = createEditorProxy(base, {})
	const read = editor.getText
	assert.equal(read, editor.getText)
	assert.equal(read(), 'prompt')
	editor.setText('changed')
	assert.equal(Reflect.get(editor, 'text'), 'changed')
	Reflect.set(editor, 'text', 'through setter')
	assert.equal(base.getText(), 'through setter')
	base.getText = function () {
		return this.text.toUpperCase()
	}
	assert.notEqual(editor.getText, read)
	assert.equal(editor.getText, editor.getText)
	assert.equal(editor.getText(), 'THROUGH SETTER')
})
