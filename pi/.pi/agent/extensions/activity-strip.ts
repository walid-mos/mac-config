import { renderActivityLine } from './activity-strip/render.ts'
import {
	addAssistantUsage,
	addStreamDelta,
	emptyActivityStrip,
	settleStrip,
	startPrompt,
	startTurn,
	tickElapsed,
	type ActivityStripState,
} from './activity-strip/state.ts'
import {
	ABOVE_EDITOR_PRIORITY,
	setOrderedAboveEditorWidget,
} from './ui/ordered-widget-stack.ts'

import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

const WIDGET_ID = 'activity-strip'
const TICK_MS = 250
const SETTLED_VISIBLE_MS = 20_000

export default function activityStripExtension(pi: ExtensionAPI): void {
	let state = emptyActivityStrip()
	let context: ExtensionContext | undefined
	let tick: ReturnType<typeof setInterval> | undefined
	let hideTimeout: ReturnType<typeof setTimeout> | undefined
	let visible = false

	function paint(): void {
		if (!visible || !context?.hasUI) return
		setOrderedAboveEditorWidget(context.ui, WIDGET_ID, {
			priority: ABOVE_EDITOR_PRIORITY.sessionStatus,
			render: (width, theme) => [renderActivityLine(state, width, theme)],
		})
	}

	function hide(): void {
		visible = false
		if (context?.hasUI)
			setOrderedAboveEditorWidget(context.ui, WIDGET_ID, undefined)
	}

	function stopTimers(): void {
		if (tick) clearInterval(tick)
		if (hideTimeout) clearTimeout(hideTimeout)
		tick = undefined
		hideTimeout = undefined
	}

	function startTick(): void {
		stopTimers()
		tick = setInterval(() => {
			state = tickElapsed(state, Date.now())
			paint()
		}, TICK_MS)
		tick.unref?.()
	}

	pi.on('session_start', (_event, ctx) => {
		context = ctx
		hide()
	})

	pi.on('before_agent_start', (_event, ctx) => {
		context = ctx
		state = startPrompt(Date.now())
		visible = true
		startTick()
		paint()
	})

	pi.on('turn_start', (_event, ctx) => {
		context = ctx
		state = startTurn(state)
		paint()
	})

	pi.on('message_update', (event, ctx) => {
		context = ctx
		state = addStreamDelta(state, event.assistantMessageEvent, Date.now())
	})

	pi.on('turn_end', (event, ctx) => {
		context = ctx
		state = addAssistantUsage(state, event.message, Date.now())
		paint()
	})

	pi.on('agent_settled', (_event, ctx) => {
		context = ctx
		if (tick) clearInterval(tick)
		tick = undefined
		state = settleStrip(state, Date.now())
		paint()
		hideTimeout = setTimeout(hide, SETTLED_VISIBLE_MS)
		hideTimeout.unref?.()
	})

	pi.on('session_shutdown', (_event, ctx) => {
		context = ctx
		stopTimers()
		hide()
		state = emptyActivityStrip()
		context = undefined
	})
}

export type { ActivityStripState }
