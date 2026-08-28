/** Registre des blobs JSON détectés : fichier temporaire par contenu (hash) + historique pour /json open. */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prettyJson } from "./render.ts";

export interface JsonBlob {
	hash: string;
	path: string;
	/** URL file:// pour les liens OSC 8 cliquables. */
	url: string;
	pretty: string;
	bytes: number;
}

/** Historique borné : les blocs les plus récents restent ouvrables via /json open [n]. */
const MAX_BLOBS = 100;

let blobDir = process.env.PI_JSON_VIEW_DIR ?? join(tmpdir(), "pi-json-view");
const blobs: JsonBlob[] = [];

/** Change le répertoire de persistance (tests). Les historiques déjà chargés sont conservés. */
export function setBlobDir(dir: string): void {
	blobDir = dir;
}

/** Blobs dans l'ordre d'apparition (le plus récent en dernier). */
export function recentBlobs(): JsonBlob[] {
	return [...blobs];
}

/** Blob correspondant au n-ième JSON le plus récent (1 = dernier). */
export function blobByRecency(index: number): JsonBlob | undefined {
	if (index < 1) return undefined;
	return blobs[blobs.length - index];
}

function fileUrl(path: string): string {
	return `file://${encodeURI(path)}`;
}

/**
 * Persiste le JSON pretty-printé dans un fichier dérivé de son hash et mémorise le blob.
 * Ne lève jamais : le transformateur est un chemin d'affichage.
 */
export function persistJson(raw: string, parsed: unknown): string | undefined {
	void raw;
	try {
		const pretty = prettyJson(parsed);
		const hash = createHash("sha256").update(pretty).digest("hex").slice(0, 12);
		const known = blobs.find((blob) => blob.hash === hash);
		if (known) return known.url;

		mkdirSync(blobDir, { recursive: true });
		const path = join(blobDir, `${hash}.json`);
		if (!existsSync(path)) writeFileSync(path, `${pretty}\n`, "utf8");
		const blob: JsonBlob = {
			hash,
			path,
			url: fileUrl(path),
			pretty,
			bytes: Buffer.byteLength(pretty),
		};
		blobs.push(blob);
		if (blobs.length > MAX_BLOBS) blobs.shift();
		return blob.url;
	} catch {
		return undefined;
	}
}
