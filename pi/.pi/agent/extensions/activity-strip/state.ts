export type ActivityStripState = {
	promptStarted: boolean
	frozen: boolean
	startedAtMs: number
	elapsedMs: number
	inputTokens: number
	outputTokens: number
	cacheTokens: number
	streamedCharacters: number
	generationStartedAtMs: number
	generationElapsedMs: number
}

const ESTIMATED_CHARACTERS_PER_TOKEN = 4
const STREAM_DELTA_TYPES = new Set([
	'text_delta',
	'thinking_delta',
	'toolcall_delta',
])

export function emptyActivityStrip(): ActivityStripState {
	return {
		promptStarted: false,
		frozen: false,
		startedAtMs: 0,
		elapsedMs: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheTokens: 0,
		streamedCharacters: 0,
		generationStartedAtMs: 0,
		generationElapsedMs: 0,
	}
}

export function startPrompt(nowMs: number): ActivityStripState {
	return {
		...emptyActivityStrip(),
		promptStarted: true,
		startedAtMs: nowMs,
	}
}

export function startTurn(state: ActivityStripState): ActivityStripState {
	if (!state.promptStarted) return state
	return {
		...state,
		streamedCharacters: 0,
		generationStartedAtMs: 0,
	}
}

export function addStreamDelta(
	state: ActivityStripState,
	assistantEvent: unknown,
	nowMs: number,
): ActivityStripState {
	if (!state.promptStarted || !isRecord(assistantEvent)) return state
	const startedAt = state.generationStartedAtMs || nowMs
	if (assistantEvent.type === 'start')
		return { ...state, generationStartedAtMs: startedAt }
	if (
		typeof assistantEvent.type !== 'string' ||
		!STREAM_DELTA_TYPES.has(assistantEvent.type) ||
		typeof assistantEvent.delta !== 'string'
	)
		return state
	return {
		...state,
		streamedCharacters:
			state.streamedCharacters + assistantEvent.delta.length,
		generationStartedAtMs: startedAt,
	}
}

export function tickElapsed(
	state: ActivityStripState,
	nowMs: number,
): ActivityStripState {
	if (!state.promptStarted || state.frozen) return state
	return { ...state, elapsedMs: Math.max(0, nowMs - state.startedAtMs) }
}

export function settleStrip(
	state: ActivityStripState,
	nowMs: number,
): ActivityStripState {
	if (!state.promptStarted) return state
	return {
		...state,
		frozen: true,
		elapsedMs: Math.max(0, nowMs - state.startedAtMs),
		streamedCharacters: 0,
		generationElapsedMs: completedGenerationMs(state, nowMs),
		generationStartedAtMs: 0,
	}
}

export function addAssistantUsage(
	state: ActivityStripState,
	message: unknown,
	nowMs: number,
): ActivityStripState {
	if (
		!state.promptStarted ||
		!isRecord(message) ||
		message.role !== 'assistant'
	)
		return state
	const usage = isRecord(message.usage) ? message.usage : undefined
	if (!usage) return state
	return {
		...state,
		inputTokens: state.inputTokens + finiteCount(usage.input),
		outputTokens: state.outputTokens + finiteCount(usage.output),
		cacheTokens:
			state.cacheTokens +
			finiteCount(usage.cacheRead) +
			finiteCount(usage.cacheWrite),
		streamedCharacters: 0,
		generationElapsedMs: completedGenerationMs(state, nowMs),
		generationStartedAtMs: 0,
	}
}

export function estimatedOutputTokens(state: ActivityStripState): number {
	return (
		state.outputTokens +
		Math.ceil(state.streamedCharacters / ESTIMATED_CHARACTERS_PER_TOKEN)
	)
}

export function hasLiveTokenEstimate(state: ActivityStripState): boolean {
	return state.streamedCharacters > 0
}

export function generationDurationMs(state: ActivityStripState): number {
	if (state.generationStartedAtMs === 0) return state.generationElapsedMs
	const renderedAtMs = state.startedAtMs + state.elapsedMs
	return completedGenerationMs(state, renderedAtMs)
}

function completedGenerationMs(
	state: ActivityStripState,
	nowMs: number,
): number {
	if (state.generationStartedAtMs === 0) return state.generationElapsedMs
	return (
		state.generationElapsedMs +
		Math.max(0, nowMs - state.generationStartedAtMs)
	)
}

function finiteCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.max(0, value)
		: 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
