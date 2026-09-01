import type { DiffLine } from './diff.ts'

export interface FrameTheme {
	fg(role: string, text: string): string
	getColorMode?(): 'truecolor' | '256color'
}

export interface DiffBackgrounds {
	added: string
	removed: string
	base: string
	mode: 'truecolor' | '256color'
}

export interface LogicalEntry {
	line?: DiffLine
	separator?: { index: number; total: number }
}

export interface RenderEntry {
	line?: { value: DiffLine; text: string; continuation: boolean }
	separator?: { index: number; total: number }
}

export interface MutationFrameComponent {
	render(width: number): string[]
	invalidate(): void
}

export interface MutationFrameStat {
	text: string
	role: string
	separator?: ' ' | ' · '
}

export interface MutationFrameSpec {
	tool: 'edit' | 'write'
	path: string
	stats: ReadonlyArray<MutationFrameStat>
	nativeLabel: string
	highlightChanges?: boolean
	expanded?: boolean
	diffs: ReadonlyArray<ReadonlyArray<DiffLine>>
}
