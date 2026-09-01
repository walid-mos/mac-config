import assert from 'node:assert/strict'
import test from 'node:test'

import { compactRowLine } from '../extensions/compact-tools/line.ts'
import { TOOL_VIEW_REGISTRY } from '../extensions/compact-tools/registry.ts'
import {
	COMPACT_TOOLS,
	baseName,
	countTextLines,
	subjectFor,
	summarizeResult,
	toSingleLine,
} from '../extensions/compact-tools/summary.ts'

import { theme } from './compact-tools.test-helpers.ts'

import type { CompactToolResult } from '../extensions/compact-tools/types.ts'

test('le registre couvre tous les propriétaires de rows sans liste parallèle', () => {
	assert.deepEqual([...COMPACT_TOOLS], ['read', 'grep', 'find', 'ls', 'bash'])
	assert.deepEqual(Object.keys(TOOL_VIEW_REGISTRY), [
		'read',
		'grep',
		'find',
		'ls',
		'bash',
		'edit',
		'write',
	])
	assert.equal(TOOL_VIEW_REGISTRY.edit.expandedResult, 'custom')
	assert.equal(TOOL_VIEW_REGISTRY.write.stackRows, false)
	assert.equal(TOOL_VIEW_REGISTRY.bash.owner, 'compact-tools')
})

test('toSingleLine réduit les commandes multilignes', () => {
	assert.equal(toSingleLine('a\nb\r\nc'), 'a b c')
})

test('baseName garde le dernier segment POSIX', () => {
	assert.equal(baseName('/a/b/agent.ts'), 'agent.ts')
	assert.equal(baseName('agent.ts'), 'agent.ts')
})

test('subjectFor extrait le sujet par tool', () => {
	assert.equal(subjectFor('bash', { command: 'pnpm\ntest' }), 'pnpm test')
	assert.equal(subjectFor('read', { path: '/a/b/agent.ts' }), 'agent.ts')
	assert.equal(
		subjectFor('read', { path: '/a/b/agent.ts', offset: 5 }),
		'agent.ts dès la ligne 5',
	)
	assert.equal(subjectFor('grep', { pattern: 'foo.*bar' }), '"foo.*bar"')
	assert.equal(subjectFor('ls', { path: '/a/b/c' }), 'c')
	assert.equal(subjectFor('write', { path: '/a/b/new.ts' }), 'new.ts')
})

test('countTextLines compte les lignes non vides', () => {
	assert.equal(countTextLines(''), 0)
	assert.equal(countTextLines('a'), 1)
	assert.equal(countTextLines('a\nb\nc'), 3)
})

test('summarizeResult bash extrait le code de sortie du message natif', () => {
	const ok: CompactToolResult = {
		content: [{ type: 'text', text: 'out' }],
		isError: false,
	}
	assert.equal(summarizeResult('bash', ok), '')
	const fail: CompactToolResult = {
		content: [{ type: 'text', text: 'boom\nCommand exited with code 2' }],
		isError: true,
	}
	assert.equal(summarizeResult('bash', fail), 'exit 2')
	const timeout: CompactToolResult = {
		content: [
			{ type: 'text', text: 'err: Command timed out after 30 seconds' },
		],
		isError: true,
	}
	assert.equal(summarizeResult('bash', timeout), 'timeout 30s')
})

test('summarizeResult read utilise totalLines et marque la troncature', () => {
	const result: CompactToolResult = {
		content: [{ type: 'text', text: 'ligne\nligne' }],
		details: { truncation: { truncated: true, totalLines: 250 } },
	}
	assert.equal(summarizeResult('read', result), '250 lignes · tronqué')
})

test('summarizeResult grep/find/ls signalent les limites atteintes', () => {
	const grep: CompactToolResult = {
		content: [],
		details: { matchLimitReached: 200 },
	}
	assert.equal(summarizeResult('grep', grep), '200+ correspondances')
	const find: CompactToolResult = {
		content: [],
		details: { resultLimitReached: 50 },
	}
	assert.equal(summarizeResult('find', find), '50+ résultats')
	const ls: CompactToolResult = {
		content: [{ type: 'text', text: 'a\nb' }],
		details: {},
	}
	assert.equal(summarizeResult('ls', ls), '2 lignes')
})

test("summarizeResult edit/write résume la première ligne d'erreur seulement", () => {
	const ok: CompactToolResult = {
		content: [{ type: 'text', text: 'ok' }],
		isError: false,
	}
	assert.equal(summarizeResult('edit', ok), '')
	const fail: CompactToolResult = {
		content: [{ type: 'text', text: 'oldText introuvable\ndétails' }],
		isError: true,
	}
	assert.equal(summarizeResult('edit', fail), 'oldText introuvable')
	assert.equal(summarizeResult('write', fail), 'oldText introuvable')
})

test('compactRowLine compose glyphe, label, sujet et résumé', () => {
	const line = compactRowLine(
		{
			tool: 'bash',
			subject: 'pnpm test',
			state: { status: 'error', summary: 'exit 1' },
			theme,
		},
		80,
		theme,
	)
	assert.equal(line, '✗ bash · pnpm test · exit 1')
})

test('compactRowLine tronque à la largeur demandée', () => {
	const line = compactRowLine(
		{ tool: 'bash', subject: 'x'.repeat(200), state: { status: 'ok' } },
		40,
		theme,
	)
	assert.ok(line.length <= 40 + '…'.length)
	assert.ok(line.startsWith('✓ bash'))
})
