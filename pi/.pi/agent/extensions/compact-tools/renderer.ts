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
	hideOnSuccess: boolean;
}

function makeRowComponent(hideOnSuccess: boolean): RowComponent {
	return {
		view: null,
		hideOnSuccess,
		render(width: number): string[] {
			if (!this.view) return [];
			// Tools whose success carries a richer body (edit-view frame) hide
			// their row once settled, unless the native expanded view is shown.
			if (this.hideOnSuccess && this.view.state.status === "ok" && !this.view.expanded) return [];
			return [compactRowLine(this.view, width, this.view.theme)];
		},
		invalidate(): void {},
	};
}

function emptyComponent(): CompactComponent {
	return { render: () => [], invalidate: () => {} };
}

export interface CompactRendererOptions {
	/** Hide the row line once the tool succeeds and the result body speaks for
	 * itself (collapsed view only; expanded keeps the row above the body). */
	hideRowOnSuccess?: boolean;
	/** Collapsed result body for tools whose success carries a richer view
	 * (edit-view frame). Undefined keeps the bare row. */
	collapsedBody?: (
		result: CompactToolResult,
		options: { expanded?: boolean; isPartial?: boolean },
		theme: CompactTheme,
		context: CompactRenderContext,
	) => CompactComponent;
}

export function createCompactRenderers(
	tool: string,
	resolveNative?: NativeRendererResolver,
	rendererOptions: CompactRendererOptions = {},
): CompactRenderers {
	const hideOnSuccess = rendererOptions.hideRowOnSuccess === true;
	return {
		renderCall(args, theme, context) {
			const state = context.state;
			if (context.executionStarted && state.startedAt === undefined) {
				state.startedAt = Date.now();
				state.endedAt = undefined;
			}
			if (state.status === undefined) state.status = "pending";
			const component = (context.lastComponent as RowComponent | undefined) ?? makeRowComponent(hideOnSuccess);
			component.view = {
				tool,
				subject: subjectFor(tool, args),
				state,
				theme,
				expanded: context.expanded === true,
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
			if (!options.expanded) {
				return rendererOptions.collapsedBody
					? rendererOptions.collapsedBody(result, options, theme, context)
					: emptyComponent();
			}
			const native = resolveNative?.(context.cwd);
			return native?.renderResult ? native.renderResult(result, options, theme, context) : emptyComponent();
		},
	};
}
