import assert from 'node:assert/strict'
import test from 'node:test'

import { createCompactOverrides } from '../extensions/compact-tools/overrides.ts'
import {
	MAX_VISIBLE_STACK_CALLS,
	CompactRowStack,
	compactRowStack,
} from '../extensions/compact-tools/stack.ts'

import {
	fakeContext,
	fakeNative,
	stackWithTools,
	theme,
} from './compact-tools.test-helpers.ts'

function stackView(tool: string, subject: string) {
	return {
		tool,
		subject,
		state: { status: 'ok' as const },
		theme,
	}
}

test('CompactRowStack regroupe les calls compacts consécutifs sans spacer intermédiaire', () => {
	const stack = stackWithTools('read', 'grep')
	stack.rebuild([
		{ role: 'user', content: 'test' },
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r1', name: 'read' }],
		},
		{ role: 'toolResult' },
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r2', name: 'read' }],
		},
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r3', name: 'grep' }],
		},
	])
	stack.attach('r1', stackView('read', 'a.ts'), () => {})
	stack.attach('r2', stackView('read', 'b.ts'), () => {})
	stack.attach('r3', stackView('grep', '"needle"'), () => {})
	assert.deepEqual(stack.render('r1', stackView('read', 'a.ts'), 80), [])
	assert.deepEqual(stack.render('r2', stackView('read', 'b.ts'), 80), [])
	assert.deepEqual(stack.render('r3', stackView('grep', '"needle"'), 80), [
		'├─ ✓ read · a.ts',
		'├─ ✓ read · b.ts',
		'╰─ ✓ grep · "needle"',
	])
})

test('CompactRowStack replie les anciennes étapes sans masquer leurs erreurs', () => {
	const stack = stackWithTools('read')
	const calls = Array.from(
		{ length: MAX_VISIBLE_STACK_CALLS + 3 },
		(_, index) => ({
			type: 'toolCall' as const,
			id: `r${index + 1}`,
			name: 'read',
		}),
	)
	stack.rebuild([{ role: 'assistant', content: calls }])
	const views = calls.map((call, index) => ({
		id: call.id,
		view: {
			tool: 'read',
			subject: `${call.id}.ts`,
			state: { status: (index === 1 ? 'error' : 'ok') as 'error' | 'ok' },
			theme,
		},
	}))
	for (const { id, view } of views) stack.attach(id, view, () => {})
	const latest = views.at(-1)!
	const lines = stack.render(latest.id, latest.view, 80)
	assert.equal(lines.length, MAX_VISIBLE_STACK_CALLS + 1)
	assert.equal(lines[0], '│  ⋯ 3 étapes précédentes · 1 erreur')
	assert.equal(lines[1], '├─ ✓ read · r4.ts')
	assert.equal(lines.at(-1), `╰─ ✓ read · r${calls.length}.ts`)
})

test('CompactRowStack coupe la pile sur texte visible, user et tool non enregistré', () => {
	const stack = stackWithTools('read')
	stack.rebuild([
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r1', name: 'read' }],
		},
		{
			role: 'assistant',
			content: [
				{ type: 'text', text: 'progression' },
				{ type: 'toolCall', id: 'r2', name: 'read' },
			],
		},
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'w1', name: 'write' }],
		},
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r3', name: 'read' }],
		},
		{ role: 'user', content: 'suite' },
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r4', name: 'read' }],
		},
	])
	assert.deepEqual(stack.groups(), [['r1'], ['r2'], ['r3'], ['r4']])
})

test('CompactRowStack coupe chaque groupe séparé par plusieurs blocs de texte', () => {
	const stack = stackWithTools('read')
	stack.rebuild([
		{
			role: 'assistant',
			content: [
				{ type: 'toolCall', id: 'r1', name: 'read' },
				{ type: 'text', text: 'première transition' },
				{ type: 'toolCall', id: 'r2', name: 'read' },
				{ type: 'text', text: 'seconde transition' },
				{ type: 'toolCall', id: 'r3', name: 'read' },
			],
		},
	])
	assert.deepEqual(stack.groups(), [['r1'], ['r2'], ['r3']])
})

