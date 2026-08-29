import assert from 'node:assert/strict'
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs'
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

function withBlobDirectory(runAssertions: (directory: string) => void): void {
	const directory = mkdtempSync(join(tmpdir(), 'json-view-test-'))
	setBlobDir(directory)
	try {
		runAssertions(directory)
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
}

test('stores one private file per content and keeps recency order', () => {
	withBlobDirectory(directory => {
		const firstUrl = persistJson(JSON.parse(BIG_JSON))
		const repeatedUrl = persistJson(JSON.parse(BIG_JSON))
		const secondUrl = persistJson(JSON.parse(SMALL_JSON))
		assert.equal(firstUrl, repeatedUrl)
		assert.notEqual(firstUrl, secondUrl)
		assert.deepEqual(
			recentBlobs().map(blob => blob.url),
			[firstUrl, secondUrl],
		)
		assert.match(firstUrl ?? '', /^file:\/\//)

		const fileMode = statSync(recentBlobs()[0]?.path ?? '').mode & 0o777
		const directoryMode = statSync(directory).mode & 0o777
		assert.equal(fileMode, 0o600)
		assert.equal(directoryMode, 0o700)
	})
})

test('rehydrates history after a module-state reset', () => {
	withBlobDirectory(directory => {
		const url = persistJson(JSON.parse(BIG_JSON))
		assert.ok(url)
		setBlobDir(`${directory}/`)
		const blob = blobByRecency(1)
		assert.ok(blob)
		assert.equal(blob.url, url)
		assert.equal(readBlob(blob), BIG_JSON)
	})
})

test('rebuilds blob paths instead of trusting serialized paths', () => {
	withBlobDirectory(directory => {
		const hash = 'aaaaaaaaaaaa'
		const localPath = join(directory, `${hash}.json`)
		writeFileSync(localPath, '{"safe":true}\n', 'utf8')
		writeFileSync(
			join(directory, 'index.json'),
			JSON.stringify([
				{
					hash,
					bytes: 13,
					path: '/etc/passwd',
					url: 'file:///etc/passwd',
				},
			]),
			'utf8',
		)
		setBlobDir(directory)
		const blob = blobByRecency(1)
		assert.ok(blob)
		assert.equal(blob.path, localPath)
		assert.equal(readBlob(blob), '{"safe":true}')
	})
})

test('evicts old files with history beyond the retention limit', () => {
	withBlobDirectory(directory => {
		persistJson({ sequence: 0 })
		const evictedPath = recentBlobs()[0]?.path
		assert.ok(evictedPath)
		for (let sequence = 1; sequence <= 100; sequence += 1) {
			persistJson({ sequence })
		}
		assert.equal(recentBlobs().length, 100)
		assert.equal(existsSync(evictedPath), false)
		assert.equal(
			JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8'))
				.length,
			100,
		)
	})
})
