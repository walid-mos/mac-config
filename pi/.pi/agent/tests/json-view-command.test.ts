import assert from 'node:assert/strict'
import test from 'node:test'

import { parseJsonCommand } from '../extensions/json-view/json-command.ts'

test('parses toggle commands', () => {
	assert.deepEqual(parseJsonCommand(''), { kind: 'toggle' })
	assert.deepEqual(parseJsonCommand('toggle'), { kind: 'toggle' })
})

test('parses open commands with strict positive recency', () => {
	assert.deepEqual(parseJsonCommand('open'), {
		kind: 'open',
		recency: 1,
		requested: '1',
	})
	assert.deepEqual(parseJsonCommand('open 12'), {
		kind: 'open',
		recency: 12,
		requested: '12',
	})
})

test('rejects malformed or ambiguous arguments', () => {
	for (const argumentsSource of [
		'toggle extra',
		'open 0',
		'open -1',
		'open 2suffix',
		'open 1 extra',
		'unknown',
		'open 999999999999999999999999',
	]) {
		assert.deepEqual(parseJsonCommand(argumentsSource), { kind: 'invalid' })
	}
})
