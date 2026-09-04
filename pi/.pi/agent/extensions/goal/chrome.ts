import {
	ABOVE_EDITOR_PRIORITY,
	setOrderedAboveEditorWidget,
} from '../ui/ordered-widget-stack.ts'
import { truncateTerminalLine } from '../ui/terminal-text.ts'

import { sanitizeDisplayLine } from './sanitize.ts'

import type { GoalState } from './contracts.ts'
import type { ExtensionUIContext } from '@earendil-works/pi-coding-agent'

type GoalUiContext = { readonly ui: ExtensionUIContext }

const CHROME_TICK_MS = 1_000
const CHROME_TEXT_WIDTH = 80

export function goalChromeLines(state: GoalState, width: number): string[] {
	const safeWidth = Math.max(1, width)
	return [
		`◎ /goal active · ${formatElapsed(state.startedAt)} · ${state.turnsEvaluated} turns`,
		sanitizeDisplayLine(state.condition),
		state.lastReason
			? `last: ${sanitizeDisplayLine(state.lastReason)}`
			: 'waiting for first evaluation',
	].map(line =>
		truncateTerminalLine(
			truncateTerminalLine(line, CHROME_TEXT_WIDTH, '…'),
			safeWidth,
			'…',
		),
	)
}

export function paintChrome(ui: ExtensionUIContext, state: GoalState): void {
	setOrderedAboveEditorWidget(ui, 'goal', {
		priority: ABOVE_EDITOR_PRIORITY.goal,
		render: width => goalChromeLines(state, width),
	})
}

export class GoalChrome {
	private clock: ReturnType<typeof setInterval> | null = null
	private state: GoalState | null = null
	private ui: ExtensionUIContext | null = null

	render(ctx: GoalUiContext, state: GoalState | null): void {
		ctx.ui.setStatus('goal', undefined)
		if (!state || state.status !== 'active') {
			this.clear(ctx.ui)
			return
		}
		this.state = state
		this.ui = ctx.ui
		paintChrome(ctx.ui, state)
		this.startClock()
	}

	clear(ui?: ExtensionUIContext): void {
		this.stopClock()
		const target = ui ?? this.ui
		if (target) setOrderedAboveEditorWidget(target, 'goal', undefined)
		this.state = null
		this.ui = null
	}

	private startClock(): void {
		if (this.clock) return
		this.clock = setInterval(() => {
			if (!this.state || !this.ui) {
				this.stopClock()
				return
			}
			try {
				paintChrome(this.ui, this.state)
			} catch {
				this.clear()
			}
		}, CHROME_TICK_MS)
		this.clock.unref?.()
	}

	private stopClock(): void {
		if (!this.clock) return
		clearInterval(this.clock)
		this.clock = null
	}
}

export function formatElapsed(startedAt: string): string {
	const start = Date.parse(startedAt)
	if (!Number.isFinite(start)) return '?'
	const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000))
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m`
	const hours = Math.floor(minutes / 60)
	return `${hours}h${minutes % 60}m`
}
