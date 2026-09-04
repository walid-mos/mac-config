import {
	ABOVE_EDITOR_PRIORITY,
	setOrderedAboveEditorWidget,
} from '../ui/ordered-widget-stack.ts'
import { terminalLineWidth } from '../ui/terminal-text.ts'

import {
	createRotation,
	defaultIntervalScheduler,
	WORD_ROTATION_INTERVAL_MS,
} from './rotation.ts'
import { createShuffleBag } from './shuffle-bag.ts'
import { createSpinnerRotation, SAND_SPINNER } from './spinner.ts'
import {
	createThinkingPreviewTimeline,
	rollingThinkingPreview,
	thinkingRegionWidth,
	THINKING_ICON,
} from './thinking-preview.ts'
import { WORKING_WORDS } from './words.ts'

import type { ThinkingPreviewTimeline } from './thinking-preview.ts'
/**
 * Working loader: animates a sand spinner beside a shuffle-bag word line while
 * the agent is busy, without taking ownership of Pi's transcript rendering.
 * The line renders through the shared surface registry (ui/surface.ts), so it
 * stacks with the other above-editor surfaces instead of owning a slot.
 *
 * While thinking blocks stream, a Nerd Font brain and a bounded rolling
 * excerpt are appended at the far right: working words keep rotating on the
 * left while the current reasoning remains visible but ephemeral.
 */
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

const SURFACE_ID = 'working-loader'
const MIN_GAP = 2
const THINKING_ICON_GAP = 1

/** Whether an assistant stream event flips the loader into thinking mode. */
export function isThinkingStreamEvent(eventType: string | undefined): boolean {
	return eventType === 'thinking_start' || eventType === 'thinking_delta'
}

/** Whether an assistant stream event returns the loader to working mode. */
export function isWorkingStreamEvent(eventType: string | undefined): boolean {
	return (
		eventType === 'text_start' ||
		eventType === 'text_delta' ||
		eventType === 'thinking_end' ||
		eventType === 'toolcall_start'
	)
}

function advanceThinkingTimeline(
	timeline: ThinkingPreviewTimeline,
	eventType: string,
	delta: string,
	now: number,
): boolean {
	switch (eventType) {
		case 'thinking_start':
			return timeline.enter(now)
		case 'thinking_delta':
			return timeline.append(delta, now)
		default:
			return isWorkingStreamEvent(eventType)
				? timeline.requestExit(now)
				: false
	}
}

export default function workingLoader(pi: ExtensionAPI): void {
	const bag = createShuffleBag(WORKING_WORDS)
	const thinkingTimeline = createThinkingPreviewTimeline()
	let ui: ExtensionContext['ui'] | undefined
	let painted = false
	let spinnerFrame = SAND_SPINNER.frames[0]
	let word = ''

	function paint(): void {
		if (ui === undefined) return
		setOrderedAboveEditorWidget(ui, SURFACE_ID, {
			priority: ABOVE_EDITOR_PRIORITY.thinking,
			render: (width, theme) => {
				const left = theme.fg('dim', `${spinnerFrame} ${word}...`)
				if (!thinkingTimeline.isVisible()) return [left]
				const visibleThinking = thinkingTimeline.visibleBuffer()
				if (visibleThinking === '') return [left]

				const rightBudget = width - terminalLineWidth(left) - MIN_GAP
				const regionWidth = thinkingRegionWidth(width, rightBudget)
				if (regionWidth === 0) return [left]
				const previewWidth =
					regionWidth -
					terminalLineWidth(THINKING_ICON) -
					THINKING_ICON_GAP
				const preview = rollingThinkingPreview(
					visibleThinking,
					previewWidth,
				)
				if (preview === '') return [left]
				const right = `${theme.fg('accent', THINKING_ICON)} ${theme.fg('muted', preview)}`
				const gap =
					width - terminalLineWidth(left) - terminalLineWidth(right)
				return [`${left}${' '.repeat(gap)}${right}`]
			},
		})
		painted = true
	}

	function unpaint(): void {
		if (ui === undefined || !painted) return
		setOrderedAboveEditorWidget(ui, SURFACE_ID, undefined)
		painted = false
	}

	const wordRotation = createRotation({
		scheduler: defaultIntervalScheduler,
		intervalMs: WORD_ROTATION_INTERVAL_MS,
		advance: () => {
			word = bag.next()
			// Re-registering the same id overwrites the entry and notifies the
			// registry, which asks the mounted host for a single re-render.
			paint()
		},
	})
	const spinnerRotation = createSpinnerRotation({
		scheduler: defaultIntervalScheduler,
		spinner: SAND_SPINNER,
		onFrame: frame => {
			spinnerFrame = frame
			thinkingTimeline.tick(Date.now())
			paint()
		},
	})

	function show(): void {
		if (ui === undefined) return
		// One loader line: hide the native spinner status while ours is up.
		ui.setWorkingVisible(false)
		wordRotation.start()
		spinnerRotation.start()
	}

	function hide(): void {
		wordRotation.stop()
		spinnerRotation.stop()
		unpaint()
		ui?.setWorkingVisible(true)
	}

	function bindUi(ctx: ExtensionContext): void {
		ui = ctx.ui
	}

	function updateThinking(
		event: { type: string; delta?: string } | undefined,
	): boolean {
		if (!event) return false
		const delta = typeof event.delta === 'string' ? event.delta : ''
		return advanceThinkingTimeline(
			thinkingTimeline,
			event.type,
			delta,
			Date.now(),
		)
	}

	function repaintThinking(changed: boolean): void {
		if (changed && painted) paint()
	}

	pi.on('agent_start', async (_event, ctx) => {
		bindUi(ctx)
		thinkingTimeline.reset()
		show()
	})

	pi.on('agent_settled', async (_event, ctx) => {
		bindUi(ctx)
		hide()
	})

	// Deltas accumulate continuously, but the timeline only publishes a stable
	// snapshot every 2.5s. Its deferred exit absorbs short think/work/think gaps.
	pi.on('message_update', async (event, ctx) => {
		bindUi(ctx)
		repaintThinking(updateThinking(event.assistantMessageEvent))
	})

	pi.on('message_end', async (_event, ctx) => {
		bindUi(ctx)
		if (thinkingTimeline.requestExit(Date.now()) && painted) paint()
	})

	// The questionnaire replaces the editor and waits for the user: a rotating
	// "working" line is misleading during that pause.
	pi.on('tool_execution_start', async (event, ctx) => {
		if (event.toolName !== 'ask_user_question') return
		bindUi(ctx)
		hide()
	})

	pi.on('tool_execution_end', async (event, ctx) => {
		if (event.toolName !== 'ask_user_question') return
		bindUi(ctx)
		show()
	})

	pi.on('session_shutdown', async (_event, ctx) => {
		bindUi(ctx)
		hide()
	})
}
