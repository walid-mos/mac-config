import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import test, { after } from 'node:test'

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi', 'agent')
const packageDir = join(agentDir, 'npm', 'node_modules', 'pi-web-access')
const helperPath = join(packageDir, 'compact-render.ts')

assert.ok(
	existsSync(helperPath),
	'pi-web-access compact renderer is missing; run make pi-post to apply the versioned patch',
)

const bundleDir = await mkdtemp(join(tmpdir(), 'pi-web-render-'))
const bundlePath = join(bundleDir, 'compact-render.mjs')
execFileSync(
	'npx',
	[
		'esbuild',
		helperPath,
		'--bundle',
		'--platform=node',
		'--format=esm',
		`--outfile=${bundlePath}`,
	],
	{ cwd: packageDir, stdio: 'ignore' },
)
after(() => rmSync(bundleDir, { recursive: true, force: true }))

const {
	renderCompactCall,
	renderCompactMessage,
	settleCompactResult,
} = await import(pathToFileURL(bundlePath).href)

const theme = {
	fg: (_role: string, text: string) => text,
	bold: (text: string) => text,
}

test('la row web compacte suit le même cycle pending, succès et erreur', () => {
	const context = { state: {} as Record<string, unknown> }
	const row = renderCompactCall('get content', 'response-1 · URL 0', theme, context)
	assert.deepEqual(row.render(80), ['● get content · response-1 · URL 0'])

	settleCompactResult({ details: {} }, context, '4200 car.')
	assert.deepEqual(row.render(80), ['✓ get content · response-1 · URL 0 · 4200 car.'])

	settleCompactResult({ details: { error: 'introuvable\ndétail' } }, context, '')
	assert.deepEqual(row.render(80), ['✗ get content · response-1 · URL 0 · introuvable'])
})

test('les notifications web utilisent une row compacte bornée', () => {
	const row = renderCompactMessage(
		'content ready',
		'ok',
		'7/10 URLs',
		'contenu partiel · response-1',
		theme,
	)
	assert.equal(row.render(120)[0], '✓ content ready · 7/10 URLs · contenu partiel · response-1')
	assert.ok(stripVTControlCharacters(row.render(24)[0]!).length <= 24)
})

test('le patch couvre toutes les surfaces web homologues', () => {
	const source = readFileSync(join(packageDir, 'index.ts'), 'utf8')
	for (const label of ['search', 'source check', 'fetch', 'get content']) {
		assert.match(source, new RegExp(`renderCompactCall\\(\\"${label}\\"`))
	}
	for (const customType of [
		'web-search-content-ready',
		'web-search-error',
		'web-search-results',
	]) {
		assert.match(source, new RegExp(`registerMessageRenderer\\(\\"${customType}\\"`))
	}
	assert.equal(source.match(/renderShell: "self"/g)?.length, 4)
})
