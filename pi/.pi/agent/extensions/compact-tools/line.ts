/**
 * Pure composition of the single themed line for a compact tool row:
 * `✓ bash · pnpm test · exit 0`. Truncation goes through the shared
 * ui/terminal-text primitives so ANSI styling is width-safe.
 */

import { truncateTerminalLine } from "../ui/terminal-text.ts";
import type { CompactRowState, CompactTheme } from "./types.ts";

export type CompactRowTone = "normal" | "muted" | "dim";

const GLYPHS = {
	pending: { glyph: "●", role: "accent" },
	ok: { glyph: "✓", role: "success" },
	error: { glyph: "✗", role: "error" },
} as const;

export interface CompactRowView {
	tool: string;
	subject: string;
	state: CompactRowState;
	theme: CompactTheme;
	/** Expansion flag at last rebuild, so hideOnSuccess rows stay visible. */
	expanded?: boolean;
}

/** Compose the row line for the given terminal width. Already ≤ width. */
export function compactRowLine(
	view: CompactRowView,
	width: number,
	theme: CompactTheme,
	tone: CompactRowTone = "normal",
	depth = 0,
): string {
	const { glyph, role } = GLYPHS[view.state.status ?? "pending"];
	const indent = " ".repeat(Math.max(0, depth));
	const summary = view.state.summary;
	if (tone !== "normal") {
		let plain = `${indent}${glyph} ${view.tool}`;
		if (view.subject.length > 0) plain += ` · ${view.subject}`;
		if (summary && summary.length > 0) plain += ` · ${summary}`;
		return truncateTerminalLine(theme.fg(tone, plain), width, "…");
	}
	let line = `${indent}${theme.fg(role, glyph)} ${theme.fg("accent", theme.bold(view.tool))}`;
	if (view.subject.length > 0) line += theme.fg("text", ` · ${view.subject}`);
	if (summary && summary.length > 0) line += theme.fg("dim", ` · ${summary}`);
	return truncateTerminalLine(line, width, "…");
}
