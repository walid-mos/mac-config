import assert from 'node:assert/strict'
import test from 'node:test'

import { ABOVE_EDITOR_PRIORITY } from '../extensions/ui/ordered-widget-stack.ts'
import {
	surfaceRegistry,
	subscribeSurfaceChanges,
} from '../extensions/ui/surface.ts'

import {
	assertSandLoaderPrefix,
	fakeTheme,
	harness,
	stripAnsi,
} from './working-loader.test-helpers.ts'

test('shows a rotating word above the editor while the agent works', () => {
	surfaceRegistry.clear()
	const { emit } = harness()
	try {
		emit('session_start')
		emit('agent_start')

		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), true)
		const rendered = surfaceRegistry.render('aboveEditor', 80, fakeTheme())
		assert.equal(rendered.length, 1)
		assertSandLoaderPrefix(stripAnsi(rendered[0] ?? ''))

		emit('agent_settled')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), false)
	} finally {
		surfaceRegistry.clear()
	}
})

test('reste visible entre agent_end et agent_settled pour les retries automatiques', () => {
	surfaceRegistry.clear()
	const { emit } = harness()
	try {
		emit('session_start')
		emit('agent_start')
		emit('agent_end')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), true)
		emit('agent_settled')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), false)
	} finally {
		surfaceRegistry.clear()
	}
})

test('uses the working priority and pauses during ask_user_question', () => {
	surfaceRegistry.clear()
	const { emit, calls } = harness()
	try {
		emit('session_start')
		emit('agent_start')

		const entries = surfaceRegistry.render('aboveEditor', 80, fakeTheme())
		assert.equal(entries.length, 1, 'registered while working')
		assert.deepEqual(
			calls,
			['workingVisible:false'],
			'native spinner hidden while loader is up',
		)

		emit('tool_execution_start', 'ask_user_question')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), false)
		assert.deepEqual(
			calls,
			['workingVisible:false', 'workingVisible:true'],
			'restored during questionnaire',
		)

		emit('tool_execution_end', 'ask_user_question')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), true)

		emit('agent_settled')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), false)
		assert.deepEqual(calls, [
			'workingVisible:false',
			'workingVisible:true',
			'workingVisible:false',
			'workingVisible:true',
		])
	} finally {
		surfaceRegistry.clear()
	}
})

test('ignores unrelated tools and leaves native thinking rendering untouched', () => {
	surfaceRegistry.clear()
	const { emit, calls } = harness()
	try {
		emit('session_start')
		emit('tool_execution_start', 'read')
		assert.equal(
			surfaceRegistry.hasEntries('aboveEditor'),
			false,
			'unrelated tools never toggle the loader',
		)

		emit('agent_start')
		emit('session_shutdown')
		assert.equal(surfaceRegistry.hasEntries('aboveEditor'), false)
		assert.doesNotMatch(calls.join('\n'), /thinkingLabel/u)
	} finally {
		surfaceRegistry.clear()
	}
})

test('declares the working priority in the shared constant', () => {
	assert.equal(ABOVE_EDITOR_PRIORITY.working, 50)
	const removeListener = subscribeSurfaceChanges(() => {})
	removeListener()
})
