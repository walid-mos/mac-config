/**
 * Compact tools: one line per built-in tool call (read, grep, find, ls, bash).
 * Execution is delegated untouched to the real built-in definitions; only the
 * rendering is replaced. ctrl+o expands back to the full native output.
 * `edit` and `write` share the dedicated mutation-view extension.
 */

import {
	createBashToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	type ExtensionAPI,
	type ToolDefinition,
} from '@earendil-works/pi-coding-agent'

import { registerCompactStackLifecycle } from './compact-tools/lifecycle.ts'
import {
	COMPACT_TOOLS,
	createCompactOverrides,
} from './compact-tools/overrides.ts'

const NATIVE_FACTORIES: Record<
	string,
	((cwd: string) => ToolDefinition<any, any>) | undefined
> = {
	read: createReadToolDefinition,
	grep: createGrepToolDefinition,
	find: createFindToolDefinition,
	ls: createLsToolDefinition,
	bash: createBashToolDefinition,
}

export default function compactTools(pi: ExtensionAPI): void {
	registerCompactStackLifecycle(pi)
	const overrides = createCompactOverrides({
		createBuiltin: (toolName, cwd) => NATIVE_FACTORIES[toolName]?.(cwd),
		tools: COMPACT_TOOLS,
	})
	for (const definition of overrides) {
		pi.registerTool(definition as ToolDefinition<any, any>)
	}
}
