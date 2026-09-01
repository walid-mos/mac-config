/**
 * Shared compact renderers for a tool row. Rich tools may keep their custom
 * result body in both collapsed and expanded modes; ordinary tools delegate
 * expanded output to Pi's native renderer.
 */

import { compactRowLine, type CompactRowView } from './line.ts'
import { validateRendererOptions } from './registry.ts'
import { compactRowStack } from './stack.ts'
import { subjectFor, summarizeResult } from './summary.ts'

import type {
	CompactComponent,
	CompactRenderContext,
	CompactResultBodyRenderer,
	CompactTheme,
	CompactToolDefinition,
	CompactToolResult,
} from './types.ts'

/** Resolves the native definition whose renderResult backs the expanded view. */
export type NativeRendererResolver = (
	cwd?: string,
) => CompactToolDefinition | undefined

export interface CompactRenderers {
	renderCall: (
		args: any,
		theme: CompactTheme,
		context: CompactRenderContext,
	) => CompactComponent
	renderResult: (
		result: CompactToolResult,
		options: { expanded?: boolean; isPartial?: boolean },
		theme: CompactTheme,
		context: CompactRenderContext,
	) => CompactComponent
}

/**
 * A row line component that re-reads its view on every render pass, so the
 * status glyph and summary follow the shared state updated by renderResult.
 */
interface RowComponent extends CompactComponent {
	readonly compactRow: true
	view: CompactRowView | null
	hideOnSuccess: boolean
	toolCallId?: string
}

function makeRowComponent(hideOnSuccess: boolean): RowComponent {
	return {
		compactRow: true,
		view: null,
		hideOnSuccess,
		render(width: number): string[] {
			if (!this.view) return []
			// Tools whose success carries a richer body (mutation-view frame) hide
			// their row once settled, unless the native expanded view is shown.
			if (
				this.hideOnSuccess &&
				this.view.state.status === 'ok' &&
				!this.view.expanded
			)
				return []
			return this.toolCallId
				? compactRowStack.render(this.toolCallId, this.view, width)
				: [compactRowLine(this.view, width, this.view.theme)]
		},
		invalidate(): void {},
	}
}

function emptyComponent(): CompactComponent {
	return { render: () => [], invalidate: () => {} }
}

export interface CompactRendererOptions {
	/** Rich result body owned by the tool extension and used in both modes. */
	resultBody?: CompactResultBodyRenderer
}

export function createCompactRenderers(
	tool: string,
	resolveNative?: NativeRendererResolver,
	rendererOptions: CompactRendererOptions = {},
): CompactRenderers {
	const spec = validateRendererOptions(tool, rendererOptions)
	const hideOnSuccess = spec.hideRowOnSuccess
	compactRowStack.registerTool(tool, spec.stackRows)
	return {
		renderCall(args, theme, context) {
			const state = context.state
			if (context.executionStarted && state.startedAt === undefined) {
				state.startedAt = Date.now()
				state.endedAt = undefined
			}
			if (state.status === undefined) state.status = 'pending'
			const lastComponent = context.lastComponent as
				| RowComponent
				| undefined
			const storedComponent = state.compactRowComponent as
				| RowComponent
				| undefined
			const component =
				lastComponent?.compactRow === true
					? lastComponent
					: storedComponent?.compactRow === true
						? storedComponent
						: makeRowComponent(hideOnSuccess)
			state.compactRowComponent = component
			component.view = {
				tool,
				subject: subjectFor(tool, args),
				state,
				theme,
				expanded: context.expanded === true,
			}
			if (context.toolCallId) {
				component.toolCallId = context.toolCallId
				compactRowStack.attach(
					context.toolCallId,
					component.view,
					context.invalidate ?? (() => {}),
				)
			}
			return component
		},
		renderResult(result, options, theme, context) {
			const state = context.state
			const normalizedResult =
				context.isError === undefined
					? result
					: { ...result, isError: context.isError }
			state.status = normalizedResult.isError ? 'error' : 'ok'
			if (
				state.startedAt !== undefined &&
				!options.isPartial &&
				state.endedAt === undefined
			) {
				state.endedAt = Date.now()
			}
			state.summary = summarizeResult(
				tool,
				context.args as Record<string, unknown>,
				normalizedResult,
			)
			if (rendererOptions.resultBody) {
				return rendererOptions.resultBody(
					normalizedResult,
					options,
					theme,
					context,
				)
			}
			if (!options.expanded) return emptyComponent()
			const native = resolveNative?.(context.cwd)
			return native?.renderResult
				? native.renderResult(result, options, theme, context)
				: emptyComponent()
		},
	}
}
