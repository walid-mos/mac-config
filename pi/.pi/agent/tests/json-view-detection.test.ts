import assert from 'node:assert/strict'
import test from 'node:test'

import {
	detectJsonMarkdown,
	MIN_RAW_LENGTH,
} from '../extensions/json-view/detect-json.ts'
import { findBalancedEnd } from '../extensions/json-view/json-structure.ts'

import { SMALL_JSON } from './json-view.test.fixtures.ts'

import type {
	JsonBlock,
	OpenJson,
} from '../extensions/json-view/detect-json.ts'

function extractJsonBlocks(markdown: string): JsonBlock[] {
	return detectJsonMarkdown(markdown).blocks
}

function findOpenRawJson(markdown: string): OpenJson | undefined {
	return detectJsonMarkdown(markdown).openRaw
}

test('detects an explicit json fence', () => {
	const markdown = `Avant\n\n\`\`\`json\n${SMALL_JSON}\n\`\`\`\n\nAprès`
	const blocks = extractJsonBlocks(markdown)
	assert.equal(blocks.length, 1)
	assert.equal(blocks[0]?.source, 'fence')
	assert.deepEqual(blocks[0]?.parsed, { a: 1, b: [2, 3] })
})

test('detects long unlabelled backtick and tilde fences', () => {
	const body = JSON.stringify({
		kind: 'review',
		session: 'render-fixture-v2',
		note: '0123456789012345678901234567890123456789',
	})
	assert.equal(extractJsonBlocks(`\`\`\`\`\n${body}\n\`\`\`\``).length, 1)
	assert.equal(extractJsonBlocks(`~~~\n${body}\n~~~`).length, 1)
})

test('ignores short unlabelled and non-json fences', () => {
	assert.deepEqual(extractJsonBlocks(`\`\`\`\n${SMALL_JSON}\n\`\`\``), [])
	assert.deepEqual(extractJsonBlocks('```ts\nconst x = { a: 1 };\n```'), [])
})

test('ignores a closed invalid json fence', () => {
	assert.deepEqual(extractJsonBlocks('```json\n{ invalide }\n```'), [])
})

test('does not treat a closing fence as a new opening fence', () => {
	const markdown = '```ts\nconst x = 1\n```\n{\n  "id": 1,'
	const detection = detectJsonMarkdown(markdown)
	assert.equal(detection.openFence, undefined)
	assert.ok(detection.openRaw)
})

test('detects incomplete raw json without a fence', () => {
	const partial =
		'Texte avant.\n\n{\n  "id": 1,\n  "nom": "Projet Atlas",\n  "reg'
	const openJson = findOpenRawJson(partial)
	assert.ok(openJson)
	assert.equal(openJson.start, partial.indexOf('{'))
	assert.ok(openJson.content.startsWith('{'))
	assert.ok(findOpenRawJson('{\n  "nom": "Projet At'))
	assert.ok(findOpenRawJson('{\n  "nom": "Projet \\'))
})

test('keeps the streamed array root instead of an inner object', () => {
	const entries = Array.from(
		{ length: 11 },
		(_, index) => `  {"id": ${index + 1}, "name": "item-0${index + 1}"},`,
	).join('\n')
	const fragment = `[\n${entries}\n  {"id": 12, "name": "item-`
	const openJson = findOpenRawJson(fragment)
	assert.ok(openJson)
	assert.equal(openJson.start, 0)
	assert.ok(openJson.content.startsWith('['))
	assert.ok(
		findOpenRawJson(fragment.slice(0, fragment.lastIndexOf('},') + 2)),
	)
})

test('rejects prose that starts with a brace', () => {
	assert.equal(
		findOpenRawJson('Un template :\n\n{\n  et voila du texte libre'),
		undefined,
	)
	assert.equal(
		findOpenRawJson(
			'{\n  "titre": "Mon doc",\n  ceci n est pas du json mais voila',
		),
		undefined,
	)
	assert.equal(
		findOpenRawJson(
			'{\n  "cle": "valeur",\n  and then prose that is not json',
		),
		undefined,
	)
	assert.equal(
		findOpenRawJson('[Note] ceci est une note en cours'),
		undefined,
	)
})

test('accepts incomplete json at each structural cut', () => {
	assert.ok(findOpenRawJson('{\n  "id": 1,'))
	assert.ok(findOpenRawJson('{\n  "id": 1,\n  "reg'))
	assert.ok(findOpenRawJson('{\n  "id": 1,\n  "nom": "Projet At'))
	assert.ok(findOpenRawJson('{\n  "id": 1,\n  "poids": 7'))
})

test('gives an open fence priority over raw detection', () => {
	assert.equal(findOpenRawJson('```json\n{"a":'), undefined)
	assert.equal(findOpenRawJson(SMALL_JSON), undefined)
	assert.equal(findOpenRawJson('texte {"a": 1'), undefined)
	assert.equal(findOpenRawJson('```\n{"x":\n```\nTexte final.'), undefined)
})

test('detects long minified raw json at line start', () => {
	const raw = JSON.stringify({
		kind: 'review',
		session: 'render-fixture-v2',
		note: '0123456789012345678901234567890123456789',
	})
	assert.ok(raw.length > MIN_RAW_LENGTH)
	const markdown = `Texte avant.\n${raw}\nTexte après.`
	const [block] = extractJsonBlocks(markdown)
	assert.ok(block)
	assert.equal(block.source, 'raw')
	assert.deepEqual(block.parsed, JSON.parse(raw))
	assert.equal(markdown.slice(block.start, block.end), raw)
})

test('detects indented multiline raw json from the line boundary', () => {
	const markdown = `Intro :\n  ${SMALL_JSON.replaceAll('\n', '\n  ')}\nFin.`
	const [block] = extractJsonBlocks(markdown)
	assert.deepEqual(block?.parsed, { a: 1, b: [2, 3] })
	assert.equal(block?.start, markdown.indexOf('  {'))
})

test('handles braces in strings and mixed nested containers', () => {
	const raw = `{"code":"if (a) { return \\"}\\"; }","values":[{"note":"${'x'.repeat(MIN_RAW_LENGTH)}"}]}`
	const [block] = extractJsonBlocks(`${raw}\nsuite`)
	assert.equal(block?.end, raw.length)
	assert.equal(findBalancedEnd('{"values":[{"ok":true}]}', 0), 24)
	assert.equal(findBalancedEnd('{"values":[}', 0), -1)
})

test('does not let unmatched prose hide a later complete json block', () => {
	const markdown = `Exemple :\n{ prose libre\n\n${SMALL_JSON}`
	assert.equal(extractJsonBlocks(markdown).length, 1)
})

test('leaves short inline and non-strict json alone', () => {
	assert.deepEqual(
		extractJsonBlocks('Voir {"a": 1} dans le texte et { du texte libre.'),
		[],
	)
	assert.deepEqual(extractJsonBlocks('{ a: 1, b: () => 2 } et puis rien'), [])
})
