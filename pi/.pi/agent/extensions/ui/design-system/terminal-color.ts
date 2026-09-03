export type RgbColor = [number, number, number]
export type TerminalColorMode = 'truecolor' | '256color'

const ANSI_256_LEVELS = [0, 95, 135, 175, 215, 255] as const
const HEX_COLOR = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu
const HEX_RADIX = 16
const HEX_CHANNEL_WIDTH = 2

export function parseHexColor(hex: string): RgbColor | undefined {
	const match = HEX_COLOR.exec(hex)
	if (!match) return undefined
	return [
		Number.parseInt(match[1]!, HEX_RADIX),
		Number.parseInt(match[2]!, HEX_RADIX),
		Number.parseInt(match[3]!, HEX_RADIX),
	]
}

export function hexToRgb(hex: string): RgbColor {
	const color = parseHexColor(hex)
	if (!color) throw new TypeError(`Invalid #rrggbb color: ${hex}`)
	return color
}

function channelToHex(channel: number): string {
	return channel.toString(HEX_RADIX).padStart(HEX_CHANNEL_WIDTH, '0')
}

export function rgbToHex([red, green, blue]: RgbColor): string {
	return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

/** Linear blend; ratio 0 keeps `from`, ratio 1 reaches `to`. */
export function blendHex(from: string, to: string, ratio: number): string {
	const fromRgb = hexToRgb(from)
	const toRgb = hexToRgb(to)
	return rgbToHex(
		fromRgb.map((channel, index) =>
			Math.round(channel + (toRgb[index]! - channel) * ratio),
		) as RgbColor,
	)
}

export function ansi256ToRgb(index: number): RgbColor {
	if (index >= 232) {
		const gray = 8 + Math.min(23, index - 232) * 10
		return [gray, gray, gray]
	}
	if (index >= 16) {
		const cube = index - 16
		return [
			ANSI_256_LEVELS[Math.floor(cube / 36)]!,
			ANSI_256_LEVELS[Math.floor((cube % 36) / 6)]!,
			ANSI_256_LEVELS[cube % 6]!,
		]
	}
	const basic = [
		[0, 0, 0],
		[128, 0, 0],
		[0, 128, 0],
		[128, 128, 0],
		[0, 0, 128],
		[128, 0, 128],
		[0, 128, 128],
		[192, 192, 192],
		[128, 128, 128],
		[255, 0, 0],
		[0, 255, 0],
		[255, 255, 0],
		[0, 0, 255],
		[255, 0, 255],
		[0, 255, 255],
		[255, 255, 255],
	] as const
	return [...basic[Math.max(0, Math.min(15, index))]!] as RgbColor
}

export function nearestAnsi256(
	red: number,
	green: number,
	blue: number,
): number {
	const nearest = (value: number): number =>
		ANSI_256_LEVELS.reduce(
			(best, level, index) =>
				Math.abs(level - value) <
				Math.abs(ANSI_256_LEVELS[best]! - value)
					? index
					: best,
			0,
		)
	const cube = 16 + 36 * nearest(red) + 6 * nearest(green) + nearest(blue)
	const grayIndex = Math.max(
		0,
		Math.min(23, Math.round((red + green + blue) / 30 - 0.8)),
	)
	const grayValue = 8 + grayIndex * 10
	const cubeRgb = ansi256ToRgb(cube)
	const distance = (rgb: RgbColor): number =>
		(rgb[0] - red) ** 2 + (rgb[1] - green) ** 2 + (rgb[2] - blue) ** 2
	return distance([grayValue, grayValue, grayValue]) < distance(cubeRgb)
		? 232 + grayIndex
		: cube
}

export function foregroundAnsi(rgb: RgbColor, mode: TerminalColorMode): string {
	if (mode === '256color') return `\x1b[38;5;${nearestAnsi256(...rgb)}m`
	return `\x1b[38;2;${rgb.join(';')}m`
}

export function backgroundAnsi(rgb: RgbColor, mode: TerminalColorMode): string {
	if (mode === '256color') return `\x1b[48;5;${nearestAnsi256(...rgb)}m`
	return `\x1b[48;2;${rgb.join(';')}m`
}

export function foregroundColorSequence(hex: string): string {
	return foregroundAnsi(hexToRgb(hex), 'truecolor')
}

export function foregroundHex(hex: string, text: string): string {
	return `${foregroundColorSequence(hex)}${text}\x1b[39m`
}

export function backgroundColorSequence(hex: string): string {
	return backgroundAnsi(hexToRgb(hex), 'truecolor')
}

export function backgroundHex(hex: string, text: string): string {
	return `${backgroundColorSequence(hex)}${text}\x1b[49m`
}
