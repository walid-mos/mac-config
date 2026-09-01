import type { CompactRowStackState } from './stack-state.ts'

interface ToolCallBlock {
	type: 'toolCall'
	id: string
	name: string
}

interface TextBlock {
	type: 'text'
	text?: string
}

type MessageBlock =
	| ToolCallBlock
	| TextBlock
	| { type: string; [key: string]: unknown }

export interface StackMessage {
	role: string
	content?: ReadonlyArray<MessageBlock> | string
}

export function resetStackTranscript(state: CompactRowStackState): void {
	state.groupById.clear()
	state.activeGroup = undefined
	state.seenCallIds.clear()
	state.liveAssistant = false
	state.liveVisibleTextBlocks = 0
}

export function rebuildStackTranscript(
	state: CompactRowStackState,
	messages: ReadonlyArray<StackMessage>,
): void {
	resetStackTranscript(state)
	for (const message of messages) consumeRestoredMessage(state, message)
}

export function beginStackMessage(
	state: CompactRowStackState,
	message: StackMessage,
): void {
	if (message.role === 'user') {
		breakGroup(state)
		state.liveAssistant = false
		return
	}
	if (message.role !== 'assistant') return
	state.liveAssistant = true
	state.liveVisibleTextBlocks = 0
	consumeLiveAssistant(state, message)
}

export function updateStackMessage(
	state: CompactRowStackState,
	message: StackMessage,
): void {
	if (message.role !== 'assistant') return
	if (!state.liveAssistant) {
		state.liveAssistant = true
		state.liveVisibleTextBlocks = 0
	}
	consumeLiveAssistant(state, message)
}

export function endStackMessage(
	state: CompactRowStackState,
	message: StackMessage,
): void {
	if (message.role === 'assistant') updateStackMessage(state, message)
	if (message.role === 'user') breakGroup(state)
	state.liveAssistant = false
}

export function uniqueStackGroups(state: CompactRowStackState): string[][] {
	const groups: string[][] = []
	const seen = new Set<string[]>()
	for (const group of state.groupById.values()) {
		if (seen.has(group)) continue
		seen.add(group)
		groups.push(Array.from(group))
	}
	return groups
}

function consumeRestoredMessage(
	state: CompactRowStackState,
	message: StackMessage,
): void {
	if (message.role === 'user') {
		breakGroup(state)
		return
	}
	if (message.role !== 'assistant') return
	for (const block of contentBlocks(message)) {
		if (isVisibleText(block)) {
			breakGroup(state)
			continue
		}
		consumeToolBlock(state, block)
	}
}

function consumeLiveAssistant(
	state: CompactRowStackState,
	message: StackMessage,
): void {
	let visibleTextBlocks = 0
	for (const block of contentBlocks(message)) {
		if (isVisibleText(block)) {
			visibleTextBlocks += 1
			if (visibleTextBlocks > state.liveVisibleTextBlocks)
				breakGroup(state)
			continue
		}
		consumeToolBlock(state, block)
	}
	state.liveVisibleTextBlocks = Math.max(
		state.liveVisibleTextBlocks,
		visibleTextBlocks,
	)
}

function consumeToolBlock(
	state: CompactRowStackState,
	block: MessageBlock,
): void {
	if (!isToolCall(block) || state.seenCallIds.has(block.id)) return
	state.seenCallIds.add(block.id)
	if (!state.stackableTools.has(block.name)) {
		breakGroup(state)
		return
	}
	const group = state.activeGroup ?? []
	if (!state.activeGroup) state.activeGroup = group
	group.push(block.id)
	state.groupById.set(block.id, group)
	for (const memberId of group) state.entries.get(memberId)?.invalidate()
}

function breakGroup(state: CompactRowStackState): void {
	state.activeGroup = undefined
}

function contentBlocks(message: StackMessage): ReadonlyArray<MessageBlock> {
	return Array.isArray(message.content) ? message.content : []
}

function isVisibleText(block: MessageBlock): block is TextBlock {
	return (
		block.type === 'text' &&
		typeof block.text === 'string' &&
		block.text.trim().length > 0
	)
}

function isToolCall(block: MessageBlock): block is ToolCallBlock {
	return (
		block.type === 'toolCall' &&
		typeof block.id === 'string' &&
		typeof block.name === 'string'
	)
}
