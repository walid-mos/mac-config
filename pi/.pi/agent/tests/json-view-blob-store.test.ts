import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
	blobByRecency,
	persistJson,
	readBlob,
	recentBlobs,
	setBlobDir,
} from '../extensions/json-view/blob-store.ts'

import { BIG_JSON, SMALL_JSON } from './json-view.test.fixtures.ts'

test('blob-store : un fichier par contenu, historique ordonné', () => {
	const directory = mkdtempSync(join(tmpdir(), 'json-view-test-'))
	setBlobDir(directory)
	try {
		const urlA = persistJson(BIG_JSON, JSON.parse(BIG_JSON))
		const repeatedUrl = persistJson(BIG_JSON, JSON.parse(BIG_JSON))
		assert.equal(urlA, repeatedUrl)
		const urlB = persistJson(SMALL_JSON, JSON.parse(SMALL_JSON))
		assert.notEqual(urlA, urlB)
		assert.deepEqual(
			recentBlobs().map(blob => blob.url),
			[urlA, urlB],
		)
		assert.match(urlA ?? '', /^file:\/\//)
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
})

test('blob-store : historique réhydraté après reset (simulate reload)', () => {
	const directory = mkdtempSync(join(tmpdir(), 'json-view-test-'))
	setBlobDir(directory)
	const url = persistJson(BIG_JSON, JSON.parse(BIG_JSON))
	assert.ok(url)

	// ctx.reload() réimporte le module : historique vidé, puis relu depuis index.json.
	setBlobDir(`${directory}/`)
	const blob = blobByRecency(1)
	assert.ok(blob)
	assert.equal(blob.url, url)
	// readBlob rend le contenu sans le retour à la ligne final d'écriture.
	assert.equal(readBlob(blob), BIG_JSON)

	rmSync(directory, { recursive: true, force: true })
})
