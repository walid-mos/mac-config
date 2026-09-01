import { PI_PALETTE as LATTE } from '../ui/design-system/palette.ts'
import { foregroundHex as fgHex } from '../ui/design-system/terminal-color.ts'
import { hyperlink } from '../ui/terminal-text.ts'

import { clampText } from './format.ts'
import {
	FOOTER_GLYPHS as ICONS,
	FOOTER_LAYOUT,
	thinSeparator as thinSep,
} from './style.ts'

import type { GitPr, GitStatus } from './types.ts'

const GIT_BAR_WIDTH = FOOTER_LAYOUT.gitBarWidth
const BAR_FULL = ICONS.barFull
const BAR_EMPTY = ICONS.barEmpty

function dimText(text: string): string {
	return fgHex(LATTE.subtext0, text)
}

/** Rounded slim pill filled by working-tree churn, tinted by severity. */
function gitSlimBar(total: number, color: string): string {
	const filled = Math.max(
		1,
		Math.min(GIT_BAR_WIDTH, Math.round((total / 12) * GIT_BAR_WIDTH)),
	)
	return (
		fgHex(color, BAR_FULL.repeat(filled)) +
		fgHex(LATTE.surface1, BAR_EMPTY.repeat(GIT_BAR_WIDTH - filled))
	)
}

/** Churn severity: deletions > edits > staged work > untracked noise. */
function churnColor(s: GitStatus): string {
	if (s.deleted > 0) return LATTE.red
	if (s.modified > 0) return LATTE.yellow
	if (s.staged > 0) return LATTE.green
	return LATTE.sapphire
}

/** Line 2 left: branch │ slim churn bar + counters (+ PR link appended later). */
function gitLine(s: GitStatus | null, branch?: string, maxBranch = 28): string {
	const groups: string[] = []

	if (branch) {
		groups.push(
			`${fgHex(LATTE.sapphire, ICONS.branch)} ${fgHex(LATTE.sapphire, clampText(branch, maxBranch))}`,
		)
	}

	if (s === null) {
		groups.push(dimText('no git'))
		return groups.join(` ${thinSep()} `)
	}

	const clean =
		s.staged +
			s.modified +
			s.deleted +
			s.untracked +
			s.stash +
			s.ahead +
			s.behind ===
		0
	if (clean) {
		groups.push(`${fgHex(LATTE.green, '\u2713')}${dimText(' clean')}`)
		return groups.join(` ${thinSep()} `)
	}

	const counters: string[] = []
	if (s.ahead > 0) counters.push(fgHex(LATTE.mauve, `\u21d1${s.ahead}`))
	if (s.behind > 0) counters.push(fgHex(LATTE.mauve, `\u21d3${s.behind}`))
	if (s.staged > 0) counters.push(fgHex(LATTE.green, `\u271a${s.staged}`))
	if (s.modified > 0) counters.push(fgHex(LATTE.yellow, `~${s.modified}`))
	if (s.deleted > 0) counters.push(fgHex(LATTE.red, `-${s.deleted}`))
	if (s.untracked > 0) counters.push(fgHex(LATTE.subtext0, `?${s.untracked}`))
	if (s.stash > 0) counters.push(fgHex(LATTE.sapphire, `\u2691${s.stash}`))

	groups.push(
		gitSlimBar(
			s.staged + s.modified + s.deleted + s.untracked,
			churnColor(s),
		),
	)
	groups.push(counters.join(` ${dimText('\u00b7')} `))

	return groups.join(` ${thinSep()} `)
}
// ── Current GitHub PR ───────────────────────────────────────────────
function prLink(pr: GitPr | null): string {
	if (!pr) return ''
	return hyperlink(fgHex(LATTE.blue, `PR #${pr.number}`), pr.url)
}

export function gitWithPr(
	status: GitStatus | null,
	pr: GitPr | null,
	branch?: string,
	maxBranch = 28,
	withPr = true,
): string {
	const groups = [
		gitLine(status, branch, maxBranch),
		withPr ? prLink(pr) : '',
	].filter(Boolean)
	return groups.join(` ${thinSep()} `)
}
