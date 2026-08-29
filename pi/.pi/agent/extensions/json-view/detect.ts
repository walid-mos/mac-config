/** Détection de blocs JSON dans du markdown : fences ```json, JSON brut ancré
 * en début de ligne, et JSON brut en cours de génération (streaming). */

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

export interface OpenJsonFence {
	start: number;
	content: string;
}

/**
 * Dernière fence ouverte (sans fermeture) = streaming en cours. Ne la renvoie
 * que si son contenu est candidat JSON : langage `json`, ou sans langage avec
 * contenu qui commence par `{` / `[`.
 */
export function findOpenJsonFence(markdown: string): OpenJsonFence | undefined {
	const openers = [...markdown.matchAll(/^[ \t]{0,3}```([^\n]*)\n/gm)];
	if (openers.length === 0) return undefined;
	const last = openers[openers.length - 1];
	const lastStart = last.index;
	if (markdown.indexOf("```", lastStart + 3) !== -1) return undefined;
	const lang = (last[1] ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
	const content = markdown.slice(lastStart + last[0].length);
	if (lang !== "json" && (lang !== "" || !/^[ \t]*[{[]/.test(content))) return undefined;
	return { start: lastStart, content };
}

function overlaps(occupied: Array<[number, number]>, start: number, end: number): boolean {
	return occupied.some(([from, to]) => start < to && end > from);
}

/** Le JSON « en cours de frappe » peut s'arrêter n'importe où : milieu d'une
 * chaîne, d'une clé, juste après une virgule. Stratégie : tronquer au dernier
 * point structurel viable (contenu complet, puis ouvertures/commas en
 * remontant), réparer la chaîne entamée, refermer les accolades, parser. Le
 * premier candidat qui parse valide le fragment.
 *
 * Deux gardes-fous anti-faux-positifs (prose commençant par `{`) :
 * - le fragment refermé ne doit pas être vide (`{}` / `[]`) — sinon tronquer
 *   jusqu'à l'accolade nue ferait passer n'importe quoi ;
 * - ce qui a été jeté par la troncature doit ressembler au début d'une valeur
 *   JSON (`"`, chiffre, `-`, `{`, `[`, t/f/n) — une queue de prose (" and then
 *   …") rejette le candidat. */
function parsesAsIncompleteJson(content: string): boolean {
	const structural: number[] = [];
	let inString = false;
	let escaped = false;
	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') inString = true;
		else if (char === "{" || char === "[" || char === ",") structural.push(i);
	}

	const candidates: string[] = [content];
	for (let k = structural.length - 1; k >= 0 && candidates.length < 12; k--) {
		const pos = structural[k];
		candidates.push(content.slice(0, pos));
		if (content[pos] !== ",") candidates.push(content.slice(0, pos + 1));
	}

	for (const base of candidates) {
		if (base.length === 0) continue;
		const stack: string[] = [];
		let stringOpen = false;
		let hasEscape = false;
		for (let i = 0; i < base.length; i++) {
			const char = base[i];
			if (stringOpen) {
				if (hasEscape) hasEscape = false;
				else if (char === "\\") hasEscape = true;
				else if (char === '"') stringOpen = false;
				continue;
			}
			if (char === '"') stringOpen = true;
			else if (char === "{" || char === "[") stack.push(char === "{" ? "}" : "]");
			else if (char === "}" || char === "]") stack.pop();
		}
		let suffix = "";
		if (hasEscape) suffix += "\\\\"; // backslash orphelin : à échapper lui-même
		if (stringOpen || hasEscape) suffix += '"';
		let parsed: unknown;
		try {
			parsed = JSON.parse(base + suffix + stack.reverse().join(""));
		} catch {
			continue;
		}
		// Garde-fou 1 : `{}` / `[]` = troncature jusqu'à l'accolade nue → rejet.
		const empty =
			typeof parsed !== "object" ||
			parsed === null ||
			(Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0);
		if (empty) continue;
		// Garde-fou 2 : la queue jetée doit amorcer une valeur JSON.
		let rest = content.slice(base.length).replace(/^[ \t\r\n]+/, "");
		if (rest.startsWith(",")) rest = rest.slice(1).replace(/^[ \t\r\n]+/, "");
		if (rest.length > 0 && !/^["\-0-9{[\dtfn]/.test(rest)) continue;
		return true;
	}
	return false;
}

export interface OpenRawJson {
	/** Offset du `{` / `[` d'ouverture dans le texte donné. */
	start: number;
	/** Fragment JSON inachevé, tel qu'écrit. */
	content: string;
}

/**
 * JSON brut SANS fence, en cours de génération : ancrage ligne-start `{` / `[`
 * hors fences, pas encore équilibré, dont le fragment devient du JSON valide
 * une fois réparé et refermé. C'est le déclencheur du cadre de croissance quand
 * le modèle n'enveloppe pas son JSON dans une fence. Une fence ouverte a la
 * priorité (findOpenJsonFence) ; un JSON complet est un bloc exact
 * (extractJsonBlocks).
 *
 * Les ancrages sont essayés du plus externe au plus interne : la racine du
 * JSON streamé est le premier ancrage non équilibré — les `{` internes (objets
 * d'un tableau en cours d'émission) sont ses enfants, pas des racines.
 */
export function findOpenRawJson(markdown: string): OpenRawJson | undefined {
	if (findOpenJsonFence(markdown)) return undefined;

	const occupied: Array<[number, number]> = [];
	for (const match of markdown.matchAll(FENCE_PATTERN)) {
		occupied.push([match.index, match.index + match[0].length]);
	}
	const openers = [...markdown.matchAll(/^```/gm)].map((m) => m.index);
	if (openers.length % 2 === 1) occupied.push([openers[openers.length - 1], markdown.length]);

	const anchors: number[] = [];
	for (const match of markdown.matchAll(RAW_START_PATTERN)) {
		const lineStart = match.index;
		if (overlaps(occupied, lineStart, lineStart + 1)) continue;
		anchors.push(lineStart + match[0].indexOf(match[1]));
	}

	for (const start of anchors) {
		const content = markdown.slice(start);
		// Complet → boîte exacte via extractJsonBlocks, pas de cadre de croissance.
		if (findBalancedEnd(content, 0) !== -1) continue;
		// JSON brut court sur une seule ligne = inline de la prose (cf. MIN_RAW_LENGTH).
		if (!content.includes("\n") && content.length < MIN_RAW_LENGTH) continue;
		if (!parsesAsIncompleteJson(content)) continue;
		return { start, content };
	}
	return undefined;
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
		// Un ancrage non équilibré s'étend jusqu'à la fin du texte : tout ce qui
		// suit est du JSON en cours de génération — le cadre de croissance
		// (findOpenRawJson) s'en charge. Extraire les objets intérieurs complétés
		// produirait une boîte par élément du tableau et un coût O(n²) à chaque
		// mise à jour du stream.
		if (endIndex === -1) break;
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
