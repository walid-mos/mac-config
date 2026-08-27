export const LATTE = {
	mauve: "#8839ef",
	blue: "#1e66f5",
	sapphire: "#209fb5",
	teal: "#179299",
	green: "#40a02b",
	yellow: "#df8e1d",
	peach: "#fe640b",
	red: "#d20f39",
	text: "#4c4f69",
	surface1: "#9ca0b0",
	subtext0: "#6c6f85",
	overlay1: "#8c8fa1",
} as const;

export const ICONS = {
	model: "\u{f06a9}",
	folder: "\u{f07b}",
	branch: "\u{e0a0}",
	thinking: "\u{f0eb}",
	context: "\u{f200}",
	quota: "\u{f0109}",
	reset: "↺",
} as const;

export const BAR_WIDTH = 8;
export const BAR_FULL = "\u25b0";
export const BAR_EMPTY = "\u25b1";
export const SEP_THIN = "\u2502";

export const THINKING_COLORS: Record<string, string> = {
	off: LATTE.overlay1,
	minimal: LATTE.subtext0,
	low: LATTE.sapphire,
	medium: LATTE.blue,
	high: LATTE.mauve,
	xhigh: LATTE.peach,
	max: LATTE.red,
};

export function rgb(hex: string): [number, number, number] {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return [red, green, blue].every(Number.isFinite)
		? [red, green, blue]
		: [108, 111, 133];
}

export function fgHex(hex: string, text: string): string {
	const [red, green, blue] = rgb(hex);
	return `\x1b[38;2;${red};${green};${blue}m${text}\x1b[39m`;
}

export function thinSep(): string {
	return fgHex(LATTE.surface1, SEP_THIN);
}
