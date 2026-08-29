import { createHash } from 'node:crypto'
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { prettyJson } from './json-value.ts'

import type { JsonValue } from './json-value.ts'

const STORE = {
	MAX_BLOBS: 100,
	HASH_LENGTH: 12,
	DIRECTORY_MODE: 0o700,
	FILE_MODE: 0o600,
} as const

const HASH_PATTERN = new RegExp(`^[\\da-f]{${STORE.HASH_LENGTH}}$`)

type JsonBlobIndexEntry = {
	hash: string
	bytes: number
}

export type JsonBlob = JsonBlobIndexEntry & {
	path: string
	url: string
}

let blobDirectory = resolve(
	process.env.PI_JSON_VIEW_DIR ?? join(tmpdir(), 'pi-json-view'),
)
let blobs: JsonBlob[] = []
let hasLoaded = false

function indexPath(): string {
	return join(blobDirectory, 'index.json')
}

function blobFromEntry(entry: JsonBlobIndexEntry): JsonBlob {
	const path = join(blobDirectory, `${entry.hash}.json`)
	return { ...entry, path, url: pathToFileURL(path).href }
}

function isIndexEntry(
	entryCandidate: unknown,
): entryCandidate is JsonBlobIndexEntry {
	if (typeof entryCandidate !== 'object' || entryCandidate === null)
		return false
	if (!('hash' in entryCandidate) || !('bytes' in entryCandidate))
		return false
	return (
		typeof entryCandidate.hash === 'string' &&
		HASH_PATTERN.test(entryCandidate.hash) &&
		typeof entryCandidate.bytes === 'number' &&
		Number.isSafeInteger(entryCandidate.bytes) &&
		entryCandidate.bytes > 0
	)
}

function readIndex(): JsonBlob[] {
	const parsed: unknown = JSON.parse(readFileSync(indexPath(), 'utf8'))
	if (!Array.isArray(parsed)) return []
	return parsed
		.filter(isIndexEntry)
		.slice(-STORE.MAX_BLOBS)
		.map(blobFromEntry)
		.filter(blob => existsSync(blob.path))
}

function ensureLoaded(): void {
	if (hasLoaded) return
	hasLoaded = true
	try {
		blobs = readIndex()
	} catch {
		blobs = []
	}
}

function privateWrite(path: string, content: string): void {
	writeFileSync(path, content, { encoding: 'utf8', mode: STORE.FILE_MODE })
	chmodSync(path, STORE.FILE_MODE)
}

function removeFile(path: string): void {
	try {
		rmSync(path, { force: true })
	} catch {
		// Cleanup is best effort on the transcript rendering path.
	}
}

function saveIndex(): void {
	const temporaryPath = `${indexPath()}.${process.pid}.tmp`
	try {
		mkdirSync(blobDirectory, {
			recursive: true,
			mode: STORE.DIRECTORY_MODE,
		})
		chmodSync(blobDirectory, STORE.DIRECTORY_MODE)
		const entries = blobs.map(({ hash, bytes }) => ({ hash, bytes }))
		privateWrite(temporaryPath, JSON.stringify(entries))
		renameSync(temporaryPath, indexPath())
	} catch {
		removeFile(temporaryPath)
	}
}

function removeEvictedFiles(evictedBlobs: JsonBlob[]): void {
	for (const blob of evictedBlobs) removeFile(blob.path)
}

function rememberBlob(blob: JsonBlob): void {
	const nextBlobs = [...blobs, blob]
	const firstRetainedIndex = Math.max(0, nextBlobs.length - STORE.MAX_BLOBS)
	removeEvictedFiles(nextBlobs.slice(0, firstRetainedIndex))
	blobs = nextBlobs.slice(firstRetainedIndex)
	saveIndex()
}

export function setBlobDir(directory: string): void {
	blobDirectory = resolve(directory)
	blobs = []
	hasLoaded = false
}

export function recentBlobs(): JsonBlob[] {
	ensureLoaded()
	return [...blobs]
}

export function blobByRecency(recency: number): JsonBlob | undefined {
	if (recency < 1) return undefined
	ensureLoaded()
	return blobs.at(-recency)
}

export function readBlob(blob: JsonBlob): string {
	return readFileSync(blob.path, 'utf8').replace(/\n$/, '')
}

function persistPrettyJson(pretty: string, hash: string): JsonBlob {
	mkdirSync(blobDirectory, { recursive: true, mode: STORE.DIRECTORY_MODE })
	chmodSync(blobDirectory, STORE.DIRECTORY_MODE)
	const blob = blobFromEntry({ hash, bytes: Buffer.byteLength(pretty) })
	if (existsSync(blob.path)) chmodSync(blob.path, STORE.FILE_MODE)
	else privateWrite(blob.path, `${pretty}\n`)
	return blob
}

export function persistJson(parsed: JsonValue): string | undefined {
	ensureLoaded()
	try {
		const pretty = prettyJson(parsed)
		const hash = createHash('sha256')
			.update(pretty)
			.digest('hex')
			.slice(0, STORE.HASH_LENGTH)
		const knownBlob = blobs.find(blob => blob.hash === hash)
		if (knownBlob && existsSync(knownBlob.path)) return knownBlob.url
		const blob = persistPrettyJson(pretty, hash)
		if (!knownBlob) rememberBlob(blob)
		return blob.url
	} catch {
		return undefined
	}
}
