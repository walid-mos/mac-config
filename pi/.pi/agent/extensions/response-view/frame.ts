import type { Theme } from "@earendil-works/pi-coding-agent";

export const RESPONSE_RIGHT_MARGIN = 8;

export type ResponseTheme = Pick<
	Theme,
	"fg" | "bold" | "getFgAnsi" | "getBgAnsi" | "getColorMode"
>;

export interface ResponseFrameOptions {
	width: number;
	theme: ResponseTheme;
}

const LABEL = "RÉPONSE";
const SIGNAL = "◇";
const TRACE_LEAD = "╶";
const TRACE_FADE_END = "┈┈ ";

const GRADIENT_WIDTH = 24;
const EDGE_FADE_RATIO = 0.34;
const EDGE_FADE_MIN_WIDTH = 16;
const ANSI_FG_RESET = "\x1b[39m";
const ANSI_256_LEVELS = [0, 95, 135, 175, 215, 255] as const;

interface TerminalColor {
	rgb: [number, number, number];
	mode: "truecolor" | "256color";
}

function ruleWidth(width: number): number {
	if (!Number.isFinite(width)) return 1;
	return Math.max(1, Math.floor(width) - RESPONSE_RIGHT_MARGIN);
}

function ansi256Rgb(index: number): [number, number, number] {
	if (index >= 232) {
		const gray = 8 + Math.min(23, index - 232) * 10;
		return [gray, gray, gray];
	}
	if (index >= 16) {
		const cube = index - 16;
		return [
			ANSI_256_LEVELS[Math.floor(cube / 36)]!,
			ANSI_256_LEVELS[Math.floor((cube % 36) / 6)]!,
			ANSI_256_LEVELS[cube % 6]!,
		];
	}
	const basic = [
		[0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
		[0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
		[128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
		[0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
	] as const;
	return [...basic[Math.max(0, index)]!] as [number, number, number];
}

function parseTerminalColor(ansi: string): TerminalColor {
	const truecolor = /\x1b\[(?:38|48);2;(\d+);(\d+);(\d+)m/u.exec(ansi);
	if (truecolor) {
		return {
			rgb: [Number(truecolor[1]), Number(truecolor[2]), Number(truecolor[3])],
			mode: "truecolor",
		};
	}
	const indexed = /\x1b\[(?:38|48);5;(\d+)m/u.exec(ansi);
	if (indexed) return { rgb: ansi256Rgb(Number(indexed[1])), mode: "256color" };
	throw new Error("response-view requires an ANSI color from the active theme");
}

function nearestAnsi256(red: number, green: number, blue: number): number {
	const nearest = (value: number): number =>
		ANSI_256_LEVELS.reduce((best, level, index) =>
			Math.abs(level - value) < Math.abs(ANSI_256_LEVELS[best]! - value) ? index : best, 0);
	const cube = 16 + 36 * nearest(red) + 6 * nearest(green) + nearest(blue);
	const grayIndex = Math.max(0, Math.min(23, Math.round((red + green + blue) / 30 - 0.8)));
	const grayValue = 8 + grayIndex * 10;
	const cubeRgb = ansi256Rgb(cube);
	const distance = (rgb: [number, number, number]): number =>
		(rgb[0] - red) ** 2 + (rgb[1] - green) ** 2 + (rgb[2] - blue) ** 2;
	return distance([grayValue, grayValue, grayValue]) < distance(cubeRgb) ? 232 + grayIndex : cube;
}

function foregroundAnsi(rgb: [number, number, number], mode: TerminalColor["mode"]): string {
	if (mode === "256color") return `\x1b[38;5;${nearestAnsi256(...rgb)}m`;
	return `\x1b[38;2;${rgb.join(";")}m`;
}

function smoothstep(value: number): number {
	return value * value * (3 - 2 * value);
}

function edgeFadeWidth(width: number): number {
	return Math.min(width, Math.max(EDGE_FADE_MIN_WIDTH, Math.round(width * EDGE_FADE_RATIO)));
}

function traceGlyphs(width: number): string {
	if (width <= TRACE_FADE_END.length) return TRACE_FADE_END.slice(-width);
	const solidWidth = width - TRACE_FADE_END.length;
	return TRACE_LEAD + "─".repeat(Math.max(0, solidWidth - 1)) + TRACE_FADE_END;
}

function mixColor(
	from: [number, number, number],
	to: [number, number, number],
	ratio: number,
): [number, number, number] {
	return from.map((channel, channelIndex) =>
		Math.round(channel + (to[channelIndex]! - channel) * ratio),
	) as [number, number, number];
}

function gradientTrace(width: number, theme: ResponseTheme): string {
	const glyphs = traceGlyphs(width);
	const accent = parseTerminalColor(theme.getFgAnsi("accent"));
	const muted = parseTerminalColor(theme.getFgAnsi("muted"));
	const canvas = parseTerminalColor(theme.getBgAnsi("userMessageBg"));
	const mode = theme.getColorMode();
	const fadeOutWidth = edgeFadeWidth(width);
	const gradientWidth = Math.min(GRADIENT_WIDTH, Math.max(1, width - fadeOutWidth));
	const fadeOutStart = width - fadeOutWidth;
	let trace = "";
	for (let index = 0; index < width; index += 1) {
		let rgb = muted.rgb;
		if (index < gradientWidth) {
			const linear = gradientWidth === 1 ? 1 : index / (gradientWidth - 1);
			rgb = mixColor(accent.rgb, muted.rgb, smoothstep(linear));
		} else if (index >= fadeOutStart) {
			const linear = fadeOutWidth === 1 ? 1 : (index - fadeOutStart) / (fadeOutWidth - 1);
			rgb = mixColor(muted.rgb, canvas.rgb, smoothstep(linear));
		}
		trace += `${foregroundAnsi(rgb, mode)}${glyphs[index]}`;
	}
	return `${trace}${ANSI_FG_RESET}`;
}

/** A quiet label followed by a full-width accent-to-muted trace. */
export function responseTopRule(width: number, theme: ResponseTheme): string {
	const targetWidth = ruleWidth(width);
	const labelWidth = SIGNAL.length + 2 + LABEL.length;
	if (targetWidth < labelWidth) return theme.fg("accent", SIGNAL);

	const label = [
		theme.fg("accent", theme.bold(SIGNAL)),
		"  ",
		theme.fg("text", theme.bold(LABEL)),
	].join("");
	const traceWidth = targetWidth - labelWidth;
	if (traceWidth <= 2) return `${label}${" ".repeat(traceWidth)}`;

	const lineWidth = traceWidth - 2;
	return `${label}  ${gradientTrace(lineWidth, theme)}`;
}

/** Display-only decoration; the session and model context keep the original Markdown. */
export function frameAssistantMarkdown(markdown: string, options: ResponseFrameOptions): string {
	if (!markdown.trim().length) return markdown;
	const top = responseTopRule(options.width, options.theme);
	return `${top}\n\n${markdown}`;
}
