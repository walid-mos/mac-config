import { redactSecrets } from './redaction.ts'

const ESCAPE_CODE_POINT = 0x1b
const BELL_CODE_POINT = 0x07
const TAB_CODE_POINT = 0x09
const LINE_FEED_CODE_POINT = 0x0a
const SPACE_CODE_POINT = 0x20
const DELETE_CODE_POINT = 0x7f
const CONTROL_END_CODE_POINT = 0x9f
const ESCAPE = String.fromCodePoint(ESCAPE_CODE_POINT)
const BELL = String.fromCodePoint(BELL_CODE_POINT)
const OSC_SEQUENCE = new RegExp(
	`${ESCAPE}\\][^${BELL}]*(?:${BELL}|${ESCAPE}\\\\)`,
	'gu',
)
const CSI_SEQUENCE = new RegExp(`${ESCAPE}\\[[0-?]*[ -/]*[@-~]`, 'gu')
const STRING_SEQUENCE = new RegExp(
	`${ESCAPE}[_^P].*?(?:${ESCAPE}\\\\|${BELL})`,
	'gsu',
)

function stripControlCharacters(text: string): string {
	let printable = ''
	for (const character of text) {
		const codePoint = character.codePointAt(0)
		if (!codePoint) continue
		if (
			codePoint === TAB_CODE_POINT ||
			codePoint === LINE_FEED_CODE_POINT ||
			(codePoint >= SPACE_CODE_POINT &&
				(codePoint < DELETE_CODE_POINT ||
					codePoint > CONTROL_END_CODE_POINT))
		)
			printable += character
	}
	return printable
}

function stripTerminalSequences(text: string): string {
	return text
		.replaceAll(OSC_SEQUENCE, '')
		.replaceAll(CSI_SEQUENCE, '')
		.replaceAll(STRING_SEQUENCE, '')
}

export function sanitizeResultText(text: string): string {
	return redactSecrets(stripControlCharacters(stripTerminalSequences(text)))
}

export function sanitizeDisplayLine(content: string): string {
	const printable = stripTerminalSequences(content)
		.replaceAll('\r', '')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
	return redactSecrets(printable).replaceAll(/[\r\n\t]+/gu, ' ')
}
