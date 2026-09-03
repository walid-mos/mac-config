import assert from 'node:assert/strict'
import test from 'node:test'

import {
	hyperlink,
	terminalLineWidth,
	truncateTerminalLine,
	wrapTerminalLine,
} from '../extensions/ui/terminal-text.ts'

const OSC_8_CLOSE = '\u001b]8;;\u0007'
// pi-tui's zero-width hardware-cursor marker, embedded by focused editors.
const CURSOR_MARKER = '\u001b_pi:c\u0007'

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

test('counts APC sequences like the cursor marker as zero-width', () => {
	assert.equal(terminalLineWidth(`abc${CURSOR_MARKER}de`), 5)
})

test('truncation never cuts an APC sequence open', () => {
	const line = `short text ${CURSOR_MARKER}${'x'.repeat(40)}`
	const truncated = truncateTerminalLine(line, 10)
	assert.ok(!truncated.includes('_pi'))
	assert.ok(!truncated.includes('\u001b_pi:c'))
	assert.equal(terminalLineWidth(truncated), 10)
})

test('wrap keeps APC sequences glued to their word at zero width', () => {
	const lines = wrapTerminalLine(`one${CURSOR_MARKER} two`, 3)
	assert.deepEqual(lines.map(terminalLineWidth), [3, 3])
	assert.ok(lines[0]!.includes('one'))
	assert.ok(lines[0]!.includes(CURSOR_MARKER))
})
