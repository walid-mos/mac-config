/**
 * Shared types for compact tool rows. Structurally typed on purpose: none of
 * these modules import pi packages at runtime, so tests can exercise the full
 * override wiring with fakes.
 */

/** Lifecycle of one tool row, shared between the call and result slots. */
export type CompactRowStatus = 'pending' | 'ok' | 'error'

/**
 * Row-local state stored in the tool renderer's shared `context.state`.
 * `startedAt`/`endedAt` mirror the built-in bash renderer so the expanded
 * native view keeps its elapsed-time display.
 */
export interface CompactRowState {
	status?: CompactRowStatus
	summary?: string
	startedAt?: number
	endedAt?: number
}

/** Minimal component contract used by the compact rows. */
export interface CompactComponent {
	render(width: number): string[]
	invalidate(): void
}

/** Minimal theme surface used by the compact rows. */
export interface CompactTheme {
	fg(role: string, text: string): string
	bold(text: string): string
}

/** Minimal tool result shape (subset of AgentToolResult). */
export interface CompactToolResult {
	content: ReadonlyArray<{ type: string; text?: string }>
	details?: unknown
	isError?: boolean
}

/** Render context handed to renderCall/renderResult (subset of ToolRenderContext). */
export interface CompactRenderContext {
	args?: unknown
	state: CompactRowState & Record<string, unknown>
	toolCallId?: string
	invalidate?: () => void
	cwd?: string
	executionStarted?: boolean
	expanded?: boolean
	isError?: boolean
	lastComponent?: CompactComponent | undefined
}

/** Minimal tool definition shape (subset of ToolDefinition). */
export type CompactResultBodyRenderer = (
	result: CompactToolResult,
	options: { expanded?: boolean; isPartial?: boolean },
	theme: CompactTheme,
	context: CompactRenderContext,
) => CompactComponent

export interface CompactToolDefinition {
	name: string
	label?: string
	description?: string
	parameters: unknown
	promptSnippet?: string
	promptGuidelines?: string[]
	renderShell?: 'default' | 'self'
	execute(
		toolCallId: string,
		params: unknown,
		signal: AbortSignal | undefined,
		onUpdate: ((update: unknown) => void) | undefined,
		ctx: { cwd: string },
	): Promise<unknown>
	renderCall?: (
		args: unknown,
		theme: CompactTheme,
		context: CompactRenderContext,
	) => CompactComponent
	renderResult?: (
		result: CompactToolResult,
		options: { expanded?: boolean; isPartial?: boolean },
		theme: CompactTheme,
		context: CompactRenderContext,
	) => CompactComponent
	[key: string]: unknown
}
