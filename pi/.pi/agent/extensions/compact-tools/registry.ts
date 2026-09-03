import type { CompactResultBodyRenderer } from './types.ts'

export type ToolViewOwner = 'compact-tools' | 'mutation-view' | 'external'
export type ExpandedResultMode = 'native' | 'custom'

export interface ToolViewSpec {
	owner: ToolViewOwner
	stackRows: boolean
	hideRowOnSuccess: boolean
	expandedResult: ExpandedResultMode
}

/**
 * Default view policy for tools registered outside this repository (npm
 * packages bridged through the compact style facade). Every tool without a
 * specific style therefore renders as a compact row and never falls back to
 * Pi's boxed default: one stacked line, expanded body owned by the caller.
 */
export const EXTERNAL_TOOL_VIEW: ToolViewSpec = {
	owner: 'external',
	stackRows: true,
	hideRowOnSuccess: false,
	expandedResult: 'custom',
}

/**
 * Single source of truth for every tool using the shared compact call row.
 * Tool-owning extensions keep execution and rich-body code; this registry owns
 * presentation policy so expansion and stacking cannot drift between callers.
 * Unregistered tool names resolve to the external default policy.
 */
export const TOOL_VIEW_REGISTRY = {
	read: {
		owner: 'compact-tools',
		stackRows: true,
		hideRowOnSuccess: false,
		expandedResult: 'native',
	},
	grep: {
		owner: 'compact-tools',
		stackRows: true,
		hideRowOnSuccess: false,
		expandedResult: 'native',
	},
	find: {
		owner: 'compact-tools',
		stackRows: true,
		hideRowOnSuccess: false,
		expandedResult: 'native',
	},
	ls: {
		owner: 'compact-tools',
		stackRows: true,
		hideRowOnSuccess: false,
		expandedResult: 'native',
	},
	bash: {
		owner: 'compact-tools',
		stackRows: true,
		hideRowOnSuccess: false,
		expandedResult: 'native',
	},
	edit: {
		owner: 'mutation-view',
		stackRows: false,
		hideRowOnSuccess: true,
		expandedResult: 'custom',
	},
	write: {
		owner: 'mutation-view',
		stackRows: false,
		hideRowOnSuccess: true,
		expandedResult: 'custom',
	},
} as const satisfies Record<string, ToolViewSpec>

export type ToolViewName = keyof typeof TOOL_VIEW_REGISTRY

export const COMPACT_TOOLS = (
	Object.keys(TOOL_VIEW_REGISTRY) as ToolViewName[]
).filter(tool => TOOL_VIEW_REGISTRY[tool].owner === 'compact-tools')

export function toolViewSpec(tool: string): ToolViewSpec {
	return TOOL_VIEW_REGISTRY[tool as ToolViewName] ?? EXTERNAL_TOOL_VIEW
}

/** Validate owner-provided rich bodies against the central expansion policy. */
export function validateRendererOptions(
	tool: string,
	options: { resultBody?: CompactResultBodyRenderer },
): ToolViewSpec {
	const spec = toolViewSpec(tool)
	const hasBody = options.resultBody !== undefined
	if (spec.expandedResult === 'custom' && !hasBody) {
		throw new Error(
			`compact-tools: "${tool}" requires a custom result body`,
		)
	}
	if (spec.expandedResult === 'native' && hasBody) {
		throw new Error(
			`compact-tools: "${tool}" must use its native expanded result`,
		)
	}
	return spec
}
