import assert from 'node:assert/strict'
import test from 'node:test'

import { registerEditorDecorator } from '../extensions/ui/editor-decorator.ts'

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
