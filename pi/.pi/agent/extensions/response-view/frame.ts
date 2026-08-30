import type { Theme } from "@earendil-works/pi-coding-agent";

export const RESPONSE_RULE_MAX_WIDTH = 88;

export type ResponseTheme = Pick<Theme, "fg" | "bold">;

export interface ResponseFrameOptions {
	width: number;
	isStreaming: boolean;
	theme: ResponseTheme;
}

const LABEL = "réponse";
const TOP_LEAD = "╭─";
const BOTTOM_LEAD = "╰";

function ruleWidth(width: number): number {
	if (!Number.isFinite(width)) return 1;
	return Math.max(1, Math.min(Math.floor(width), RESPONSE_RULE_MAX_WIDTH));
}

/** A quiet labelled separator which stays short on ultrawide terminals. */
export function responseTopRule(width: number, theme: ResponseTheme): string {
	const targetWidth = ruleWidth(width);
	const labelledWidth = TOP_LEAD.length + 1 + LABEL.length + 1;
	if (targetWidth < labelledWidth) {
		return theme.fg("muted", "─".repeat(targetWidth));
	}
	const fill = "─".repeat(targetWidth - labelledWidth);
	return `${theme.fg("accent", TOP_LEAD)} ${theme.fg("accent", theme.bold(LABEL))} ${theme.fg("muted", fill)}`;
}

/** The answer remains visually open while tokens stream, then settles closed. */
export function responseBottomRule(width: number, theme: ResponseTheme): string {
	const targetWidth = ruleWidth(width);
	if (targetWidth === 1) return theme.fg("accent", BOTTOM_LEAD);
	return `${theme.fg("accent", BOTTOM_LEAD)}${theme.fg("muted", "─".repeat(targetWidth - 1))}`;
}

/** Display-only decoration; the session and model context keep the original Markdown. */
export function frameAssistantMarkdown(markdown: string, options: ResponseFrameOptions): string {
	if (markdown.trim().length === 0) return markdown;
	const top = responseTopRule(options.width, options.theme);
	const body = markdown.trim();
	if (options.isStreaming) return `${top}\n\n${body}`;
	return `${top}\n\n${body}\n\n${responseBottomRule(options.width, options.theme)}`;
}
