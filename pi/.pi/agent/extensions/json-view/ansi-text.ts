import { LATTE } from '../footer/style.ts'

import { blendHex, JSON_COLOR, jsonColorSequence } from './json-colors.ts'

const ANSI = {
	ESCAPE: '\x1b',
	BELL: '\x07',
	CSI_PREFIX_LENGTH: 2,
	CSI_FINAL_MIN: 0x40,
	CSI_FINAL_MAX: 0x7e,
	TRUECOLOR_CHANNEL_COUNT: 3,
	HEX_RADIX: 16,
	HEX_WIDTH: 2,
	MAX_COLOR_CHANNEL: 255,
	TRUECOLOR_PREFIX: '\x1b[38;2;',
	FOREGROUND_RESET: '\x1b[39m',
} as const

type AnsiToken =
	| { kind: 'control'; text: string }
	| { kind: 'text'; text: string }

function csiEnd(text: string, start: number): number {
	for (
		let cursor = start + ANSI.CSI_PREFIX_LENGTH;
		cursor < text.length;
		cursor += 1
	) {
		const codePoint = text.charCodeAt(cursor)
		if (codePoint >= ANSI.CSI_FINAL_MIN && codePoint <= ANSI.CSI_FINAL_MAX)
			return cursor + 1
	}
	return text.length
}

function oscEnd(text: string, start: number): number {
	const bell = text.indexOf(ANSI.BELL, start)
	const stringTerminator = text.indexOf(`${ANSI.ESCAPE}\\`, start)
	const terminators = [bell, stringTerminator]
		.filter(position => position >= 0)
		.toSorted((left, right) => left - right)
	const firstTerminator = terminators.at(0) ?? -1
	if (firstTerminator < 0) return text.length
	if (text.startsWith(ANSI.BELL, firstTerminator))
		return firstTerminator + ANSI.BELL.length
	return firstTerminator + ANSI.ESCAPE.length + 1
}

function controlEnd(text: string, start: number): number {
	if (text.startsWith(`${ANSI.ESCAPE}[`, start)) return csiEnd(text, start)
	if (text.startsWith(`${ANSI.ESCAPE}]`, start)) return oscEnd(text, start)
	return start + ANSI.ESCAPE.length
}

export function tokenizeAnsiText(text: string): AnsiToken[] {
	const tokens: AnsiToken[] = []
	let cursor = 0
	while (cursor < text.length) {
		const controlStart = text.indexOf(ANSI.ESCAPE, cursor)
		if (controlStart < 0) {
			tokens.push({ kind: 'text', text: text.slice(cursor) })
			break
		}
		if (controlStart > cursor)
			tokens.push({
				kind: 'text',
				text: text.slice(cursor, controlStart),
			})
		const end = controlEnd(text, controlStart)
		tokens.push({ kind: 'control', text: text.slice(controlStart, end) })
		cursor = end
	}
	return tokens
}

function escapeMarkdownText(text: string): string {
	return text.replace(
		/[\\`*_<>~]/g,
		specialCharacter => `\\${specialCharacter}`,
	)
}

export function escapeMarkdownOutsideAnsi(text: string): string {
	return tokenizeAnsiText(text)
		.map(token =>
			token.kind === 'control'
				? token.text
				: escapeMarkdownText(token.text),
		)
		.join('')
}

function trueColorHex(control: string): string | undefined {
	if (!control.startsWith(ANSI.TRUECOLOR_PREFIX) || !control.endsWith('m'))
		return undefined
	const channelSource = control.slice(ANSI.TRUECOLOR_PREFIX.length, -1)
	const channels = channelSource.split(';').map(Number)
	if (channels.length !== ANSI.TRUECOLOR_CHANNEL_COUNT) return undefined
	if (
		!channels.every(
			channel =>
				Number.isInteger(channel) &&
				channel >= 0 &&
				channel <= ANSI.MAX_COLOR_CHANNEL,
		)
	) {
		return undefined
	}
	const [red = 0, green = 0, blue = 0] = channels
	const hexChannel = (channel: number): string =>
		channel.toString(ANSI.HEX_RADIX).padStart(ANSI.HEX_WIDTH, '0')
	return `#${hexChannel(red)}${hexChannel(green)}${hexChannel(blue)}`
}

type FadedControl = {
	text: string
	hasActiveColor: boolean
}

function fadeText(
	text: string,
	ratio: number,
	hasActiveColor: boolean,
): string {
	if (hasActiveColor || !text.trim()) return text
	const color = jsonColorSequence(
		blendHex(LATTE.text, JSON_COLOR.BASE, ratio),
	)
	return `${color}${text}${ANSI.FOREGROUND_RESET}`
}

function fadeControl(
	control: string,
	ratio: number,
	hasActiveColor: boolean,
): FadedControl {
	const activeHex = trueColorHex(control)
	if (activeHex) {
		return {
			text: jsonColorSequence(
				blendHex(activeHex, JSON_COLOR.BASE, ratio),
			),
			hasActiveColor: true,
		}
	}
	if (control === ANSI.FOREGROUND_RESET)
		return { text: control, hasActiveColor: false }
	return { text: control, hasActiveColor }
}

export function fadeAnsiLine(line: string, ratio: number): string {
	if (ratio <= 0) return line
	let faded = ''
	let hasActiveColor = false
	for (const token of tokenizeAnsiText(line)) {
		if (token.kind === 'text') {
			faded += fadeText(token.text, ratio, hasActiveColor)
			continue
		}
		const control = fadeControl(token.text, ratio, hasActiveColor)
		faded += control.text
		hasActiveColor = control.hasActiveColor
	}
	return faded
}
