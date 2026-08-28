/** Mise en forme markdown d'un bloc JSON détecté : en-tête, aperçu minifié ou bloc complet. */

import { truncateTerminalLine } from "../ui/terminal-text.ts";
import { extractJsonBlocks, type JsonBlock } from "./detect.ts";

/** Au-delà de ce nombre de lignes en mode replié, le JSON est affiché minifié sur une ligne. */
export const COLLAPSED_LINE_THRESHOLD = 16;

export interface JsonRenderOptions {
	/** État global d'expansion de pi (ctrl+o). Déplié = bloc pretty complet. */
	expanded: boolean;
	/** Colonnes disponibles pour le contenu du message. */
	width: number;
	/** URL file:// du blob persisté, pour le lien cliquable de l'en-tête. */
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

/** En-tête sobre : type, taille, nb de lignes, lien cliquable, commande d'ouverture. */
export function renderJsonHeader(pretty: string, options: JsonRenderOptions): string {
	const lines = pretty.split("\n").length.toLocaleString("fr-FR");
	const bytes = formatJsonBytes(Buffer.byteLength(pretty));
	const open = options.linkUrl ? ` · [ouvrir ⤢](${options.linkUrl})` : "";
	return `*json · ${bytes} · ${lines} lignes · \`/json open\`${open}*`;
}

/** Rend un bloc JSON : en-tête séparateur + fence (complète, ou aperçu minifié si replié). */
export function renderJsonBlock(block: JsonBlock, options: JsonRenderOptions): string {
	const pretty = prettyJson(block.parsed);
	const header = renderJsonHeader(pretty, options);
	const lineCount = pretty.split("\n").length;

	if (!options.expanded && lineCount > COLLAPSED_LINE_THRESHOLD) {
		const minified = JSON.stringify(block.parsed);
		// Place réservée au suffixe " …" pour rester dans la largeur du terminal.
		const budget = Math.max(20, options.width - 2);
		const preview = `${truncateTerminalLine(minified, budget)} …`;
		return `${header}\n\n\`\`\`json\n${preview}\n\`\`\``;
	}

	return `${header}\n\n\`\`\`json\n${pretty}\n\`\`\``;
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
 * en-tête descriptif, fence dédiée. Ne modifie rien en l'absence de JSON.
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
