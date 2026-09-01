import { LATTE } from "../footer/style.ts";
import {
	terminalLineWidth,
	truncateTerminalLine,
} from "../ui/terminal-text.ts";
import type { DiffLine } from "./diff.ts";

const STYLE = {
	BOLD: "\x1b[1m",
	BOLD_OFF: "\x1b[22m",
} as const;

const DIFF_PREFIX = {
	removed: "-",
	added: "+",
	context: " ",
} as const;

const MUTATION_MAX_LINES = 18;
const MUTATION_FADE_ROWS = 3;
const HEADER_CHROME_WIDTH = 6;
const ROW_CHROME_WIDTH = 2;
const NUMBER_GUTTER_CHROME_WIDTH = 5;
const DIFF_BG_OPACITY = 0.15;
const DIFF_BG_FADE_OPACITY = [0.1, 0.06, 0.03] as const;
const DIFF_BG_BASE = "#eff1f5";
const ANSI_BG_RESET = "\x1b[49m";

export interface FrameTheme {
	fg(role: string, text: string): string;
	getColorMode?(): "truecolor" | "256color";
}

interface DiffBackgrounds {
	added: string;
	removed: string;
	base: string;
	mode: "truecolor" | "256color";
}

interface LogicalEntry {
	line?: DiffLine;
	separator?: { index: number; total: number };
}

interface RenderEntry {
	line?: { value: DiffLine; text: string; continuation: boolean };
	separator?: { index: number; total: number };
}

interface CodeRowState {
	row: string;
	usedWidth: number;
}

interface DiffRowOptions {
	lineNumberWidth: number;
	width: number;
	theme: FrameTheme;
	backgrounds?: DiffBackgrounds;
	fadeIndex: number;
}

export interface MutationFrameComponent {
	render(width: number): string[];
	invalidate(): void;
}

export interface MutationFrameStat {
	text: string;
	role: string;
	separator?: " " | " · ";
}

export interface MutationFrameSpec {
	tool: "edit" | "write";
	path: string;
	stats: ReadonlyArray<MutationFrameStat>;
	nativeLabel: string;
	highlightChanges?: boolean;
	expanded?: boolean;
	diffs: ReadonlyArray<ReadonlyArray<DiffLine>>;
}

function normalizedWidth(width: number): number {
	if (!Number.isFinite(width)) return 1;
	return Math.max(1, Math.floor(width));
}

function statsLabel(stats: ReadonlyArray<MutationFrameStat>, theme: FrameTheme): string {
	return stats
		.map((stat, index) => {
			const separator = index === 0 ? "" : (stat.separator ?? " · ");
			return `${theme.fg("muted", separator)}${theme.fg(stat.role, stat.text)}`;
		})
		.join("");
}

function frameWidth(availableWidth: number, lineNumberWidth: number): number {
	const available = normalizedWidth(availableWidth);
	const rightMargin = lineNumberWidth + NUMBER_GUTTER_CHROME_WIDTH;
	return Math.max(1, available - rightMargin);
}

function titleRow(spec: MutationFrameSpec, width: number, theme: FrameTheme): string {
	const fullStats = statsLabel(spec.stats, theme);
	const prefix = `${theme.fg("accent", "┌")} ${theme.fg("accent", `${STYLE.BOLD}${spec.tool}${STYLE.BOLD_OFF}`)} ${theme.fg("muted", "─")} `;
	const prefixWidth = terminalLineWidth(prefix);
	const canShowStats = width - prefixWidth - terminalLineWidth(fullStats) >= 8;
	const stats = canShowStats ? fullStats : "";
	const statsWidth = terminalLineWidth(stats);
	const minimumGap = 1;
	const pathBudget = Math.max(0, width - prefixWidth - statsWidth - HEADER_CHROME_WIDTH);
	const basename = spec.path.split("/").pop() || spec.path;
	const pathSource = pathBudget < 12 ? basename : spec.path;
	const path = truncateTerminalLine(theme.fg("text", pathSource), pathBudget, "…");
	const used = prefixWidth + terminalLineWidth(path) + statsWidth + minimumGap;
	const fill = Math.max(1, width - used - (stats ? 1 : 0));
	const suffix = stats ? ` ${stats}` : "";
	const row = `${prefix}${path} ${theme.fg("muted", "─".repeat(fill))}${suffix}`;
	return truncateTerminalLine(row, width, "…");
}

function parseHex(hex: string): [number, number, number] | undefined {
	const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
	if (!match) return undefined;
	return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
}

