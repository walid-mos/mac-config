import assert from 'node:assert/strict'
import test from 'node:test'

import { createCompactOverrides } from '../extensions/compact-tools/overrides.ts'
import { createCompactRenderers } from '../extensions/compact-tools/renderer.ts'
import { COMPACT_TOOLS } from '../extensions/compact-tools/summary.ts'

import {
	fakeContext,
	fakeNative,
	renderOne,
	theme,
} from './compact-tools.test-helpers.ts'

test('createCompactOverrides produit un override par tool avec renderShell self', () => {
	const created: Array<[string, string]> = []
	const overrides = createCompactOverrides({
		createBuiltin: (name, cwd) => {
			created.push([name, cwd])
			return fakeNative(name, cwd)
		},
	})
	assert.equal(overrides.length, COMPACT_TOOLS.length)
	for (const definition of overrides) {
		assert.equal(definition.renderShell, 'self')
		assert.equal(definition.promptSnippet, `${definition.name} snippet`)
		assert.ok(definition.promptGuidelines?.length === 1)
	}
	assert.deepEqual(
		created.map(([name]) => name),
		[...COMPACT_TOOLS],
	)
})

test("renderCall rend une ligne pending qui suit l'état partagé", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	const context = fakeContext({ args: { path: '/a/b/agent.ts' } })
	const component = definition.renderCall!(
		{ path: '/a/b/agent.ts' },
		theme,
		context,
	)
	assert.equal(renderOne(component), '● read · agent.ts')
	context.state.status = 'ok'
	context.state.summary = ''
	assert.equal(renderOne(component), '✓ read · agent.ts')
	context.state.status = 'error'
	context.state.summary = 'erreur'
	assert.equal(renderOne(component), '✗ read · agent.ts · erreur')
})

test("renderCall seed startedAt au démarrage d'exécution", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	const context = fakeContext({ executionStarted: true })
	definition.renderCall!({}, theme, context)
	assert.ok(typeof context.state.startedAt === 'number')
})

test('renderResult partiel ne publie pas un succès prématuré', () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	const context = fakeContext({
		args: { path: '/a/b/agent.ts' },
		executionStarted: true,
	})
	const row = definition.renderCall!(context.args, theme, context)
	definition.renderResult!(
		{ content: [{ type: 'text', text: 'ligne partielle' }] },
		{ expanded: false, isPartial: true },
		theme,
		context,
	)
	assert.equal(context.state.status, 'pending')
	assert.equal(context.state.endedAt, undefined)
	assert.equal(renderOne(row), '● read · agent.ts · 1 lignes')

	definition.renderResult!(
		{ content: [{ type: 'text', text: 'résultat final' }] },
		{ expanded: false, isPartial: false },
		theme,
		context,
	)
	assert.equal(context.state.status, 'ok')
	assert.ok(typeof context.state.endedAt === 'number')
	assert.equal(renderOne(row), '✓ read · agent.ts · 1 lignes')
})

test("renderResult collapsé met à jour l'état et n'affiche rien", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	const context = fakeContext({ args: { command: 'false' } })
	definition.renderCall!({ command: 'false' }, theme, context)
	const component = definition.renderResult!(
		{
			content: [
				{ type: 'text', text: 'boom\nCommand exited with code 1' },
			],
			isError: true,
		},
		{ expanded: false },
		theme,
		context,
	)
	assert.deepEqual(component.render(80), [])
	assert.equal(context.state.status, 'error')
	assert.equal(context.state.summary, '2 lignes')
	const line = renderOne(
		definition.renderCall!({ path: 'x' }, theme, context),
	)
	assert.equal(line, '✗ read · x · 2 lignes')
})

test("renderResult prend l'état d'erreur depuis le contexte Pi", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	const context = fakeContext({ args: { path: 'x' }, isError: true })
	definition.renderCall!({ path: 'x' }, theme, context)
	definition.renderResult!(
		{ content: [{ type: 'text', text: 'lecture impossible' }] },
		{ expanded: false },
		theme,
		context,
	)
	assert.equal(context.state.status, 'error')
	assert.equal(context.state.summary, '1 lignes')
})

test('renderResult étendu délègue au renderer natif', () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative })
	const context = fakeContext({
		args: { command: 'ls' },
		cwd: '/proj',
		expanded: true,
	})
	const component = definition.renderResult!(
		{ content: [{ type: 'text', text: 'out' }], isError: false },
		{ expanded: true },
		theme,
		context,
	)
	assert.deepEqual(component.render(80), ['NATIVE_RESULT'])
})

test('execute délègue à la définition native du cwd courant', async () => {
	const calls: string[] = []
	const overrides = createCompactOverrides({
		createBuiltin: (name, cwd) => {
			const native = fakeNative(name, cwd)
			return {
				...native,
				execute: async () => {
					calls.push(`${name}@${cwd}`)
					return {
						content: [{ type: 'text', text: 'ok' }],
						details: {},
					}
				},
			}
		},
	})
	const read = overrides.find(definition => definition.name === 'read')!
	await read.execute('t1', { path: 'x' }, undefined, undefined, {
		cwd: '/elsewhere',
	})
	assert.deepEqual(calls, ['read@/elsewhere'])
	await read.execute('t2', { path: 'x' }, undefined, undefined, {
		cwd: '/elsewhere',
	})
	assert.equal(
		calls.length,
		2,
		'le cache par cwd réutilise la même définition',
	)
})

test('createCompactRenderers outille un tool possédé par une autre extension', () => {
	let resolved = 0
	const renderers = createCompactRenderers('bash', () => {
		resolved += 1
		return fakeNative('bash', '/proj')
	})
	const context = fakeContext({ args: { command: 'pnpm test' } })
	const component = renderers.renderCall(
		{ command: 'pnpm test' },
		theme,
		context,
	)
	assert.equal(renderOne(component), '● bash · pnpm test')
	const collapsed = renderers.renderResult(
		{ content: [{ type: 'text', text: 'out' }], isError: false },
		{ expanded: false },
		theme,
		context,
	)
	assert.deepEqual(collapsed.render(80), [])
	assert.equal(context.state.status, 'ok')
	assert.equal(renderOne(component), '✓ bash · pnpm test')
	const expanded = renderers.renderResult(
		{ content: [{ type: 'text', text: 'out' }], isError: false },
		{ expanded: true },
		theme,
		context,
	)
	assert.deepEqual(expanded.render(80), ['NATIVE_RESULT'])
	assert.equal(
		resolved,
		1,
		"le resolver natif n'est appelé que pour l'expand",
	)
})

test('createCompactOverrides ignore les tools natifs inconnus', () => {
	const overrides = createCompactOverrides({
		createBuiltin: () => undefined,
		tools: ['bash', 'nope'],
	})
	assert.equal(overrides.length, 0)
})
