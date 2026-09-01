import type { CompactRowView } from './line.ts'

const STACK_STATE_SYMBOL = Symbol.for('pi.compact-tools.row-stack.state')

export interface StackEntry {
	view: CompactRowView
	invalidate: () => void
}

export interface CompactRowStackState {
	entries: Map<string, StackEntry>
	groupById: Map<string, string[]>
	stackableTools: Set<string>
	activeGroup: string[] | undefined
	seenCallIds: Set<string>
	liveAssistant: boolean
	liveVisibleTextBlocks: number
}

export function createCompactRowStackState(): CompactRowStackState {
	return {
		entries: new Map(),
		groupById: new Map(),
		stackableTools: new Set(),
		activeGroup: undefined,
		seenCallIds: new Set(),
		liveAssistant: false,
		liveVisibleTextBlocks: 0,
	}
}

function isOptionalArray(value: unknown): boolean {
	return value === undefined || Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): boolean {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isCompactRowStackState(value: unknown): value is CompactRowStackState {
	if (typeof value !== 'object' || value === null) return false
	const state = value as Partial<CompactRowStackState>
	return [
		state.entries instanceof Map,
		state.groupById instanceof Map,
		state.stackableTools instanceof Set,
		isOptionalArray(state.activeGroup),
		state.seenCallIds instanceof Set,
		typeof state.liveAssistant === 'boolean',
		isNonNegativeInteger(state.liveVisibleTextBlocks),
	].every(Boolean)
}

interface GlobalWithCompactStackState {
	[key: symbol]: unknown
}

export function processSharedStackState(): CompactRowStackState {
	const globalScope = globalThis as unknown as GlobalWithCompactStackState
	const current = globalScope[STACK_STATE_SYMBOL]
	if (isCompactRowStackState(current)) return current
	const state = createCompactRowStackState()
	globalScope[STACK_STATE_SYMBOL] = state
	return state
}
