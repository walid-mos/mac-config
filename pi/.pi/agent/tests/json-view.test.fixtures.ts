import { rgb } from '../extensions/footer/style.ts'
import { tokenizeAnsiText } from '../extensions/json-view/ansi-text.ts'

export const SMALL_JSON = JSON.stringify({ a: 1, b: [2, 3] }, null, 2)

export const BIG_JSON = JSON.stringify(
	{
		items: Array.from({ length: 40 }, (_, index) => ({
			index,
			label: `item-${index}`,
		})),
	},
	null,
	2,
)

export function plainTerminalText(terminalText: string): string {
	return tokenizeAnsiText(terminalText)
		.filter(token => token.kind === 'text')
		.map(token => token.text)
		.join('')
}

export function renderedTerminalText(terminalText: string): string {
	return plainTerminalText(terminalText).replace(/\\([\\`*_<>~])/g, '$1')
}

export function visibleLineWidths(terminalText: string): number[] {
	return terminalText
		.split('\n')
		.map(line => [...renderedTerminalText(line)].length)
}

export function ansiColor(hex: string): string {
	const [red, green, blue] = rgb(hex)
	return `\x1b[38;2;${red};${green};${blue}m`
}
