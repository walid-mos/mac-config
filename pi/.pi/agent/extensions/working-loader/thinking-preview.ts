import { terminalLineWidth } from "../ui/terminal-text.ts";

export const THINKING_ICON = "\u{f09d1}";
export const THINKING_FALLBACK_LABEL = "raisonnement";
export const MAX_THINKING_PREVIEW_COLUMNS = 48;
export const MAX_THINKING_BUFFER_LENGTH = 8192;

/** Keep only a bounded tail: the preview cares about the current thought. */
export function appendThinkingDelta(buffer: string, delta: string): string {
	const combined = `${buffer}${delta}`;
	return combined.length <= MAX_THINKING_BUFFER_LENGTH
		? combined
		: combined.slice(-MAX_THINKING_BUFFER_LENGTH);
}

/**
 * Converts streamed reasoning into a safe single-line tail window. This is an
 * ephemeral excerpt, not a second-model semantic summary.
 */
export function rollingThinkingPreview(buffer: string, width: number): string {
	const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
	if (safeWidth === 0) return "";
	const normalized = normalizeThinkingText(buffer);
	if (normalized === "") return "";
	if (terminalLineWidth(normalized) <= safeWidth) return normalized;
	if (safeWidth === 1) return "…";

	const marker = "…";
	const budget = safeWidth - terminalLineWidth(marker);
	const reversed: string[] = [];
	let used = 0;
	for (const character of Array.from(normalized).reverse()) {
		const characterWidth = terminalLineWidth(character);
		if (used + characterWidth > budget) break;
		reversed.push(character);
		used += characterWidth;
	}
	return `${marker}${reversed.reverse().join("").trimStart()}`;
}

export function normalizeThinkingText(buffer: string): string {
	return buffer
		.replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/gu, "")
		.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "")
		.replace(/\u001B[_^P].*?(?:\u001B\\|\u0007)/gsu, "")
		.replace(/\u001B[^\s]*$/gu, "")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "")
		.replace(/^\s{0,3}(?:#{1,6}|[-+*>])\s+/gmu, "")
		.replace(/[`*_~]/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
}
