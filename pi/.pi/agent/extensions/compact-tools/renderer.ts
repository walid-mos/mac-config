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
		args: unknown,
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
	/** Subject override for tools without a registered args extractor. */
	subject?: (args: unknown) => string
	/** Summary override for tools without a registered result summarizer. */
	summary?: (result: CompactToolResult) => string
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
				subject: rendererOptions.subject
					? rendererOptions.subject(args)
					: subjectFor(tool, args),
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
			state.status = normalizedResult.isError
				? 'error'
				: options.isPartial
					? 'pending'
					: 'ok'
			if (
				state.startedAt !== undefined &&
				!options.isPartial &&
				state.endedAt === undefined
			) {
				state.endedAt = Date.now()
			}
			state.summary = rendererOptions.summary
			? rendererOptions.summary(normalizedResult)
			: summarizeResult(tool, normalizedResult)
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

/** Row content supplied by callers of the shared compact style facade. */
export interface CompactRowContent {
	/** Call identity shown between the tool label and the result summary. */
	subject?: (args: unknown) => string
	/** One-line result state appended after the subject. Empty when obvious. */
	summary?: (result: CompactToolResult) => string
	/** Body shown when the row is expanded (ctrl+o). Collapsed shows the row only. */
	expanded?: CompactResultBodyRenderer
}

/**
 * Renderers for a tool outside the registered set: a compact stacked row in
 * both modes, with the caller's expanded body delegated on ctrl+o. This is the
 * entrypoint every tool must use so no tool falls back to Pi's boxed default.
 */
export function createRowRenderers(
	tool: string,
	content: CompactRowContent = {},
): CompactRenderers {
	const expanded = content.expanded
	return createCompactRenderers(tool, undefined, {
		subject: content.subject,
		summary: content.summary,
		resultBody: expanded
			? (result, options, theme, context) =>
					options.expanded
						? expanded(result, options, theme, context)
						: emptyComponent()
			: () => emptyComponent(),
	})
}
