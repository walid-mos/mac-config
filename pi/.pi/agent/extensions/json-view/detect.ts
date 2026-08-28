/** Détection de blocs JSON dans du markdown : fences ```json et JSON brut ancré en début de ligne. */

export type JsonSource = "fence" | "raw";

export interface JsonBlock {
	/** Comment le bloc a été détecté. */
	source: JsonSource;
	/** Offset de début du bloc dans le markdown source (début de ligne pour `raw`). */
	start: number;
	/** Offset juste après le bloc. */
	end: number;
	/** Texte JSON tel qu'écrit dans le message. */
	raw: string;
	/** Valeur parsée (JSON.parse garanti valide). */
	parsed: unknown;
}

/** En deçà de cette taille, un JSON brut monoligne est considéré comme du contenu inline et laissé tel quel. */
export const MIN_RAW_LENGTH = 60;

const FENCE_PATTERN = /```([^\n]*)\n([\s\S]*?)```/g;
const RAW_START_PATTERN = /^[ \t]*([{[])/gm;

/** Repère le `}` / `]` fermant en tenant compte des chaînes et des échappements. */
export function findBalancedEnd(text: string, openIndex: number): number {
	const open = text[openIndex];
	const close = open === "{" ? "}" : "]";
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = openIndex; i < text.length; i++) {
		const char = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === open) depth++;
		else if (char === close && --depth === 0) return i + 1;
	}
	return -1;
}

function overlaps(occupied: Array<[number, number]>, start: number, end: number): boolean {
	return occupied.some(([from, to]) => start < to && end > from);
}

function parseJson(raw: string): unknown | undefined {
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * Extrait les blocs JSON d'un markdown, triés par position.
 * - fences ```json, et fences sans langage dont le contenu parse ;
 * - JSON brut ancré en début de ligne (`{` ou `[`), équilibré, parseable,
 *   et assez grand pour ne pas toucher au JSON inline de la prose.
 * Le contenu des fences, JSON ou pas, n'est jamais scanné comme JSON brut.
 */
export function extractJsonBlocks(markdown: string): JsonBlock[] {
	const blocks: JsonBlock[] = [];
	const occupied: Array<[number, number]> = [];

	for (const match of markdown.matchAll(FENCE_PATTERN)) {
		const start = match.index;
		occupied.push([start, start + match[0].length]);
	}

	// Fence ouverte non fermée (streaming) : son contenu est du code en cours de
	// frappe, rendu par pi avec son propre cadre — on ne le boxe surtout pas
	// à l'intérieur (sinon boîte dans fence = rendu cassé).
	const openers = [...markdown.matchAll(/^```/gm)].map((m) => m.index);
	if (openers.length % 2 === 1) {
		occupied.push([openers[openers.length - 1], markdown.length]);
	}

	for (const match of markdown.matchAll(FENCE_PATTERN)) {
		const start = match.index;
		const end = start + match[0].length;
		const lang = (match[1] ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
		const body = (match[2] ?? "").trim();
		if (body.length === 0) continue;
		// Une fence explicitement étiquetée json est toujours reformatée ; sans langage,
		// on exige un contenu substantiel pour ne pas retoucher un exemple de code court.
		if (lang === "json") {
			blocks.push({ source: "fence", start, end, raw: body, parsed: parseJson(body) });
			continue;
		}
		if (lang !== "" || body.length < MIN_RAW_LENGTH) continue;
		const parsed = parseJson(body);
		if (parsed === undefined) continue;
		blocks.push({ source: "fence", start, end, raw: body, parsed });
	}

	for (const match of markdown.matchAll(RAW_START_PATTERN)) {
		const lineStart = match.index;
		const openIndex = lineStart + match[0].indexOf(match[1]);
		const endIndex = findBalancedEnd(markdown, openIndex);
		if (endIndex === -1) continue;
		if (overlaps(occupied, lineStart, endIndex)) continue;
		const raw = markdown.slice(openIndex, endIndex);
		if (raw.length < MIN_RAW_LENGTH && !raw.includes("\n")) continue;
		const parsed = parseJson(raw);
		if (parsed === undefined) continue;
		blocks.push({ source: "raw", start: lineStart, end: endIndex, raw, parsed });
		occupied.push([lineStart, endIndex]);
	}

	return blocks.sort((a, b) => a.start - b.start);
}
