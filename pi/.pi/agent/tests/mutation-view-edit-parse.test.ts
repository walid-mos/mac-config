import assert from 'node:assert/strict'
import test from 'node:test'

import { diffLines } from '../extensions/mutation-view/diff.ts'
import {
	parseEditArgs,
	parseNativeEditDiff,
} from '../extensions/mutation-view/edit.ts'

test('diffLines marque contextes, suppressions et ajouts', () => {
	const diff = diffLines('a\nb\nc', 'a\nB\nc')
	assert.deepEqual(diff, [
		{ kind: 'context', text: 'a' },
		{ kind: 'removed', text: 'b' },
		{ kind: 'added', text: 'B' },
		{ kind: 'context', text: 'c' },
	])
})

test('diffLines gère création, suppression totale et textes identiques', () => {
	assert.deepEqual(diffLines('', 'x\ny'), [
		{ kind: 'added', text: 'x' },
		{ kind: 'added', text: 'y' },
	])
	assert.deepEqual(diffLines('x\ny', ''), [
		{ kind: 'removed', text: 'x' },
		{ kind: 'removed', text: 'y' },
	])
	const same = diffLines('a\nb', 'a\nb')
	assert.ok(same.every(line => line.kind === 'context'))
	assert.equal(same.length, 2)
})

test('diffLines borne les remplacements massifs sans table LCS', () => {
	const oldText = Array.from({ length: 50 }, (_, i) => `old ${i}`).join('\n')
	const newText = Array.from({ length: 50 }, (_, i) => `new ${i}`).join('\n')
	const diff = diffLines(oldText, newText)
	assert.equal(diff.filter(line => line.kind === 'removed').length, 50)
	assert.equal(diff.filter(line => line.kind === 'added').length, 50)
	assert.equal(
		diff.some(line => line.kind === 'context'),
		false,
	)
})

test('parseEditArgs valide strictement la forme canonique edits[]', () => {
	assert.deepEqual(
		parseEditArgs({
			path: '/a/f.ts',
			edits: [
				{ oldText: 'x', newText: 'y' },
				{ oldText: 'a', newText: 'b' },
			],
		}),
		{
			path: '/a/f.ts',
			edits: [
				{ oldText: 'x', newText: 'y' },
				{ oldText: 'a', newText: 'b' },
			],
		},
	)
	for (const invalid of [
		{ path: '/a/f.ts' },
		{ path: '/a/f.ts', edits: [] },
		{ path: '/a/f.ts', edits: JSON.stringify([]) },
		{ path: '/a/f.ts', oldText: 'x', newText: 'y' },
		{ file_path: '/a/f.ts', edits: [{ oldText: 'x', newText: 'y' }] },
		{ path: '/a/f.ts', edits: [{ oldText: 1, newText: 'y' }] },
		undefined,
	]) {
		assert.equal(parseEditArgs(invalid), undefined)
	}
})

test('parseNativeEditDiff récupère type, numéro réel et indentation', () => {
	assert.deepEqual(
		parseNativeEditDiff('  9 context\n-10   old\n+10   new\n     ...'),
		[
			{ kind: 'context', lineNumber: 9, text: 'context' },
			{ kind: 'removed', lineNumber: 10, text: '  old' },
			{ kind: 'added', lineNumber: 10, text: '  new' },
			{ kind: 'context', text: '...' },
		],
	)
})