test('CompactRowStack déduplique les message_update streamés', () => {
	const stack = stackWithTools('read')
	stack.beginMessage({
		role: 'assistant',
		content: [{ type: 'text', text: 'go' }],
	})
	stack.updateMessage({
		role: 'assistant',
		content: [
			{ type: 'text', text: 'go' },
			{ type: 'toolCall', id: 'r1', name: 'read' },
		],
	})
	stack.updateMessage({
		role: 'assistant',
		content: [
			{ type: 'text', text: 'go' },
			{ type: 'toolCall', id: 'r1', name: 'read' },
			{ type: 'toolCall', id: 'r2', name: 'read' },
		],
	})
	stack.endMessage({
		role: 'assistant',
		content: [
			{ type: 'text', text: 'go' },
			{ type: 'toolCall', id: 'r1', name: 'read' },
			{ type: 'toolCall', id: 'r2', name: 'read' },
		],
	})
	assert.deepEqual(stack.groups(), [['r1', 'r2']])
})

test('CompactRowStack applique une nouvelle frontière textuelle pendant le streaming', () => {
	const stack = stackWithTools('read')
	stack.beginMessage({
		role: 'assistant',
		content: [
			{ type: 'text', text: 'intro' },
			{ type: 'toolCall', id: 'r1', name: 'read' },
		],
	})
	stack.updateMessage({
		role: 'assistant',
		content: [
			{ type: 'text', text: 'intro enrichie' },
			{ type: 'toolCall', id: 'r1', name: 'read' },
			{ type: 'text', text: 'transition' },
			{ type: 'toolCall', id: 'r2', name: 'read' },
		],
	})
	assert.deepEqual(stack.groups(), [['r1'], ['r2']])
})

test("tout renderer compact s'enregistre automatiquement dans la pile", () => {
	const stack = new CompactRowStack()
	stack.registerTool('custom_search', true)
	stack.rebuild([
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'c1', name: 'custom_search' }],
		},
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'c2', name: 'custom_search' }],
		},
	])
	assert.deepEqual(stack.groups(), [['c1', 'c2']])
})

test("un reload renouvelle l'implémentation sans versionner l'état partagé", async () => {
	compactRowStack.reset()
	compactRowStack.clearRegisteredTools()
	const refreshed = await import(
		`../extensions/compact-tools/stack.ts?reload-state=${Date.now()}`
	)
	assert.notEqual(refreshed.compactRowStack, compactRowStack)

	compactRowStack.registerTool('read', true)
	refreshed.compactRowStack.rebuild([
		{
			role: 'assistant',
			content: [
				{ type: 'toolCall', id: 'r1', name: 'read' },
				{ type: 'toolCall', id: 'r2', name: 'read' },
			],
		},
	])
	assert.deepEqual(compactRowStack.groups(), [['r1', 'r2']])
	compactRowStack.reset()
	compactRowStack.clearRegisteredTools()
})

test('les renderers délèguent la pile au dernier composant', () => {
	compactRowStack.reset()
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	compactRowStack.rebuild([
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r1', name: 'read' }],
		},
		{
			role: 'assistant',
			content: [{ type: 'toolCall', id: 'r2', name: 'read' }],
		},
	])
	const firstContext = fakeContext({
		toolCallId: 'r1',
		args: { path: '/a.ts' },
	})
	const secondContext = fakeContext({
		toolCallId: 'r2',
		args: { path: '/b.ts' },
	})
	const first = definition.renderCall!({ path: '/a.ts' }, theme, firstContext)
	const second = definition.renderCall!(
		{ path: '/b.ts' },
		theme,
		secondContext,
	)
	assert.deepEqual(first.render(80), [])
	assert.deepEqual(second.render(80), [
		'├─ ● read · a.ts',
		'╰─ ● read · b.ts',
	])
	compactRowStack.reset()
})
