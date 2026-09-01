import assert from 'node:assert/strict'
import test from 'node:test'

import { surfaceRegistry } from '../extensions/ui/surface.ts'
import { terminalLineWidth } from '../extensions/ui/terminal-text.ts'
import {
	isThinkingStreamEvent,
	isWorkingStreamEvent,
} from '../extensions/working-loader/index.ts'
import { THINKING_ICON } from '../extensions/working-loader/thinking-preview.ts'

import {
	assertSandLoaderPrefix,
	fakeTheme,
	harness,
	stripAnsi,
} from './working-loader.test-helpers.ts'

test('stream helpers classify assistant events', () => {
	assert.equal(isThinkingStreamEvent('thinking_start'), true)
	assert.equal(isThinkingStreamEvent('thinking_delta'), true)
	assert.equal(isThinkingStreamEvent('text_delta'), false)
	assert.equal(isWorkingStreamEvent('text_start'), true)
	assert.equal(isWorkingStreamEvent('toolcall_start'), true)
	assert.equal(isWorkingStreamEvent('thinking_end'), true)
	assert.equal(isWorkingStreamEvent('thinking_delta'), false)
})

test('thinking streams show a brain and rolling excerpt at the far right', () => {
	surfaceRegistry.clear()
	const { emit } = harness()
	try {
		emit('session_start')
		emit('agent_start')
		emit('message_update', undefined, {
			assistantMessageEvent: { type: 'thinking_start' },
		})

		const width = 80
		const initial = stripAnsi(
			surfaceRegistry.render('aboveEditor', width, fakeTheme())[0] ?? '',
		)
		assertSandLoaderPrefix(initial)
		assert.doesNotMatch(
			initial,
			new RegExp(THINKING_ICON, 'u'),
			'aucun placeholder vide',
		)

		emit('message_update', undefined, {
			assistantMessageEvent: {
				type: 'thinking_delta',
				delta: 'Inspecting the shared widget alignment and current reasoning stream.',
			},
		})
		const stable = stripAnsi(
			surfaceRegistry.render('aboveEditor', width, fakeTheme())[0] ?? '',
		)
		assert.doesNotMatch(stable, new RegExp(THINKING_ICON, 'u'))

		emit('message_update', undefined, {
			assistantMessageEvent: { type: 'text_start' },
		})
		const rolling = stripAnsi(
			surfaceRegistry.render('aboveEditor', width, fakeTheme())[0] ?? '',
		)
		assert.match(
			rolling,
			new RegExp(`${THINKING_ICON} ….*current reasoning stream\\.$`, 'u'),
		)
		assert.equal(terminalLineWidth(rolling), width)
		emit('agent_settled')
	} finally {
		surfaceRegistry.clear()
	}
})

test('thinking mode stays quiet until a useful snapshot exists', () => {
	surfaceRegistry.clear()
	const { emit } = harness()
	try {
		emit('session_start')
		emit('agent_start')
		emit('message_update', undefined, {
			assistantMessageEvent: {
				type: 'thinking_delta',
				delta: 'Checking repaint behavior',
			},
		})
		assert.doesNotMatch(
			stripAnsi(
				surfaceRegistry.render('aboveEditor', 80, fakeTheme())[0] ?? '',
			),
			new RegExp(THINKING_ICON, 'u'),
		)
		emit('agent_settled')
	} finally {
		surfaceRegistry.clear()
	}
})

test('the marker is dropped on narrow widths instead of breaking the line', () => {
	surfaceRegistry.clear()
	const { emit } = harness()
	try {
		emit('session_start')
		emit('agent_start')
		emit('message_update', undefined, {
			assistantMessageEvent: { type: 'thinking_start' },
		})

		const line = stripAnsi(
			surfaceRegistry.render('aboveEditor', 24, fakeTheme())[0] ?? '',
		)
		assertSandLoaderPrefix(line)
		assert.doesNotMatch(
			line,
			new RegExp(THINKING_ICON, 'u'),
			'seul le mot de travail reste',
		)
		emit('agent_settled')
	} finally {
		surfaceRegistry.clear()
	}
})

test('message_end publishes useful thinking and defers its exit', () => {
	surfaceRegistry.clear()
	const { emit } = harness()
	try {
		emit('session_start')
		emit('agent_start')
		emit('message_update', undefined, {
			assistantMessageEvent: {
				type: 'thinking_delta',
				delta: 'Final useful thought',
			},
		})
		emit('message_end')
		assert.match(
			stripAnsi(
				surfaceRegistry.render('aboveEditor', 80, fakeTheme())[0] ?? '',
			),
			new RegExp(`${THINKING_ICON} Final useful thought$`, 'u'),
		)
		emit('agent_settled')
	} finally {
		surfaceRegistry.clear()
	}
})
