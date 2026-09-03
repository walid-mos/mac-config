import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
	existsSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'
import { pathToFileURL } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

import { publishCompactStyle } from '../extensions/compact-tools/api.ts'

const agentDir =
	process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi', 'agent')
const packageDir = join(agentDir, 'npm', 'node_modules', 'pi-web-access')
const helperPath = join(packageDir, 'compact-render.ts')
const patchPath = join(agentDir, 'npm-patches', 'pi-web-access.patch')

assert.ok(
	existsSync(helperPath),
	'pi-web-access compact renderer is missing; run make pi-post to apply the versioned patch',
)

function addedFileFromPatch(patch: string, path: string): string {
	const section = patch
		.split(/^diff --git /mu)
		.find(candidate => candidate.startsWith(`a/${path} b/${path}\n`))
	assert.ok(section, `${path} is missing from the pi-web-access patch`)
	const body = section.slice(section.indexOf('\n+++ b/') + 1)
	return body
		.split('\n')
		.slice(2)
		.filter(line => line.startsWith('+'))
		.map(line => line.slice(1))
		.join('\n')
}

const versionedPatch = readFileSync(patchPath, 'utf8')
const compactRenderSource = addedFileFromPatch(
	versionedPatch,
	'compact-render.ts',
)
const indexSource = addedFileFromPatch(versionedPatch, 'index.ts')
const bundleDir = await mkdtemp(join(tmpdir(), 'pi-web-render-'))
const patchedHelperPath = join(bundleDir, 'compact-render.ts')
const bundlePath = join(bundleDir, 'compact-render.mjs')
const tuiEntry = createRequire(realpathSync(helperPath)).resolve(
	'@earendil-works/pi-tui',
)
writeFileSync(patchedHelperPath, compactRenderSource)
execFileSync(
	'npx',
	[
		'esbuild',
		patchedHelperPath,
		'--bundle',
		'--platform=node',
		'--packages=external',
		'--format=esm',
		`--alias:@earendil-works/pi-tui=${tuiEntry}`,
		`--outfile=${bundlePath}`,
	],
	{ cwd: packageDir, stdio: 'ignore' },
)
after(() => rmSync(bundleDir, { recursive: true, force: true }))

publishCompactStyle()

const { createWebRows, messageRow } = await import(
	pathToFileURL(bundlePath).href
)

const theme = {
	fg: (_role: string, text: string) => text,
	bold: (text: string) => text,
}

const expandedBody = [
	'',
	'  "Pi extension APIs" (openai)',
	'',
	'  Réponse synthétisée',
	'',
	'  ▸ Documentation Pi · pi.dev',
]

function searchRows() {
	return createWebRows('web_search', {
		subject: (args: { query?: string }) =>
			args.query ? `"${args.query}"` : '',
		summary: (result: {
			isError?: boolean
			details?: { totalResults?: number; error?: string }
		}) => {
			const details = result.details
			if (result.isError === true || typeof details?.error === 'string') {
				return (details?.error ?? '').split('\n')[0] ?? ''
			}
			if (typeof details?.totalResults !== 'number') return ''
			return `${details.totalResults} sources`
		},
		expanded: () => ({
			render: () => expandedBody,
			invalidate() {},
		}),
	})
}

test('la row web compacte suit le même cycle pending, succès et erreur', () => {
	const context = { state: {} as Record<string, unknown> }
	const rows = searchRows()
	const row = rows.renderCall({ query: 'Pi extension APIs' }, theme, context)
	assert.deepEqual(row.render(80), ['● web_search · "Pi extension APIs"'])

	const collapsed = rows.renderResult(
		{ content: [], details: { totalResults: 3 } },
		{ expanded: false },
		theme,
		context,
	)
	assert.deepEqual(collapsed.render(80), [])
	assert.deepEqual(row.render(80), [
		'✓ web_search · "Pi extension APIs" · 3 sources',
	])

	const failed = rows.renderResult(
		{
			content: [],
			isError: true,
			details: { error: 'introuvable\ndétail' },
		},
		{ expanded: false },
		theme,
		context,
	)
	assert.deepEqual(failed.render(80), [])
	assert.deepEqual(row.render(80), [
		'✗ web_search · "Pi extension APIs" · introuvable',
	])
})

test('les notifications web utilisent une row compacte bornée', () => {
	const row = messageRow(
		'content ready',
		'ok',
		'7/10 URLs',
		'contenu partiel · response-1',
		theme,
		0,
	)
	const lines = row.render(120)
	assert.equal(lines.length, 1)
	assert.equal(
		lines[0],
		'✓ content ready · 7/10 URLs · contenu partiel · response-1',
	)
	const narrow = row.render(24)
	assert.equal(narrow.length, 1)
	assert.ok(stripVTControlCharacters(narrow[0]!).length <= 24)
})

test('la recherche étendue conserve réponse et sources sans curation', () => {
	const context = { state: {} as Record<string, unknown> }
	const rows = searchRows()
	rows.renderCall({ query: 'Pi extension APIs' }, theme, context)
	const result = {
		content: [{ type: 'text', text: 'Réponse synthétisée' }],
		details: {
			totalResults: 1,
			queryDetails: [
				{
					query: 'Pi extension APIs',
					provider: 'openai',
					answer: 'Réponse synthétisée',
					sources: [
						{
							title: 'Documentation Pi',
							url: 'https://pi.dev/docs',
						},
					],
					error: null,
				},
			],
		},
	}
	assert.deepEqual(
		rows
			.renderResult(result, { expanded: false }, theme, context)
			.render(80),
		[],
	)
	assert.deepEqual(
		rows
			.renderResult(result, { expanded: true }, theme, context)
			.render(80),
		expandedBody,
	)
	assert.deepEqual(
		rows
			.renderResult(result, { isPartial: true }, theme, context)
			.render(80),
		expandedBody,
	)
	assert.match(indexSource, /else if \(details\?\.queryDetails\?\.length\)/u)
})

test('le patch couvre toutes les surfaces web homologues', () => {
	for (const rows of [
		'searchRows',
		'sourceCheckRows',
		'fetchRows',
		'getContentRows',
	]) {
		assert.match(
			indexSource,
			new RegExp(`renderCall:\\s*${rows}\\.renderCall`),
		)
		assert.match(
			indexSource,
			new RegExp(`renderResult:\\s*${rows}\\.renderResult`),
		)
	}
	for (const customType of [
		'web-search-content-ready',
		'web-search-error',
		'web-search-results',
	]) {
		assert.match(
			indexSource,
			new RegExp(
				`registerMessageRenderer\\("${customType}"[\\s\\S]*?messageRow\\(`,
			),
		)
	}
	for (const obsolete of [
		'renderCompactCall',
		'renderCompactMessage',
		'settleCompactResult',
	]) {
		assert.doesNotMatch(compactRenderSource, new RegExp(obsolete))
	}
})
