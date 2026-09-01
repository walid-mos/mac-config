import assert from 'node:assert/strict'
import test from 'node:test'

import { JSON_MAX_LINES } from '../extensions/json-view/json-frame.ts'
import { transformMarkdown } from '../extensions/json-view/transform-markdown.ts'
import { PI_PALETTE as LATTE } from '../extensions/ui/design-system/palette.ts'

import {
	ansiColor,
	BIG_JSON,
	plainTerminalText,
	renderedTerminalText,
	SMALL_JSON,
} from './json-view.test.fixtures.ts'

test('renders a growing frame for raw streaming json', () => {
	const partial =
		'Voici :\n\n{\n  "id": 1,\n  "nom": "Projet Atlas",\n  "stat'
	const transformed = transformMarkdown(partial, {
		expanded: false,
		width: 96,
	})
	const plain = plainTerminalText(transformed)
	assert.ok(plain.startsWith('Voici :\n\n╭─ json ·'))
	assert.ok(plain.includes('"nom": "Projet Atlas"'))
	assert.ok(plain.includes('génération…'))

	const complete = transformMarkdown(`Voici :\n\n${SMALL_JSON}\n\nAprès.`, {
		expanded: false,
		width: 96,
	})
	assert.ok(plainTerminalText(complete).includes('╭─ json ·'))
	assert.ok(!plainTerminalText(complete).includes('génération…'))
})

test('keeps every raw streaming frame row at the requested width', () => {
	const partial = '{\n  "id": 1,\n  "nom": "Projet Atlas",\n  "reg'
	const transformed = transformMarkdown(partial, {
		expanded: false,
		width: 80,
	})
	for (const row of transformed.split('\n')) {
		const plain = plainTerminalText(row)
		if (/^[╭│╰]/.test(plain)) {
			assert.equal([...renderedTerminalText(row)].length, 80)
		}
	}
})

test('replaces an open json fence with a growing colored frame', () => {
	const partial = 'Voici :\n\n```json\n{\n  "id": 5,\n  "actif": true\n}'
	const transformed = transformMarkdown(partial, {
		expanded: false,
		width: 96,
	})
	assert.ok(!transformed.includes('```'))
	const plain = plainTerminalText(transformed)
	assert.ok(plain.startsWith('Voici :\n\n╭─ json ·'))
	assert.ok(plain.includes('"id": 5'))
	assert.ok(plain.includes('génération…'))
	assert.ok(transformed.includes(ansiColor(LATTE.blue)))

	const grown = transformMarkdown(
		`${partial.slice(0, -1)},\n  "email": "user5@example.com"\n}`,
		{ expanded: false, width: 96 },
	)
	assert.ok(grown.includes('"email"'))
	assert.ok(!grown.includes('```'))
})

test('preserves a closed non-json fence before a raw stream', () => {
	const markdown = '```ts\nconst x = 1\n```\n{\n  "id": 1,'
	const transformed = transformMarkdown(markdown, {
		expanded: false,
		width: 80,
	})
	assert.ok(transformed.startsWith('```ts\nconst x = 1\n```\n'))
	assert.ok(transformed.includes('génération…'))
})

test('leaves a closed invalid json fence unchanged', () => {
	const markdown = '```json\n{ invalide }\n```'
	assert.equal(
		transformMarkdown(markdown, { expanded: false, width: 80 }),
		markdown,
	)
})

test('renders a specialized persisted block without a markdown fence', () => {
	const markdown = `Avant.\n${SMALL_JSON}\nAprès.`
	const transformed = transformMarkdown(markdown, {
		expanded: false,
		width: 96,
		persist: () => 'file:///tmp/x.json',
	})
	const rows = transformed.split('\n').map(plainTerminalText)
	assert.equal(rows[0], 'Avant.')
	const boxStart = rows.findIndex(row => row.startsWith('╭─'))
	assert.ok(boxStart > 0)
	assert.ok(rows[boxStart]?.includes('json ·'))
	assert.ok(rows[boxStart]?.trimEnd().endsWith('╮'))
	assert.ok(rows.some(row => row.includes('"a"')))
	assert.ok(
		rows.some(
			row => row.trimEnd().endsWith('╯') && row.includes('ouvrir ⤢'),
		),
	)
	assert.ok(transformed.includes('file:///tmp/x.json'))
	assert.ok(!transformed.includes('```'))
})

test('colors json tokens and escapes markdown characters', () => {
	const tricky = JSON.stringify(
		{ note: '*gras* et <tag>', n: 3, ok: true },
		null,
		2,
	)
	const transformed = transformMarkdown(tricky, { expanded: true, width: 96 })
	assert.ok(transformed.split(ansiColor(LATTE.blue)).length >= 3)
	assert.ok(transformed.includes(ansiColor(LATTE.green)))
	assert.ok(transformed.includes(ansiColor(LATTE.peach)))
	assert.ok(transformed.includes(ansiColor(LATTE.mauve)))
	assert.ok(transformed.includes('\\*gras\\*'))
	assert.ok(transformed.includes('\\<tag\\>'))
})

test('caps large json with a fade and a clickable marker', () => {
	const transformed = transformMarkdown(BIG_JSON, {
		expanded: false,
		width: 96,
		persist: () => 'file:///tmp/big.json',
	})
	assert.ok(transformed.includes('164 lignes'))
	assert.ok(transformed.includes('"item-3"'))
	assert.ok(!transformed.includes('"item-4"'))
	assert.ok(transformed.includes('⤢ +146 lignes · tout voir'))
	assert.ok(transformed.includes('file:///tmp/big.json'))
})

test('renders one frame for an array streamed object by object', () => {
	const entries = Array.from(
		{ length: 40 },
		(_, index) =>
			`  { "id": ${index}, "name": "item-${index}", "desc": "élément de charge numéro ${index}" },`,
	).join('\n')
	const transformed = transformMarkdown(`[\n${entries}\n  { "id": 41, `, {
		expanded: false,
		width: 96,
	})
	assert.equal(plainTerminalText(transformed).split('json ·').length - 1, 1)

	const complete = JSON.stringify(
		{
			kind: 'review',
			session: 'render-fixture-v2',
			note: 'assez long pour passer le seuil',
		},
		null,
		2,
	)
	const mixed = transformMarkdown(
		`${complete}\n\n[\n  { "id": 1, "name": "a" },`,
		{ expanded: false, width: 96 },
	)
	assert.equal(plainTerminalText(mixed).split('json ·').length - 1, 2)
})

test('shows every line when expanded and caps only large json', () => {
	const expanded = transformMarkdown(BIG_JSON, { expanded: true, width: 96 })
	assert.ok(expanded.includes('"item-39"'))
	assert.ok(!expanded.includes('tout voir'))

	assert.ok(SMALL_JSON.split('\n').length <= JSON_MAX_LINES)
	const small = transformMarkdown(SMALL_JSON, { expanded: false, width: 96 })
	assert.ok(small.includes('"b"'))
	assert.ok(!small.includes('tout voir'))
})

test('leaves markdown without json untouched', () => {
	const markdown = '# Titre\n\nDu texte { sans JSON }.'
	assert.equal(
		transformMarkdown(markdown, { expanded: false, width: 80 }),
		markdown,
	)
})
