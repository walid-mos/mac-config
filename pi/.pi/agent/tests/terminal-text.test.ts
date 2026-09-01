import assert from 'node:assert/strict'
import test from 'node:test'

import {
	hyperlink,
	terminalLineWidth,
	truncateTerminalLine,
} from '../extensions/ui/terminal-text.ts'

const OSC_8_CLOSE = '\u001b]8;;\u0007'

test('measures visible columns while ignoring ANSI and hyperlinks', () => {
	const line = `\u001b[31m${hyperlink('link', 'https://example.com')}界\u001b[0m`
	assert.equal(terminalLineWidth(line), 6)
})

test('truncates with an ellipsis and closes terminal control sequences', () => {
	const line = hyperlink('abcdef', 'https://example.com')
	const truncated = truncateTerminalLine(line, 4, '…')
	assert.equal(terminalLineWidth(truncated), 4)
	assert.ok(truncated.includes('abc…'))
	assert.ok(truncated.includes(OSC_8_CLOSE))
	assert.ok(truncated.endsWith('\u001b[0m'))
})

test('normalizes invalid widths without leaking visible content', () => {
	assert.equal(
		terminalLineWidth(truncateTerminalLine('content', Number.NaN)),
		0,
	)
	assert.equal(terminalLineWidth(truncateTerminalLine('content', -2)), 0)
})
