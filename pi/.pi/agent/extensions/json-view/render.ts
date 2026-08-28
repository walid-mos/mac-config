/**
 * Bloc JSON spécialisé : boîte Catppuccin Latte (palette du footer), coloration
 * syntaxique JSON maison, hyperliens OSC 8. Rendu via le transformer markdown :
 * le texte ANSI brut traverse le renderer (vérifié), les caractères spéciaux
 * markdown sont échappés hors séquences ANSI pour éviter toute interprétation.
 */

import { LATTE, fgHex } from "../footer/style.ts";
import { hyperlink, terminalLineWidth, truncateTerminalLine } from "../ui/terminal-text.ts";
import { extractJsonBlocks, type JsonBlock } from "./detect.ts";

/** Cap dur par défaut : un JSON replié n'affiche au plus que ces lignes de contenu. */
export const JSON_MAX_LINES = 18;

const C_BORDER = LATTE.overlay1;
const C_PUNCT = LATTE.overlay1;
const C_KEY = LATTE.blue;
const C_STRING = LATTE.green;
const C_NUMBER = LATTE.peach;
const C_LITERAL = LATTE.mauve;
const C_TITLE = LATTE.mauve;
const C_META = LATTE.subtext0;
const C_LINK = LATTE.sapphire;

const BOLD = "\x1b[1m";
const BOLD_OFF = "\x1b[22m";

export function formatJsonBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
	if (bytes >= 1024) return `${(bytes / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
	return `${bytes.toLocaleString("fr-FR")} o`;
}

export function prettyJson(parsed: unknown): string {
	return JSON.stringify(parsed, null, 2);
}

/**
 * Échappe les caractères spéciaux markdown hors séquences ANSI. `[` et `]` ne
 * sont PAS échappés : pi-tui ne consomme pas `\[` (rendu littéral), et un lien
 * ne peut se former que sur `](` — absent de nos blocs (liens OSC 8 bruts).
 */
export function escapeMarkdownOutsideAnsi(text: string): string {
	let out = "";
	let i = 0;
	while (i < text.length) {
		const char = text[i];
		if (char === "\x1b") {
			// Copie la séquence ANSI intacte (CSI … lettre finale ou OSC 8 … ST/BEL).
			if (text.startsWith("\x1b]8;", i)) {
				const end = text.indexOf("\x07", i);
				const stop = end !== -1 ? end : text.indexOf("\x1b\\", i);
				const cut = stop !== -1 ? (end !== -1 ? end : stop + 1) : text.length;
				out += text.slice(i, cut + 1);
				i = cut + 1;
				continue;
			}
			const match = /^\x1b\[[0-?]*[ -/]*[@-~]/.exec(text.slice(i));
			if (match) {
				out += match[0];
				i += match[0].length;
				continue;
			}
		}
		out += /[\\`*_<>~]/.test(char) ? `\\${char}` : char;
		i += 1;
	}
	return out;
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)|("(?:\\.|[^"\\])*")|(-?\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g;

/** Coloration syntaxique JSON ligne par ligne, palette Latte du footer. */
export function highlightJsonLine(line: string): string {
	let out = "";
	let last = 0;
	for (const match of line.matchAll(JSON_TOKEN)) {
		const start = match.index;
		out += line.slice(last, start);
		if (match[1] !== undefined) {
			out += fgHex(C_KEY, match[1]) + (match[2] ? fgHex(C_PUNCT, match[2]) : "");
		} else if (match[3] !== undefined) {
			out += fgHex(C_STRING, match[3]);
		} else if (match[4] !== undefined) {
			out += fgHex(C_LITERAL, match[4]);
		} else if (match[5] !== undefined) {
			out += fgHex(C_NUMBER, match[5]);
		} else {
			out += fgHex(C_PUNCT, match[0]);
		}
		last = start + match[0].length;
	}
	out += line.slice(last);
	return out;
}

function boxRow(width: number, content: string, renderedVisible: number): string {
	// renderedVisible = largeur APRÈS consommation des backslashes d'échappement
	// par marked : c'est elle qui décide de la position du bord droit.
	const pad = Math.max(0, width - renderedVisible - 4);
	return `${fgHex(C_BORDER, "│")} ${content}${" ".repeat(pad)} ${fgHex(C_BORDER, "│")}`;
}

