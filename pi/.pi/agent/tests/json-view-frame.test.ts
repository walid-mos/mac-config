import assert from 'node:assert/strict'
import test from 'node:test'

import { LATTE } from '../extensions/footer/style.ts'
import {
	escapeMarkdownOutsideAnsi,
	tokenizeAnsiText,
} from '../extensions/json-view/ansi-text.ts'
import { renderJsonBox } from '../extensions/json-view/json-box.ts'
import { JSON_COLOR } from '../extensions/json-view/json-colors.ts'
import { formatJsonBytes } from '../extensions/json-view/json-frame.ts'
import { highlightJsonLine } from '../extensions/json-view/json-syntax.ts'
import { transformMarkdown } from '../extensions/json-view/transform-markdown.ts'
import { blendHex } from '../extensions/ui/frame.ts'

import {
	ansiColor,
	BIG_JSON,
	plainTerminalText,
	renderedTerminalText,
	SMALL_JSON,
	visibleLineWidths,
} from './json-view.test.fixtures.ts'

import type { JsonBlock } from '../extensions/json-view/detect-json.ts'

function tokenizeTrueColors(terminalText: string): string[] {
	const trueColorPrefix = '\x1b[38;2;'
	return tokenizeAnsiText(terminalText).flatMap(token => {
		if (
			token.kind === 'control' &&
			token.text.startsWith(trueColorPrefix)
		) {
			return [token.text]
		}
		return []
	})
}

function largeJsonBlock(): JsonBlock {
	return {
		source: 'raw',
		start: 0,
		end: BIG_JSON.length,
		raw: BIG_JSON,
		parsed: JSON.parse(BIG_JSON),
	}
}

test('uses three faded content rows and one centered dot row', () => {
	const block = largeJsonBlock()
	const capped = renderJsonBox(block, { expanded: false, width: 96 })
	const dotRows = capped
		.split('\n')
		.filter(row => plainTerminalText(row).includes('· · ·'))
	assert.equal(dotRows.length, 1)
	assert.ok(
		capped.includes(
			ansiColor(blendHex(LATTE.overlay1, JSON_COLOR.BASE, 0.55)),
		),
	)
	assert.ok(
		capped.includes(
			ansiColor(blendHex(LATTE.overlay1, JSON_COLOR.BASE, 0.9)),
		),
	)

	const borderColor = ansiColor(LATTE.overlay1)
	const paletteColors = new Set(
		Object.values(LATTE)
			.map(ansiColor)
			.filter(color => color !== borderColor),
	)
	const contentRows = capped
		.split('\n')
		.filter(row => plainTerminalText(row).includes('│'))
	const fadedContent = contentRows.at(-2) ?? ''
	const fadedColors = tokenizeTrueColors(fadedContent).filter(
		color => color !== borderColor,
	)
	assert.ok(fadedColors.length > 0)
	assert.ok(fadedColors.every(color => !paletteColors.has(color)))
	assert.ok(capped.includes(ansiColor(LATTE.green)))

	const full = renderJsonBox(block, { expanded: true, width: 96 })
	assert.ok(
		!full.split('\n').some(row => plainTerminalText(row).includes('· · ·')),
	)
	assert.ok(
		!full.includes(ansiColor(blendHex(LATTE.green, JSON_COLOR.BASE, 0.5))),
	)
})

test('keeps every box row at the exact requested width', () => {
	const transformed = transformMarkdown(`${SMALL_JSON}\n\n${BIG_JSON}`, {
		expanded: false,
		width: 96,
		persist: () => 'file:///tmp/x.json',
	})
	const boxRows = transformed
		.split('\n')
		.filter(row => /^[╭│╰]/.test(plainTerminalText(row)))
	assert.ok(boxRows.length > 20)
	for (const row of boxRows)
		assert.equal([...renderedTerminalText(row)].length, 96)
})

test('aligns rows after markdown consumes escape backslashes', () => {
	const markdown = JSON.stringify({ note: '*_<>~`\\'.repeat(12) }, null, 2)
	const width = 24
	const transformed = transformMarkdown(markdown, { expanded: true, width })
	const boxRows = transformed
		.split('\n')
		.filter(row => /^[╭│╰]/.test(plainTerminalText(row)))
	for (const row of boxRows)
		assert.equal([...renderedTerminalText(row)].length, width)
})

test('never exceeds a narrow renderer width', () => {
	const width = 16
	const transformed = transformMarkdown(BIG_JSON, { expanded: false, width })
	for (const visibleWidth of visibleLineWidths(transformed)) {
		assert.ok(visibleWidth <= width, `${visibleWidth} > ${width}`)
	}
})

test('preserves ansi while escaping markdown outside control sequences', () => {
	const ansi = `${ansiColor('#010203')}[text]\x1b[39m`
	assert.equal(escapeMarkdownOutsideAnsi(ansi), ansi)
	assert.equal(escapeMarkdownOutsideAnsi('a*b`c<d~e'), 'a\\*b\\`c\\<d\\~e')
})

test('highlights keys strings and punctuation', () => {
	const highlighted = highlightJsonLine('  "nom": "test",')
	assert.ok(highlighted.includes(`${ansiColor(LATTE.blue)}"nom"\x1b[39m`))
	assert.ok(highlighted.includes(`${ansiColor(LATTE.green)}"test"\x1b[39m`))
	assert.ok(highlighted.includes(`${ansiColor(LATTE.overlay1)}:\x1b[39m`))
})

test('formats byte sizes in french units', () => {
	assert.equal(formatJsonBytes(12), '12 o')
	assert.equal(formatJsonBytes(2048), '2 Ko')
	assert.equal(formatJsonBytes(1536), '1,5 Ko')
})
