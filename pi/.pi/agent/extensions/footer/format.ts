import { homedir } from 'node:os'

export function compactPath(path: string, maxWidth = 34): string {
	if (path.length <= maxWidth) return path
	const parts = path.split('/').filter(Boolean)
	if (parts.length <= 2) return path
	const head = path.startsWith('~') ? '~/' : '/'
	const tail = parts.slice(-2).join('/')
	const compressed = `${head}\u2026/${tail}`
	return compressed.length < path.length ? compressed : path
}

/** Hard-clamp plain text with a trailing ellipsis. */
export function clampText(text: string, maxLength: number): string {
	return text.length <= maxLength
		? text
		: `${text.slice(0, Math.max(1, maxLength - 1))}\u2026`
}

/** Render fused powerline segments: rounded caps outside,  inside. */

export function fmtTokens(n: number): string {
	if (n < 1000) return `${n}`
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
	return `${(n / 1_000_000).toFixed(2)}M`
}

export function shortPath(cwd: string): string {
	const home = homedir()
	if (cwd === home) return '~'
	if (cwd.startsWith(home + '/')) return '~/' + cwd.slice(home.length + 1)
	return cwd
}
