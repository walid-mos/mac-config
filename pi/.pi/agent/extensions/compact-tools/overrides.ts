/**
 * Factory of built-in tool overrides: same name, same execution (delegated to
 * the real built-in definition), but the row renders as one line.
 * The native `create*ToolDefinition` factories are injected so this module
 * stays free of pi runtime imports and fully testable.
 */

import { COMPACT_TOOLS } from './registry.ts'
import { createCompactRenderers } from './renderer.ts'

import type { CompactToolDefinition } from './types.ts'

export { COMPACT_TOOLS } from './registry.ts'

/** Creates the real built-in definition for a tool in a working directory. */
export type BuiltinDefinitionFactory = (
	toolName: string,
	cwd: string,
) => CompactToolDefinition | undefined

export interface CompactOverridesOptions {
	createBuiltin: BuiltinDefinitionFactory
	tools?: readonly string[]
}

export function createCompactOverrides(
	options: CompactOverridesOptions,
): CompactToolDefinition[] {
	const tools = options.tools ?? COMPACT_TOOLS
	const nativeByCwd = new Map<string, Map<string, CompactToolDefinition>>()

	function nativeFor(
		tool: string,
		cwd: string,
	): CompactToolDefinition | undefined {
		let byCwd = nativeByCwd.get(tool)
		if (byCwd === undefined) {
			byCwd = new Map()
			nativeByCwd.set(tool, byCwd)
		}
		let native = byCwd.get(cwd)
		if (native === undefined) {
			native = options.createBuiltin(tool, cwd)
			byCwd.set(cwd, native)
		}
		return native
	}

	const overrides: CompactToolDefinition[] = []
	for (const tool of tools) {
		// Registration-time base: only metadata and schema are taken from it
		// (identical regardless of cwd); execution and rendering resolve the
		// native definition lazily with the row's own cwd.
		const base = options.createBuiltin(tool, process.cwd())
		if (!base) continue

		const renderers = createCompactRenderers(tool, cwd =>
			cwd ? nativeFor(tool, cwd) : undefined,
		)

		overrides.push({
			...base,
			renderShell: 'self',
			...renderers,
			execute(toolCallId, params, signal, onUpdate, ctx) {
				const native = nativeFor(tool, ctx.cwd)
				if (!native)
					throw new Error(
						`compact-tools: no native definition for "${tool}"`,
					)
				return native.execute(toolCallId, params, signal, onUpdate, ctx)
			},
		})
	}
	return overrides
}
