import {
	subscribeSurfaceChanges,
	surfaceRegistry,
	type SurfacePlacement,
} from './surface.ts'

import type { ExtensionUIContext, Theme } from '@earendil-works/pi-coding-agent'
import type { TUI } from '@earendil-works/pi-tui'

export const HOST_WIDGET_IDS: Readonly<Record<SurfacePlacement, string>> = {
	aboveEditor: 'ordered-above-editor',
	belowEditor: 'ordered-below-editor',
}

export const ABOVE_EDITOR_PRIORITY = {
	working: 50,
	goal: 100,
	backgroundTasks: 200,
	activity: 300,
} as const

export type OrderedWidgetEntry = {
	priority: number
	render: (width: number, theme: Theme) => string[]
}

type WidgetPlacement = SurfacePlacement

/**
 * Single source of truth for the adapter side: which host component is
 * currently mounted for each placement. Entry bookkeeping lives in the
 * surface registry; this map only tracks the mounted pi widget per placement.
 */
type OrderedWidgetHostBinding = {
	dispose: () => void
}

type PlacementBinding = { host?: OrderedWidgetHostBinding }

type GlobalWidgetStackState = {
	version: 1
	bindingsByPlacement: Map<WidgetPlacement, PlacementBinding>
}

const GLOBAL_WIDGET_STACK_STATE = Symbol.for(
	'stow.pi.ui.ordered-widget-stack.v1',
)

/** Share the mounted-host bindings across pi's isolated jiti module graphs. */
function getGlobalWidgetStackState(): GlobalWidgetStackState {
	const store = globalThis as unknown as Record<PropertyKey, unknown>
	const current = store[GLOBAL_WIDGET_STACK_STATE] as
		| GlobalWidgetStackState
		| undefined
	if (current?.version === 1) return current

	const state: GlobalWidgetStackState = {
		version: 1,
		bindingsByPlacement: new Map(),
	}
	store[GLOBAL_WIDGET_STACK_STATE] = state
	return state
}

const { bindingsByPlacement } = getGlobalWidgetStackState()

class OrderedWidgetHost {
	private readonly unsubscribe: () => void

	private readonly tui: TUI
	private readonly readTheme: () => Theme
	private readonly placement: WidgetPlacement

	constructor(tui: TUI, readTheme: () => Theme, placement: WidgetPlacement) {
		this.tui = tui
		this.readTheme = readTheme
		this.placement = placement
		this.unsubscribe = subscribeSurfaceChanges(() =>
			this.tui.requestRender(),
		)
	}

	render(width: number): string[] {
		return surfaceRegistry.render(this.placement, width, this.readTheme())
	}

	/** Called by pi-tui on theme changes and other global invalidations: re-render with live theme. */
	invalidate(): void {
		this.tui.requestRender()
	}

	dispose(): void {
		this.unsubscribe()
		const binding = bindingsByPlacement.get(this.placement)
		if (binding?.host === this) binding.host = undefined
	}
}

export function setOrderedAboveEditorWidget(
	ui: ExtensionUIContext,
	key: string,
	entry: OrderedWidgetEntry | undefined,
): void {
	setOrderedSurfaceWidget(ui, key, entry, 'aboveEditor')
}

export function setOrderedSurfaceWidget(
	ui: ExtensionUIContext,
	key: string,
	entry: OrderedWidgetEntry | undefined,
	placement: WidgetPlacement = 'aboveEditor',
): void {
	if (entry === undefined) {
		removeSurfaceEntry(ui, key, placement)
		return
	}
	surfaceRegistry.register({
		id: key,
		placement,
		priority: entry.priority,
		render: ({ width, theme }) =>
			theme === undefined ? [] : entry.render(width, theme),
	})
	mountHost(ui, placement)
}

function removeSurfaceEntry(
	ui: ExtensionUIContext,
	key: string,
	placement: WidgetPlacement,
): void {
	const removed = surfaceRegistry.unregister(key)
	if (!removed) return
	if (surfaceRegistry.hasEntries(placement)) return
	unmountHost(ui, placement)
}

function mountHost(ui: ExtensionUIContext, placement: WidgetPlacement): void {
	const binding = getBinding(placement)
	if (binding.host !== undefined) return
	ui.setWidget(
		HOST_WIDGET_IDS[placement],
		tui => {
			const host = new OrderedWidgetHost(tui, () => ui.theme, placement)
			binding.host = host
			return host
		},
		{ placement },
	)
}

function unmountHost(ui: ExtensionUIContext, placement: WidgetPlacement): void {
	bindingsByPlacement.get(placement)?.host?.dispose()
	ui.setWidget(HOST_WIDGET_IDS[placement], undefined)
}

function getBinding(placement: WidgetPlacement): PlacementBinding {
	const existing = bindingsByPlacement.get(placement)
	if (existing !== undefined) return existing
	const binding: PlacementBinding = {}
	bindingsByPlacement.set(placement, binding)
	return binding
}
