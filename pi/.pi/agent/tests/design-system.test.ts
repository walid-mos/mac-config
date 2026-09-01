import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { PI_PALETTE } from '../extensions/ui/design-system/palette.ts'
import {
	ansi256ToRgb,
	backgroundAnsi,
	blendHex,
	foregroundHex,
	hexToRgb,
} from '../extensions/ui/design-system/terminal-color.ts'

const THEME_URL = new URL('../themes/catppuccin-latte.json', import.meta.url)

test('Pi design-system colors stay aligned with the active Latte theme', async () => {
	const theme = JSON.parse(await readFile(THEME_URL, 'utf8')) as {
		vars?: Record<string, unknown>
	}
	assert.deepEqual(theme.vars, PI_PALETTE)
})

test('terminal color primitives share one validated conversion path', () => {
	assert.deepEqual(hexToRgb('#209fb5'), [32, 159, 181])
	assert.equal(blendHex('#000000', '#ffffff', 0.5), '#808080')
	assert.equal(foregroundHex('#010203', 'x'), '\u001B[38;2;1;2;3mx\u001B[39m')
	assert.equal(backgroundAnsi([255, 0, 0], '256color'), '\u001B[48;5;196m')
	assert.deepEqual(ansi256ToRgb(196), [255, 0, 0])
	assert.throws(() => hexToRgb('209fb5'), /Invalid #rrggbb color/u)
})