function boxEdge(
	width: number,
	left: string,
	right: string,
	labelAnsi: string,
	labelVisible: number,
): string {
	// total = left(1) + ─(1) + espace(1) + label + espace(1) + fill + right(1)
	const fill = Math.max(2, width - labelVisible - 5);
	return `${fgHex(C_BORDER, `${left}─ `)}${labelAnsi} ${fgHex(C_BORDER, `${"─".repeat(fill)}${right}`)}`;
}

export interface JsonRenderOptions {
	/** État global d'expansion de pi (/json). Déplié = pretty complet, sans cap. */
	expanded: boolean;
	/** Colonnes disponibles pour le contenu du message. */
	width: number;
	/** URL file:// du blob persisté, pour les liens cliquables OSC 8. */
	linkUrl?: string;
}

/**
 * Bloc JSON : boîte arrondie Latte, JSON coloré, cap JSON_MAX_LINES si replié.
 * Rangée du bas = affordances cliquables (OSC 8, pas de syntaxe lien markdown :
 * un `[` de séquence ANSI pourrait sinon s'apparier au `](url)` dans marked).
 */
export function renderJsonBox(block: JsonBlock, options: JsonRenderOptions): string {
	const pretty = prettyJson(block.parsed);
	const allLines = pretty.split("\n");
	const width = Math.max(20, Math.floor(options.width));

	const titleText = `json · ${formatJsonBytes(Buffer.byteLength(pretty))} · ${allLines.length.toLocaleString("fr-FR")} lignes`;
	const title = `${fgHex(C_TITLE, `${BOLD}json${BOLD_OFF}`)}${fgHex(C_META, titleText.slice(4))}`;
	const rows = [boxEdge(width, "╭", "╮", title, titleText.length)];

	const capped = !options.expanded && allLines.length > JSON_MAX_LINES;
	const shown = capped ? allLines.slice(0, JSON_MAX_LINES) : allLines;
	for (const line of shown) {
		// Échapper avant la coloration (sinon le backslash ajouté serait re-échappé),
		// puis compenser le pad : marked consomme les backslashes au rendu.
		const escaped = escapeMarkdownOutsideAnsi(line);
		const escapes = escaped.length - line.length;
		const budget = Math.max(8, width - 4 - escapes);
		const colored = truncateTerminalLine(highlightJsonLine(escaped), budget, "…");
		rows.push(boxRow(width, colored, terminalLineWidth(colored) - escapes));
	}

	const bottomLabel = capped
		? `⤢ +${(allLines.length - JSON_MAX_LINES).toLocaleString("fr-FR")} lignes · tout voir`
		: `ouvrir ⤢ · /json open`;
	const bottomAnsi = options.linkUrl
		? fgHex(C_LINK, hyperlink(bottomLabel, options.linkUrl))
		: fgHex(C_META, bottomLabel);
	const bottomVisible = terminalLineWidth(bottomLabel);
	rows.push(boxEdge(width, "╰", "╯", bottomAnsi, bottomVisible));

	return rows.join("\n");
}

function padBeforeBlock(text: string): string {
	if (text.length === 0) return "";
	if (/\n[ \t]*\n$/.test(text)) return text;
	if (/\n$/.test(text)) return `${text}\n`;
	return `${text}\n\n`;
}

export interface JsonTransformOptions {
	expanded: boolean;
	width: number;
	/** Persiste le blob et renvoie son URL file:// (injecté pour rester testable). */
	persist?: (raw: string, parsed: unknown) => string | undefined;
}

/**
 * Réécrit le markdown en isolant chaque bloc JSON détecté dans son bloc
 * spécialisé. Ne modifie rien en l'absence de JSON.
 */
export function transformMarkdown(markdown: string, options: JsonTransformOptions): string {
	const blocks = extractJsonBlocks(markdown);
	if (blocks.length === 0) return markdown;

	let result = "";
	let cursor = 0;
	for (const block of blocks) {
		result += markdown.slice(cursor, block.start);
		result = padBeforeBlock(result);
		const linkUrl = options.persist?.(block.raw, block.parsed);
		result += renderJsonBox(block, { expanded: options.expanded, width: options.width, linkUrl });
		result += "\n\n";
		cursor = block.end;
	}

	const tail = markdown.slice(cursor);
	// Évite l'empilement de lignes vides quand le markdown reprend déjà par une séparation.
	result += tail.replace(/^\n+/, (leading) => (result.endsWith("\n\n") && leading.length > 0 ? "" : leading));
	return result;
}
