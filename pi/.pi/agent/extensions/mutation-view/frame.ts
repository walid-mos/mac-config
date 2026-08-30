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
import type { DiffLine } from "../edit-view/diff.ts";

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

export interface FrameTheme {
	fg(role: string, text: string): string;
}

export interface MutationFrameComponent {
	render(width: number): string[];
	invalidate(): void;
}

export interface MutationFrameSpec {
	tool: "edit" | "write";
	path: string;
	meta: string;
	nativeLabel: string;
	diffs: ReadonlyArray<ReadonlyArray<DiffLine>>;
}

function titleRow(spec: MutationFrameSpec, width: number): string {
	const base = spec.path.split("/").pop() || spec.path;
	const plain = ` · ${base} · ${spec.meta}`;
	const label = `${fgHex(JSON_COLOR.TITLE, `${STYLE.BOLD}${spec.tool}${STYLE.BOLD_OFF}`)}${fgHex(JSON_COLOR.META, plain)}`;
	return frameEdge({ width, left: "╭", right: "╮", label, ...PALETTE });
}

function footerRow(hiddenLineCount: number, nativeLabel: string, width: number): string {
	const text = hiddenLineCount > 0 ? `⤢ +${hiddenLineCount} lignes · ctrl+o` : `ctrl+o · ${nativeLabel}`;
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

export function mutationFrameRows(spec: MutationFrameSpec, width: number, theme: FrameTheme): string[] {
	const w = frameWidth(width);
	const rows: string[] = [titleRow(spec, w)];
	spec.diffs.forEach((diff, index) => {
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
		return [rows[0], ...faded, footerRow(contentRows - FRAME_MAX_LINES, spec.nativeLabel, w)];
	}
	rows.push(footerRow(0, spec.nativeLabel, w));
	return rows;
}

function fadeAnsiRow(row: string, ratio: number): string {
	return row.replace(
		/\x1b\[38;2;(\d+);(\d+);(\d+)m/g,
		(_match, red: string, green: string, blue: string) =>
			fgHex(blendHex(rgbToHex(red, green, blue), PALETTE.base, ratio), ""),
	);
}

function rgbToHex(red: string, green: string, blue: string): string {
	const channel = (value: string) => Number(value).toString(16).padStart(2, "0");
	return `#${channel(red)}${channel(green)}${channel(blue)}`;
}
