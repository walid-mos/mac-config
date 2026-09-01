import type { CompactResultBodyRenderer } from "./types.ts";

export type ToolViewOwner = "compact-tools" | "background" | "mutation-view";
export type ExpandedResultMode = "native" | "custom";

export interface ToolViewSpec {
	owner: ToolViewOwner;
	stackRows: boolean;
	hideRowOnSuccess: boolean;
	expandedResult: ExpandedResultMode;
}

/**
 * Single source of truth for every tool using the shared compact call row.
 * Tool-owning extensions keep execution and rich-body code; this registry owns
 * presentation policy so expansion and stacking cannot drift between callers.
 */
export const TOOL_VIEW_REGISTRY = {
	read: { owner: "compact-tools", stackRows: true, hideRowOnSuccess: false, expandedResult: "native" },
	grep: { owner: "compact-tools", stackRows: true, hideRowOnSuccess: false, expandedResult: "native" },
	find: { owner: "compact-tools", stackRows: true, hideRowOnSuccess: false, expandedResult: "native" },
	ls: { owner: "compact-tools", stackRows: true, hideRowOnSuccess: false, expandedResult: "native" },
	bash: { owner: "background", stackRows: true, hideRowOnSuccess: false, expandedResult: "native" },
	background: { owner: "background", stackRows: true, hideRowOnSuccess: false, expandedResult: "native" },
	edit: { owner: "mutation-view", stackRows: false, hideRowOnSuccess: true, expandedResult: "custom" },
	write: { owner: "mutation-view", stackRows: false, hideRowOnSuccess: true, expandedResult: "custom" },
} as const satisfies Record<string, ToolViewSpec>;

export type ToolViewName = keyof typeof TOOL_VIEW_REGISTRY;

export const COMPACT_TOOLS = (Object.keys(TOOL_VIEW_REGISTRY) as ToolViewName[])
	.filter((tool) => TOOL_VIEW_REGISTRY[tool].owner === "compact-tools");

export function toolViewSpec(tool: string): ToolViewSpec {
	const spec = TOOL_VIEW_REGISTRY[tool as ToolViewName];
	if (!spec) throw new Error(`compact-tools: missing registry entry for "${tool}"`);
	return spec;
}

/** Validate owner-provided rich bodies against the central expansion policy. */
export function validateRendererOptions(
	tool: string,
	options: { resultBody?: CompactResultBodyRenderer },
): ToolViewSpec {
	const spec = toolViewSpec(tool);
	const hasBody = options.resultBody !== undefined;
	if (spec.expandedResult === "custom" && !hasBody) {
		throw new Error(`compact-tools: "${tool}" requires a custom result body`);
	}
	if (spec.expandedResult === "native" && hasBody) {
		throw new Error(`compact-tools: "${tool}" must use its native expanded result`);
	}
	return spec;
}
