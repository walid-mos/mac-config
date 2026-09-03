/**
 * Compact style facade, published on a process-global slot. Pi loads every
 * extension entrypoint through an isolated jiti module graph, so npm packages
 * (patched to adopt the shared compact row) cannot import this repository's
 * modules by specifier. They read the slot instead; the row, stack and summary
 * implementations stay here as the single source of truth.
 *
 * The slot key is a stable contract: consumers hold a structural copy of
 * `CompactStyleApi` and fail loudly (renderers fall back per slot) when the
 * facade is absent, which only happens outside this repository's config.
 */

import { compactRowLine } from './line.ts'
import { createRowRenderers } from './renderer.ts'

import type { CompactRowLayout, CompactRowView } from './line.ts'
import type { CompactTheme } from './types.ts'

/** Well-known property holding the facade on `globalThis`. */
export const COMPACT_STYLE_SLOT = 'piCompactStyle'

export interface CompactStyleApi {
	/** Renderers for any tool name; unregistered names take the external policy. */
	createRowRenderers: typeof createRowRenderers
	/** Compose one themed compact row line (already truncated to `width`). */
	composeRowLine: (
		view: CompactRowView,
		width: number,
		theme: CompactTheme,
		layout?: CompactRowLayout,
	) => string
}

function facade(): CompactStyleApi {
	return {
		createRowRenderers,
		composeRowLine: compactRowLine,
	}
}

/** Install the facade for jiti-isolated consumers (npm package patches). */
export function publishCompactStyle(): void {
	;(globalThis as Record<string, unknown>)[COMPACT_STYLE_SLOT] = facade()
}

/** Read the facade; undefined when the compact-tools extension is absent. */
export function resolveCompactStyle(): CompactStyleApi | undefined {
	const api = (globalThis as Record<string, unknown>)[COMPACT_STYLE_SLOT]
	return isCompactStyleApi(api) ? api : undefined
}

function isCompactStyleApi(value: unknown): value is CompactStyleApi {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as CompactStyleApi).createRowRenderers === 'function' &&
		typeof (value as CompactStyleApi).composeRowLine === 'function'
	)
}
