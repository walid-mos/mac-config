/** Registre des blobs JSON détectés : fichier temporaire par contenu (hash) + historique pour /json open. */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { prettyJson } from './json-value.ts'

import type { JsonValue } from './json-value.ts'

export type JsonBlob = {
	hash: string
	path: string
	/** URL file:// pour les liens OSC 8 cliquables. */
	url: string
	bytes: number
}

/** Historique borné : les blocs les plus récents restent ouvrables via /json open [n]. */
const MAX_BLOBS = 100

let blobDirectory = process.env.PI_JSON_VIEW_DIR ?? join(tmpdir(), 'pi-json-view')
let blobs: JsonBlob[] = []
let hasLoaded = false

function indexPath(): string {
	return join(blobDirectory, 'index.json')
}

/** Réhydrate l'historique depuis le disque : ctx.reload() réimporte ce module à zéro. */
function ensureLoaded(): void {
	if (hasLoaded) return
	hasLoaded = true
	try {
		const raw: unknown = JSON.parse(readFileSync(indexPath(), 'utf8'))
		if (Array.isArray(raw)) {
			blobs = raw.filter(
				(entry): entry is JsonBlob =>
					typeof entry?.hash === 'string' &&
					typeof entry?.path === 'string' &&
					typeof entry?.url === 'string',
			)
		}
	} catch {
		blobs = []
	}
}

function saveIndex(): void {
	try {
		writeFileSync(indexPath(), JSON.stringify(blobs), 'utf8')
	} catch {
		// L'historique est un confort : une écriture ratée ne doit rien casser.
	}
}

/** Change le répertoire de persistance ; l'historique sera réhydraté depuis ce répertoire. */
export function setBlobDir(directory: string): void {
	blobDirectory = directory
	blobs = []
	hasLoaded = false
}

/** Blobs dans l'ordre d'apparition (le plus récent en dernier). */
export function recentBlobs(): JsonBlob[] {
	ensureLoaded()
	return [...blobs]
}

/** Blob correspondant au n-ième JSON le plus récent (1 = dernier). */
export function blobByRecency(recency: number): JsonBlob | undefined {
	if (recency < 1) return undefined
	ensureLoaded()
	return blobs[blobs.length - recency]
}

/** Contenu pretty du blob, relu depuis le fichier persisté. */
export function readBlob(blob: JsonBlob): string {
	return readFileSync(blob.path, 'utf8').replace(/\n$/, '')
}

function fileUrl(path: string): string {
	return `file://${encodeURI(path)}`
}

/**
 * Persiste le JSON pretty-printé dans un fichier dérivé de son hash et mémorise le blob.
 * Ne lève jamais : le transformateur est un chemin d'affichage.
 */
export function persistJson(raw: string, parsed: JsonValue): string | undefined {
	void raw
	ensureLoaded()
	try {
		const pretty = prettyJson(parsed)
		const hash = createHash('sha256').update(pretty).digest('hex').slice(0, 12)
		const knownBlob = blobs.find(blob => blob.hash === hash)
		if (knownBlob) return knownBlob.url

		mkdirSync(blobDirectory, { recursive: true })
		const path = join(blobDirectory, `${hash}.json`)
		if (!existsSync(path)) writeFileSync(path, `${pretty}\n`, 'utf8')
		const blob: JsonBlob = {
			hash,
			path,
			url: fileUrl(path),
			bytes: Buffer.byteLength(pretty),
		}
		blobs.push(blob)
		if (blobs.length > MAX_BLOBS) blobs.shift()
		saveIndex()
		return blob.url
	} catch {
		return undefined
	}
}
