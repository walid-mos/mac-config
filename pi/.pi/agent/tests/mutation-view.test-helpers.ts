export const mutationTheme = {
	fg: (_role: string, text: string) => text,
	bold: (text: string) => text,
}

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g

export function stripAnsi(text: string): string {
	return text.replace(ANSI_PATTERN, '')
}
