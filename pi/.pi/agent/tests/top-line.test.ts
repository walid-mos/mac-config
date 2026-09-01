import assert from 'node:assert/strict'
import test from 'node:test'

import {
	isHorizontalRule,
	keepTopRuleOnly,
} from '../extensions/top-line/filter.ts'

const rule = (width: number) => `\x1b[38;5;245m${'─'.repeat(width)}\x1b[0m`
const scrollTop = (count: number, width: number) =>
	`\x1b[38;5;245m ↑ ${count} ${'─'.repeat(width - 6)}\x1b[0m`

test('isHorizontalRule matches bare rules regardless of color codes', () => {
	assert.ok(isHorizontalRule(rule(80)))
	assert.ok(isHorizontalRule('─'))
	assert.ok(isHorizontalRule(`${'─'.repeat(4)}\x1b[0m`))
})

test('isHorizontalRule rejects scroll indicators, text and empty lines', () => {
	assert.ok(!isHorizontalRule(scrollTop(3, 80)))
	assert.ok(!isHorizontalRule('↑ 3 ────'))
	assert.ok(!isHorizontalRule('hello'))
	assert.ok(!isHorizontalRule(''))
	assert.ok(!isHorizontalRule('\x1b[0m'))
})

test('keepTopRuleOnly keeps the top line and drops the bottom rule', () => {
	const lines = [rule(80), '  first line', '  second line', rule(80)]
	assert.deepEqual(keepTopRuleOnly(lines), [lines[0], lines[1], lines[2]])
})

test('keepTopRuleOnly preserves scroll indicators and autocomplete lines', () => {
	const lines = [
		scrollTop(4, 80),
		'  hidden line',
		'  visible line',
		scrollTop(2, 80),
		'  autocomplete entry',
	]
	assert.deepEqual(keepTopRuleOnly(lines), lines)
})

test('keepTopRuleOnly keeps a single-line editor with its top rule', () => {
	const lines = [rule(80), '  only line', rule(80)]
	assert.deepEqual(keepTopRuleOnly(lines), [lines[0], lines[1]])
})

test('keepTopRuleOnly is idempotent', () => {
	const lines = [rule(80), '  text', rule(80), '  autocomplete', rule(80)]
	const once = keepTopRuleOnly(lines)
	assert.deepEqual(keepTopRuleOnly(once), once)
})
