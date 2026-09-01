import assert from 'node:assert/strict'
import test from 'node:test'

import { diffLines } from '../extensions/mutation-view/diff.ts'
import {
	createEditFrameComponent,
	editFrameRows,
} from '../extensions/mutation-view/edit.ts'
import { terminalLineWidth } from '../extensions/ui/terminal-text.ts'

import {
	mutationTheme as theme,
	stripAnsi,
} from './mutation-view.test-helpers.ts'

test('editFrameRows rend une mutation ouverte avec stats et chemin', () => {
	const edits = [{ oldText: 'a\nb\nc', newText: 'a\nB\nc' }]
	const diffs = edits.map(edit => diffLines(edit.oldText, edit.newText))
	const rows = editFrameRows('/a/f.ts', edits, diffs, 80, theme)
	assert.equal(rows.length, 8) // titre + respiration + 4 lignes + respiration + pied
	const plain = rows.map(stripAnsi)
	assert.match(plain[0], /^┌ edit ─ \/a\/f\.ts ─+ −1 \+1 · 1 édition$/)
	assert.equal(plain[1], '│ ')
	assert.match(plain[2], /^│ {3}a$/)
	assert.match(plain[3], /^│ - b$/)
	assert.match(plain[4], /^│ \+ B$/)
	assert.match(plain[5], /^│ {3}c$/)
	assert.equal(plain[6], '│ ')
	assert.equal(plain[7], '  ctrl+o · diff complet')
})

test('editFrameRows surligne suppressions et ajouts sur toute la ligne', () => {
	const edits = [{ oldText: 'before', newText: 'after' }]
	const diffs = edits.map(edit => diffLines(edit.oldText, edit.newText))
	const rows = editFrameRows('src/f.ts', edits, diffs, 40, {
		...theme,
		getColorMode: () => 'truecolor',
	})
	assert.match(rows[2], /\x1b\[48;2;235;207;217m/)
	assert.match(rows[3], /\x1b\[48;2;213;229;215m/)
	assert.ok(rows[2].endsWith('\x1b[49m'))
	assert.ok(rows[3].endsWith('\x1b[49m'))
	assert.match(rows[2], /\u00a0+\x1b\[49m$/)
	assert.match(rows[3], /\u00a0+\x1b\[49m$/)
	assert.equal(stripAnsi(rows[2]).length, 35)
	assert.equal(stripAnsi(rows[3]).length, 35)
})

test('editFrameRows sépare plusieurs éditions par un repère', () => {
	const edits = [
		{ oldText: 'a', newText: 'A' },
		{ oldText: 'b', newText: 'B' },
	]
	const diffs = edits.map(edit => diffLines(edit.oldText, edit.newText))
	const rows = editFrameRows('/a/f.ts', edits, diffs, 80, theme)
	const plain = rows.map(stripAnsi)
	assert.match(plain[0], /−2 \+2 · 2 éditions/)
	assert.match(plain[2], /^│ - a/)
	assert.match(plain[3], /^│ \+ A/)
	assert.equal(plain[4], '│ ··· édition 2/2')
	assert.match(plain[5], /^│ - b/)
})

test('editFrameRows plafonne à 18 lignes avec fondu et compteur', () => {
	const oldText = Array.from({ length: 30 }, (_, i) => `ligne ${i}`).join(
		'\n',
	)
	const newText = oldText.replace('ligne 5', 'LIGNE 5')
	const edits = [{ oldText, newText }]
	const diffs = edits.map(edit => diffLines(edit.oldText, edit.newText))
	const rows = editFrameRows('/a/f.ts', edits, diffs, 80, theme)
	const plain = rows.map(stripAnsi)
	// titre + respiration + 18 lignes + points + respiration + pied
	assert.equal(rows.length, 23)
	assert.equal(plain[rows.length - 3], '│ · · ·')
	assert.equal(plain[rows.length - 2], '│ ')
	assert.match(plain[rows.length - 1], /\+13 lignes masquées · ctrl\+o/)
})

test('createEditFrameComponent garde une marge de gouttière à droite', () => {
	const edits = [{ oldText: 'a', newText: 'A' }]
	const component = createEditFrameComponent(
		'/a/chemin/tres-long/f.ts',
		edits,
		theme,
	)
	const narrow = component.render(24).map(stripAnsi)
	const regular = component.render(80).map(stripAnsi)
	const wide = component.render(160).map(stripAnsi)
	assert.ok(narrow.every(row => row.length <= 24))
	assert.ok(regular.every(row => row.length <= 80))
	assert.ok(wide.every(row => row.length <= 155))
	assert.equal(wide[0].length, 155)
	assert.match(narrow[0], /^┌ edit ─ f\.ts/)
	assert.doesNotMatch(narrow[0], /édition/)
	assert.match(regular[0], /^┌ edit ─/)
})

test('editFrameRows borne aussi les glyphes plus larges que la colonne disponible', () => {
	const rows = editFrameRows(
		'f.ts',
		[{ oldText: 'a', newText: '界' }],
		[[{ kind: 'added', lineNumber: 1, text: '界' }]],
		10,
		theme,
	)
	assert.ok(rows.every(row => terminalLineWidth(row) <= 10))
})

test('editFrameRows wrappe le code long sans ellipsis et répète le fond', () => {
	const longText = 'const value = ' + 'x'.repeat(240)
	const rows = editFrameRows(
		'src/long.ts',
		[{ oldText: 'old', newText: longText }],
		[[{ kind: 'added', lineNumber: 128, text: longText }]],
		180,
		{ ...theme, getColorMode: () => 'truecolor' },
	)
	const codeRows = rows.slice(2, -2)
	assert.equal(stripAnsi(rows[0]).length, 172)
	assert.equal(codeRows.length, 2)
	assert.ok(codeRows.every(row => row.includes('\x1b[48;2;213;229;215m')))
	assert.doesNotMatch(codeRows.map(stripAnsi).join(''), /…/)
	assert.match(stripAnsi(codeRows[0]), /^│ \+ 128 │ const value/)
	assert.match(stripAnsi(codeRows[1]), /^│ {7}│ x/)
})