function blendHex(base: string, tint: string, opacity: number): string | undefined {
	const baseRgb = parseHex(base);
	const tintRgb = parseHex(tint);
	if (!baseRgb || !tintRgb) return undefined;
	const channels = baseRgb.map((channel, index) =>
		Math.round(channel + (tintRgb[index] - channel) * opacity),
	);
	return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function diffBackgrounds(theme: FrameTheme): DiffBackgrounds | undefined {
	if (!theme.getColorMode) return undefined;
	return {
		added: LATTE.green,
		removed: LATTE.red,
		base: DIFF_BG_BASE,
		mode: theme.getColorMode(),
	};
}

function nearestAnsi256(red: number, green: number, blue: number): number {
	const levels = [0, 95, 135, 175, 215, 255];
	const nearest = (value: number): number =>
		levels.reduce((best, level, index) =>
			Math.abs(level - value) < Math.abs(levels[best] - value) ? index : best, 0);
	const cube = 16 + 36 * nearest(red) + 6 * nearest(green) + nearest(blue);
	const grayIndex = Math.max(0, Math.min(23, Math.round((red + green + blue) / 3 / 10 - 0.8)));
	const grayValue = 8 + grayIndex * 10;
	const cubeRed = levels[Math.floor((cube - 16) / 36)];
	const cubeGreen = levels[Math.floor(((cube - 16) % 36) / 6)];
	const cubeBlue = levels[(cube - 16) % 6];
	const cubeDistance = (cubeRed - red) ** 2 + (cubeGreen - green) ** 2 + (cubeBlue - blue) ** 2;
	const grayDistance = (grayValue - red) ** 2 + (grayValue - green) ** 2 + (grayValue - blue) ** 2;
	return grayDistance < cubeDistance ? 232 + grayIndex : cube;
}

function backgroundAnsi(hex: string, mode: DiffBackgrounds["mode"]): string | undefined {
	const rgb = parseHex(hex);
	if (!rgb) return undefined;
	if (mode === "256color") return `\x1b[48;5;${nearestAnsi256(...rgb)}m`;
	return `\x1b[48;2;${rgb.join(";")}m`;
}

function railRow(
	content: string,
	width: number,
	theme: FrameTheme,
	background?: { hex: string; mode: DiffBackgrounds["mode"] },
): string {
	if (width <= 1) return theme.fg("muted", "│".slice(0, width));
	const body = truncateTerminalLine(content, width - ROW_CHROME_WIDTH, "…");
	const rail = theme.fg("muted", "│");
	if (!background) return `${rail} ${body}`;
	const start = backgroundAnsi(background.hex, background.mode);
	if (!start) return `${rail} ${body}`;
	// Pi trims ordinary trailing spaces from component rows. Non-breaking spaces
	// keep the pastel band rectangular while remaining visually blank.
	const padding = "\u00a0".repeat(Math.max(0, width - ROW_CHROME_WIDTH - terminalLineWidth(body)));
	return `${rail}${start} ${body}${padding}${ANSI_BG_RESET}`;
}

function appendCodeCharacter(
	rows: string[],
	state: CodeRowState,
	character: string,
	width: number,
): CodeRowState {
	const characterWidth = terminalLineWidth(character);
	if (characterWidth > width) {
		if (state.row) rows.push(state.row);
		rows.push("…");
		return { row: "", usedWidth: 0 };
	}
	if (state.usedWidth > 0 && state.usedWidth + characterWidth > width) {
		rows.push(state.row);
		return { row: character, usedWidth: characterWidth };
	}
	return {
		row: state.row + character,
		usedWidth: state.usedWidth + characterWidth,
	};
}

function wrapCodeLine(text: string, width: number): string[] {
	if (width <= 0 || !text.length) return [""];
	const rows: string[] = [];
	let state: CodeRowState = { row: "", usedWidth: 0 };
	for (const character of text) {
		state = appendCodeCharacter(rows, state, character, width);
	}
	rows.push(state.row);
	return rows;
}

function expandContent(
	content: ReadonlyArray<LogicalEntry>,
	width: number,
	lineNumberWidth: number,
): RenderEntry[] {
	const gutterWidth = lineNumberWidth > 0
		? lineNumberWidth + NUMBER_GUTTER_CHROME_WIDTH
		: 2;
	const codeWidth = Math.max(1, width - ROW_CHROME_WIDTH - gutterWidth);
	const rows: RenderEntry[] = [];
	for (const entry of content) {
		if (entry.separator) {
			rows.push({ separator: entry.separator });
			continue;
		}
		if (!entry.line) continue;
		wrapCodeLine(entry.line.text, codeWidth).forEach((text, index) => {
			rows.push({ line: { value: entry.line!, text, continuation: index > 0 } });
		});
	}
	return rows;
}

function diffRole(line: DiffLine, fadeIndex: number): string {
	if (fadeIndex >= 0) return "dim";
	if (line.kind === "removed") return "toolDiffRemoved";
	if (line.kind === "added") return "toolDiffAdded";
	return "toolDiffContext";
}

function diffGutter(
	entry: NonNullable<RenderEntry["line"]>,
	lineNumberWidth: number,
	role: string,
	theme: FrameTheme,
): string {
	const prefix = entry.continuation ? " " : DIFF_PREFIX[entry.value.kind];
	if (lineNumberWidth <= 0) return `${theme.fg(role, prefix)} `;
	const number = entry.continuation || !Number.isInteger(entry.value.lineNumber)
		? " ".repeat(lineNumberWidth)
		: String(entry.value.lineNumber).padStart(lineNumberWidth, " ");
	return `${theme.fg(role, prefix)} ${theme.fg("dim", number)}${theme.fg("muted", " │ ")}`;
}

function diffBackground(
	line: DiffLine,
	backgrounds: DiffBackgrounds | undefined,
	fadeIndex: number,
): { hex: string; mode: DiffBackgrounds["mode"] } | undefined {
	if (!backgrounds || line.kind === "context") return undefined;
	const opacity = fadeIndex >= 0
		? (DIFF_BG_FADE_OPACITY[fadeIndex] ?? 0)
		: DIFF_BG_OPACITY;
	return {
		hex: blendHex(backgrounds.base, backgrounds[line.kind], opacity),
		mode: backgrounds.mode,
	};
}

function diffRow(
	entry: NonNullable<RenderEntry["line"]>,
	options: DiffRowOptions,
): string {
	const { backgrounds, fadeIndex, lineNumberWidth, theme, width } = options;
	const role = diffRole(entry.value, fadeIndex);
	const gutter = diffGutter(entry, lineNumberWidth, role, theme);
	const background = diffBackground(entry.value, backgrounds, fadeIndex);
	return railRow(`${gutter}${theme.fg(role, entry.text)}`, width, theme, background);
}

function separatorRow(index: number, total: number, width: number, theme: FrameTheme): string {
	return railRow(theme.fg("dim", `··· édition ${index}/${total}`), width, theme);
}

function footerRow(
	hiddenLineCount: number,
	nativeLabel: string,
	expanded: boolean,
	width: number,
	theme: FrameTheme,
): string {
	const text = expanded
		? "ctrl+o · replier"
		: hiddenLineCount > 0
			? `+${hiddenLineCount} lignes masquées · ctrl+o`
			: `ctrl+o · ${nativeLabel}`;
	return truncateTerminalLine(`  ${theme.fg("muted", text)}`, width, "…");
}

export function mutationFrameRows(spec: MutationFrameSpec, width: number, theme: FrameTheme): string[] {
	const content: LogicalEntry[] = [];
	spec.diffs.forEach((diff, index) => {
		if (index > 0) content.push({ separator: { index: index + 1, total: spec.diffs.length } });
		for (const line of diff) content.push({ line });
	});
	const lineNumberWidth = Math.max(
		0,
		...content.map((entry) => entry.line?.lineNumber === undefined ? 0 : String(entry.line.lineNumber).length),
	);
	const w = frameWidth(width, lineNumberWidth);
	const contentRows = expandContent(content, w, lineNumberWidth);
	const isCapped = spec.expanded !== true && contentRows.length > MUTATION_MAX_LINES;
	const shown = isCapped ? contentRows.slice(0, MUTATION_MAX_LINES) : contentRows;
	const solidRows = isCapped ? shown.length - MUTATION_FADE_ROWS : shown.length;
	const backgrounds = spec.highlightChanges ? diffBackgrounds(theme) : undefined;
	const rows = [titleRow(spec, w, theme), railRow("", w, theme)];
	shown.forEach((entry, index) => {
		if (entry.separator) {
			rows.push(separatorRow(entry.separator.index, entry.separator.total, w, theme));
		} else if (entry.line) {
			rows.push(diffRow(entry.line, {
				lineNumberWidth,
				width: w,
				theme,
				backgrounds,
				fadeIndex: index - solidRows,
			}));
		}
	});
	if (isCapped) rows.push(railRow(theme.fg("dim", "· · ·"), w, theme));
	rows.push(railRow("", w, theme));
	rows.push(footerRow(contentRows.length - shown.length, spec.nativeLabel, spec.expanded === true, w, theme));
	return rows;
}
