/**
 * Shared compact renderers for a tool row: one line while collapsed, native
 * output when expanded. Used both by the override factory (built-in tools)
 * and by extensions that own a tool registration (pi-background owns "bash").
 */

import { compactRowLine, type CompactRowView } from "./line.ts";
import { subjectFor, summarizeResult } from "./summary.ts";
import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolDefinition,
	CompactToolResult,
} from "./types.ts";

/** Resolves the native definition whose renderResult backs the expanded view. */
export type NativeRendererResolver = (cwd?: string) => CompactToolDefinition | undefined;

export interface CompactRenderers {
	renderCall: (args: any, theme: CompactTheme, context: CompactRenderContext) => CompactComponent;
	renderResult: (
		result: CompactToolResult,
		options: { expanded?: boolean; isPartial?: boolean },
		theme: CompactTheme,
		context: CompactRenderContext,
	) => CompactComponent;
}

/**
 * A row line component that re-reads its view on every render pass, so the
 * status glyph and summary follow the shared state updated by renderResult.
 */
interface RowComponent extends CompactComponent {
	view: CompactRowView | null;
}

function makeRowComponent(): RowComponent {
	return {
		view: null,
		render(width: number): string[] {
			return this.view ? [compactRowLine(this.view, width, this.view.theme)] : [];
		},
		invalidate(): void {},
	};
}

function emptyComponent(): CompactComponent {
	return { render: () => [], invalidate: () => {} };
}

export function createCompactRenderers(tool: string, resolveNative?: NativeRendererResolver): CompactRenderers {
	return {
		renderCall(args, theme, context) {
			const state = context.state;
			if (context.executionStarted && state.startedAt === undefined) {
				state.startedAt = Date.now();
				state.endedAt = undefined;
			}
			if (state.status === undefined) state.status = "pending";
			const component = (context.lastComponent as RowComponent | undefined) ?? makeRowComponent();
			component.view = {
				tool,
				subject: subjectFor(tool, args),
				state,
				theme,
			};
			return component;
		},
		renderResult(result, options, theme, context) {
			const state = context.state;
			state.status = result.isError ? "error" : "ok";
			if (state.startedAt !== undefined && !options.isPartial && state.endedAt === undefined) {
				state.endedAt = Date.now();
			}
			state.summary = summarizeResult(tool, context.args as Record<string, unknown>, result);
			if (!options.expanded) return emptyComponent();
			const native = resolveNative?.(context.cwd);
			return native?.renderResult ? native.renderResult(result, options, theme, context) : emptyComponent();
		},
	};
}
