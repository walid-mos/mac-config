import assert from 'node:assert/strict'
import test from 'node:test'

import { createCompactRenderers } from '../extensions/compact-tools/renderer.ts'
import { editCollapsedBody } from '../extensions/mutation-view/edit.ts'

import {
	mutationTheme as theme,
	stripAnsi,
} from './mutation-view.test-helpers.ts'

import type {
	CompactRenderContext,
	CompactToolDefinition,
} from '../extensions/compact-tools/types.ts'

function fakeNativeEdit(): CompactToolDefinition {
	return {
		name: 'edit',
		label: 'edit',
		parameters: {},
		execute: async () => ({
			content: [{ type: 'text', text: 'ok' }],
			details: {},
		}),
		renderCall: () => ({
			render: () => ['NATIVE_EDIT_CALL'],
			invalidate() {},
		}),
		renderResult: () => ({
			render: () => ['NATIVE_FULL_DIFF'],
			invalidate() {},
		}),
	}
}

function editRenderers(): ReturnType<typeof createCompactRenderers> {
	return createCompactRenderers('edit', () => fakeNativeEdit(), {
		resultBody: editCollapsedBody,
	})
}

const cwd = '/proj'

function fakeContext(
	overrides: Partial<CompactRenderContext> = {},
): CompactRenderContext {
	return {
		state: {},
		cwd,
		executionStarted: false,
		expanded: false,
		args: undefined,
		...overrides,
	}
}

test('les renderers edit masquent la row une fois le succès établi (collapsé)', () => {
	const renderers = editRenderers()
	const context = fakeContext({
		args: { path: '/a/f.ts', edits: [{ oldText: 'x', newText: 'y' }] },
	})
	const row = renderers.renderCall({ path: '/a/f.ts' }, theme, context)
	assert.match(row.render(80)[0], /^● edit · f\.ts$/)

	const body = renderers.renderResult!(
		{
			content: [{ type: 'text', text: 'ok' }],
			details: { diff: '-1 x\n+1 y' },
			isError: false,
		},
		{ expanded: false },
		theme,
		context,
	)
	assert.match(stripAnsi(body.render(80)[0]), /^┌ edit ─/)
	assert.equal(context.state.status, 'ok')
	assert.deepEqual(row.render(80), [], "la row réussie ne s'affiche plus")
})

test('les renderers edit gardent la DA mutation en vue étendue', () => {
	const renderers = editRenderers()
	const context = fakeContext({ args: { path: '/a/f.ts' } })
	const row = renderers.renderCall({ path: '/a/f.ts' }, theme, context)
	renderers.renderResult!(
		{
			content: [{ type: 'text', text: 'oldText introuvable' }],
			isError: true,
		},
		{ expanded: false },
		theme,
		context,
	)
	assert.equal(context.state.status, 'error')
	assert.equal(context.state.summary, 'oldText introuvable')
	assert.match(row.render(80)[0], /^✗ edit · f\.ts · oldText introuvable$/)

	const expandedContext = fakeContext({
		args: {
			path: '/a/f.ts',
			edits: [{ oldText: 'ancienne', newText: 'nouvelle' }],
		},
		expanded: true,
	})
	const expandedRow = renderers.renderCall(
		{ path: '/a/f.ts' },
		theme,
		expandedContext,
	)
	const expandedBody = renderers.renderResult!(
		{
			content: [{ type: 'text', text: 'ok' }],
			details: {
				diff: Array.from(
					{ length: 24 },
					(_, index) => `+${index + 1} ligne ${index + 1}`,
				).join('\n'),
			},
			isError: false,
		},
		{ expanded: true },
		theme,
		expandedContext,
	)
	assert.deepEqual(expandedRow.render(80), ['✓ edit · f.ts'])
	const rows = expandedBody.render(80).map(stripAnsi)
	assert.match(rows[0], /^┌ edit ─/)
	assert.ok(rows.some(line => line.includes('ligne 24')))
	assert.ok(rows.some(line => line.includes('ctrl+o · replier')))
	assert.ok(rows.every(line => !line.includes('NATIVE')))
})
