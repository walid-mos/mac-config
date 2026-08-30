import { LATTE, rgb } from '../footer/style.ts'

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

export function jsonColorSequence(hex: string): string {
	const [red, green, blue] = rgb(hex)
	return `\x1b[38;2;${red};${green};${blue}m`
}
