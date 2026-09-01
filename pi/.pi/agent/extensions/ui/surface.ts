import { terminalLineWidth, truncateTerminalLine } from './terminal-text.ts'

import type { Theme } from '@earendil-works/pi-coding-agent'

export type SurfacePlacement = 'aboveEditor' | 'belowEditor'

export type SurfaceRenderContext = {
	width: number
	theme: Theme | undefined
}

export type SurfaceEntry = {
	id: string
	placement: SurfacePlacement
	priority?: number
	/** Maximum rendered lines kept for this entry; extra lines collapse into a truncation marker. */
	maxLines?: number
	render: (context: SurfaceRenderContext) => readonly string[]
}

export const DEFAULT_MAX_SURFACE_LINES = 10

export type SurfaceRegistry = {
	register: (entry: SurfaceEntry) => () => void
	unregister: (id: string) => boolean
	clear: () => void
	hasEntries: (placement?: SurfacePlacement) => boolean
	render: (
		placement: SurfacePlacement,
		width: number,
		theme?: Theme,
	) => string[]
	subscribe: (listener: () => void) => () => void
}

export function createSurfaceRegistry(): SurfaceRegistry {
	const entries = new Map<string, SurfaceEntry>()
	const listeners = new Set<() => void>()

	function notify(): void {
		for (const listener of listeners) listener()
	}

	function register(entry: SurfaceEntry): () => void {
		entries.set(entry.id, entry)
		notify()
		let registered = true
		return () => {
			if (!registered) return
			registered = false
			if (entries.get(entry.id) !== entry) return
			entries.delete(entry.id)
			notify()
		}
	}

	function unregister(id: string): boolean {
		if (!entries.has(id)) return false
		entries.delete(id)
		notify()
		return true
	}

	function clear(): void {
		if (entries.size === 0) return
		entries.clear()
		notify()
	}

	function hasEntries(placement?: SurfacePlacement): boolean {
		return [...entries.values()].some(
			entry => placement === undefined || entry.placement === placement,
		)
	}

	function render(
		placement: SurfacePlacement,
		width: number,
		theme?: Theme,
	): string[] {
		const safeWidth = Number.isFinite(width)
			? Math.max(0, Math.floor(width))
			: 0
		if (safeWidth === 0) return []
		return [...entries.values()]
			.filter(entry => entry.placement === placement)
			.toSorted(compareSurfaceEntries)
			.flatMap(entry => renderSurfaceEntry(entry, safeWidth, theme))
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener)
		return () => listeners.delete(listener)
	}

	return { register, unregister, clear, hasEntries, render, subscribe }
}

const GLOBAL_SURFACE_STATE = Symbol.for('stow.pi.ui.surface-registry.v1')

type GlobalSurfaceState = {
	version: 1
	registry: SurfaceRegistry
}

/**
 * pi evaluates every extension through a fresh jiti instance with module
 * caching disabled. A module-level singleton would therefore exist once per
 * extension and would not be global at all. Store the registry on globalThis
 * under a process-wide symbol so every isolated extension module graph gets
 * the exact same registry object.
 */
function getGlobalSurfaceRegistry(): SurfaceRegistry {
	const store = globalThis as unknown as Record<PropertyKey, unknown>
	const current = store[GLOBAL_SURFACE_STATE] as
		| GlobalSurfaceState
		| undefined
	if (current?.version === 1) return current.registry

	const registry = createSurfaceRegistry()
	store[GLOBAL_SURFACE_STATE] = {
		version: 1,
		registry,
	} satisfies GlobalSurfaceState
	return registry
}

export const surfaceRegistry = getGlobalSurfaceRegistry()

export function subscribeSurfaceChanges(listener: () => void): () => void {
	return surfaceRegistry.subscribe(listener)
}

function renderSurfaceEntry(
	entry: SurfaceEntry,
	width: number,
	theme: Theme | undefined,
): string[] {
	let lines: readonly string[]
	try {
		lines = entry.render({ width, theme })
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error)
		return [`[surface] ${entry.id}: render failed (${message})`].map(line =>
			clipSurfaceLine(line, width),
		)
	}
	const maxLines = entry.maxLines ?? DEFAULT_MAX_SURFACE_LINES
	const visible = lines
		.slice(0, maxLines)
		.map(line => clipSurfaceLine(line, width))
	if (lines.length <= maxLines) return visible
	const marker = `… (+${String(lines.length - maxLines)} lines)`
	return [...visible, clipSurfaceLine(marker, width)]
}

function compareSurfaceEntries(
	left: SurfaceEntry,
	right: SurfaceEntry,
): number {
	const priority = (left.priority ?? 0) - (right.priority ?? 0)
	return priority === 0 ? left.id.localeCompare(right.id) : priority
}

/** Compatibility alias for existing surface clients and tests. */
export const surfaceLineWidth = terminalLineWidth

function clipSurfaceLine(line: string, width: number): string {
	const firstLine = line.split(/[\r\n]/u, 1)[0] ?? ''
	return truncateTerminalLine(firstLine, width, '…')
}
