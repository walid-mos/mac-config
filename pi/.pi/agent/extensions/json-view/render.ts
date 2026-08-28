/** Mise en forme markdown d'un bloc JSON détecté : séparateur slim, pas de fence, cap de lignes. */

import { terminalLineWidth } from "../ui/terminal-text.ts";
import { extractJsonBlocks, type JsonBlock } from "./detect.ts";

/** Cap dur par défaut : un JSON replié n'affiche au plus que ces lignes de pretty. */
export const JSON_MAX_LINES = 18;

export interface JsonRenderOptions {
	/** État global d'expansion de pi (/json). Déplié = pretty complet, sans cap. */
	expanded: boolean;
	/** Colonnes disponibles pour le contenu du message. */
	width: number;
	/** URL file:// du blob persisté, pour les liens cliquables. */
	linkUrl?: string;
}

export function formatJsonBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
	if (bytes >= 1024) return `${(bytes / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
	return `${bytes.toLocaleString("fr-FR")} o`;
}

export function prettyJson(parsed: unknown): string {
	return JSON.stringify(parsed, null, 2);
}

/**
 * Neutralise la syntaxe markdown dans le JSON affiché en texte brut :
 * sans ça, `"note": "*gras*"` ou `<tag>` seraient interprétés par le renderer.
 */
export function escapeMarkdownText(text: string): string {
	return text.replace(/([\\`*_\[\]<>~])/g, "\\$1");
}

/**
 * Séparateur slim dimensionné à la largeur : `── json · 160 o · 13 lignes · lien ────`.
 * Le lien clic ouvre le blob complet via le handler OS (OSC 8).
 */
export function renderJsonHeader(pretty: string, options: JsonRenderOptions): string {
	const lines = pretty.split("\n").length.toLocaleString("fr-FR");
	const bytes = formatJsonBytes(Buffer.byteLength(pretty));
	const openUrl = options.linkUrl;
	const labelPlain = `── json · ${bytes} · ${lines} lignes${openUrl ? " · ouvrir ⤢" : ""}`;
	const labelMd = openUrl
		? `── json · ${bytes} · ${lines} lignes · [ouvrir ⤢](${openUrl})`
		: labelPlain;
	const used = terminalLineWidth(labelPlain) + 1;
	const rule = "─".repeat(Math.max(3, options.width - used));
	return `${labelMd} ${rule}`;
}

/** Ligne de fin de bloc replié : cliquable, ouvre le JSON complet. */
function renderTruncatedMarker(hiddenLines: number, linkUrl: string | undefined): string {
	const label = `⤢ +${hiddenLines.toLocaleString("fr-FR")} lignes · tout voir`;
	return linkUrl ? `[${label}](${linkUrl})` : `${label} — /json open`;
}

/** Rend un bloc JSON : séparateur slim + pretty en texte brut (cappé à JSON_MAX_LINES si replié). */
export function renderJsonBlock(block: JsonBlock, options: JsonRenderOptions): string {
	const pretty = prettyJson(block.parsed);
	const allLines = pretty.split("\n");
	const header = renderJsonHeader(pretty, options);

	let contentLines = allLines;
	let marker: string | undefined;
	if (!options.expanded && allLines.length > JSON_MAX_LINES) {
		contentLines = allLines.slice(0, JSON_MAX_LINES);
		marker = renderTruncatedMarker(allLines.length - JSON_MAX_LINES, options.linkUrl);
	}

	const content = escapeMarkdownText(contentLines.join("\n"));
	return marker ? `${header}\n${content}\n${marker}` : `${header}\n${content}`;
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
 * Réécrit le markdown en isolant chaque bloc JSON détecté : lignes vides autour,
 * séparateur slim, pretty en texte brut. Ne modifie rien en l'absence de JSON.
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
		result += renderJsonBlock(block, { expanded: options.expanded, width: options.width, linkUrl });
		result += "\n\n";
		cursor = block.end;
	}

	const tail = markdown.slice(cursor);
	// Évite l'empilement de lignes vides quand le markdown reprend déjà par une séparation.
	result += tail.replace(/^\n+/, (leading) => (result.endsWith("\n\n") && leading.length > 0 ? "" : leading));
	return result;
}
