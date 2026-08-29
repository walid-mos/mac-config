import { LATTE, rgb } from '../footer/style.ts'

const COLOR_CHANNEL = {
	HEX_RADIX: 16,
	HEX_WIDTH: 2,
} as const

const FADE_RATIO = {
	CONTENT_FIRST: 0.5,
	CONTENT_SECOND: 0.72,
	CONTENT_THIRD: 0.88,
	DOT_FIRST: 0.55,
	DOT_SECOND: 0.75,
	DOT_THIRD: 0.9,
} as const

export const JSON_COLOR = {
	BORDER: LATTE.overlay1,
	PUNCTUATION: LATTE.overlay1,
	KEY: LATTE.blue,
	STRING: LATTE.green,
	NUMBER: LATTE.peach,
	LITERAL: LATTE.mauve,
	TITLE: LATTE.mauve,
	META: LATTE.subtext0,
	LINK: LATTE.sapphire,
	BASE: '#eff1f5',
} as const

export const CONTENT_FADE_STEPS = [
	FADE_RATIO.CONTENT_FIRST,
	FADE_RATIO.CONTENT_SECOND,
	FADE_RATIO.CONTENT_THIRD,
] as const

export const DOT_FADE_STEPS = [
	FADE_RATIO.DOT_FIRST,
	FADE_RATIO.DOT_SECOND,
	FADE_RATIO.DOT_THIRD,
] as const

function hexChannel(channel: number): string {
	return channel
		.toString(COLOR_CHANNEL.HEX_RADIX)
		.padStart(COLOR_CHANNEL.HEX_WIDTH, '0')
}

export function blendHex(from: string, to: string, ratio: number): string {
	const [fromRed, fromGreen, fromBlue] = rgb(from)
	const [toRed, toGreen, toBlue] = rgb(to)
	const mixChannel = (fromChannel: number, toChannel: number): number =>
		Math.round(fromChannel + (toChannel - fromChannel) * ratio)
	const mixedChannels = [
		mixChannel(fromRed, toRed),
		mixChannel(fromGreen, toGreen),
		mixChannel(fromBlue, toBlue),
	]
	return `#${mixedChannels.map(hexChannel).join('')}`
}

export function jsonColorSequence(hex: string): string {
	const [red, green, blue] = rgb(hex)
	return `\x1b[38;2;${red};${green};${blue}m`
}
