/**
 * Collapsed edit view: one rounded frame (the json-view look, via the shared
 * ui/frame primitives) containing a line diff per edits[] entry. Capped and
 * faded like JSON blocks; ctrl+o shows the native full-file diff instead.
 */

import { fgHex } from "../footer/style.ts";
import {
	blendHex,
	frameContentWidth,
	frameDotsRow,
	frameEdge,
	frameRow,
	frameRowFadeRatio,
	frameWidth,
	FRAME_FADE_ROWS,
	FRAME_MAX_LINES,
	type FramePalette,
} from "../ui/frame.ts";
import { terminalLineWidth, truncateTerminalLine } from "../ui/terminal-text.ts";
import { JSON_COLOR } from "../json-view/json-colors.ts";

import { diffLines, type DiffLine } from "./diff.ts";

const PALETTE: FramePalette = {
	border: JSON_COLOR.BORDER,
	base: JSON_COLOR.BASE,
};

const STYLE = {
	BOLD: "\x1b[1m",
	BOLD_OFF: "\x1b[22m",
} as const;

const DIFF_PREFIX = {
	removed: "-",
	added: "+",
	context: " ",
} as const;

/** Minimal theme surface (subset of the pi theme handed to renderers). */
export interface FrameTheme {
	fg(role: string, text: string): string;
}

export interface EditFrameComponent {
	render(width: number): string[];
	invalidate(): void;
}

/** Accepts the native arg shapes: edits[] (possibly a JSON string) or the
 * legacy single oldText/newText pair. Undefined when nothing is parseable. */
export function parseEditArgs(
	args: Record<string, unknown> | undefined,
): { path: string; edits: Array<{ oldText: string; newText: string }> } | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const path = String(args.path ?? args.file_path ?? "");
	let rawEdits: unknown = args.edits;
	if (typeof rawEdits === "string") {
		try {
			rawEdits = JSON.parse(rawEdits);
		} catch {
			return undefined;
		}
	}
	const edits: Array<{ oldText: string; newText: string }> = [];
	if (Array.isArray(rawEdits)) {
		for (const entry of rawEdits) {
			if (typeof entry !== "object" || entry === null) return undefined;
			const record = entry as Record<string, unknown>;
			edits.push({
				oldText: String(record.oldText ?? ""),
				newText: String(record.newText ?? ""),
			});
		}
	} else if ("oldText" in args || "newText" in args) {
		edits.push({
			oldText: String(args.oldText ?? ""),
			newText: String(args.newText ?? ""),
		});
	} else {
		return undefined;
	}
	if (edits.length === 0) return undefined;
	return { path, edits };
}

function titleRow(path: string, editCount: number, width: number): string {
	const base = path.split("/").pop() || path;
	const noun = editCount === 1 ? "édition" : "éditions";
	const plain = ` · ${base} · ${editCount} ${noun}`;
	const label = `${fgHex(JSON_COLOR.TITLE, `${STYLE.BOLD}edit${STYLE.BOLD_OFF}`)}${fgHex(JSON_COLOR.META, plain)}`;
	return frameEdge({ width, left: "╭", right: "╮", label, ...PALETTE });
}

function footerRow(hiddenLineCount: number, width: number): string {
	const text =
		hiddenLineCount > 0
			? `⤢ +${hiddenLineCount} lignes · ctrl+o`
			: "ctrl+o · diff natif";
	const color = hiddenLineCount > 0 ? JSON_COLOR.LINK : JSON_COLOR.META;
	return frameEdge({
		width,
		left: "╰",
		right: "╯",
		label: fgHex(color, text),
		...PALETTE,
	});
}

function diffRow(line: DiffLine, width: number, theme: FrameTheme): string {
	const role =
		line.kind === "removed"
			? "toolDiffRemoved"
			: line.kind === "added"
				? "toolDiffAdded"
				: "toolDiffContext";
	const content = theme.fg(role, `${DIFF_PREFIX[line.kind]} ${line.text}`);
	const truncated = truncateTerminalLine(content, frameContentWidth(width), "…");
	return frameRow({
		width,
		content: truncated,
		visibleContentWidth: terminalLineWidth(truncated),
		...PALETTE,
	});
}

function blankRow(width: number): string {
	return frameRow({ width, content: "", visibleContentWidth: 0, ...PALETTE });
}

/** Assembles the frame rows for pre-computed per-edit diffs. */
export function editFrameRows(
	path: string,
	edits: ReadonlyArray<{ oldText: string; newText: string }>,
	diffs: ReadonlyArray<ReadonlyArray<DiffLine>>,
	width: number,
	theme: FrameTheme,
): string[] {
	const w = frameWidth(width);
	const rows: string[] = [titleRow(path, edits.length, w)];
	diffs.forEach((diff, index) => {
		if (index > 0) rows.push(blankRow(w));
		for (const line of diff) rows.push(diffRow(line, w, theme));
	});
	const contentRows = rows.length - 1;
	const isCapped = contentRows > FRAME_MAX_LINES;
	if (isCapped) {
		const solidRows = FRAME_MAX_LINES - FRAME_FADE_ROWS;
		const faded = rows
			.slice(1, 1 + FRAME_MAX_LINES)
			.map((row, index) => {
				const ratio = frameRowFadeRatio(index, solidRows, true);
				return ratio > 0 ? fadeAnsiRow(row, ratio) : row;
			});
		faded.push(frameDotsRow(w, PALETTE));
		return [rows[0], ...faded, footerRow(contentRows - FRAME_MAX_LINES, w)];
	}
	rows.push(footerRow(0, w));
	return rows;
}

/** Blends every truecolor sequence in the row toward the base color so the
 * fade matches the json-view blocks (ANSI chrome `\x1b[39m` untouched). */
function fadeAnsiRow(row: string, ratio: number): string {
	return row.replace(
		/\x1b\[38;2;(\d+);(\d+);(\d+)m/g,
		(_match, red: string, green: string, blue: string) =>
			fgHex(blendHex(rgbToHex(red, green, blue), PALETTE.base, ratio), ""),
	);
}

function rgbToHex(red: string, green: string, blue: string): string {
	const channel = (value: string) =>
		Number(value).toString(16).padStart(2, "0");
	return `#${channel(red)}${channel(green)}${channel(blue)}`;
}
