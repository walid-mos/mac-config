import { sanitizeResultText } from './sanitize.ts'
import { isRecord } from './values.ts'

import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type {
	AssistantMessage,
	TextContent,
	ToolResultMessage,
	UserMessage,
} from '@earendil-works/pi-ai'
import type { SessionEntry } from '@earendil-works/pi-coding-agent'

const TRANSCRIPT_ENTRY_BUDGET = 30
const TRANSCRIPT_CHAR_BUDGET = 20_000
const TOOL_RESULT_CHAR_BUDGET = 4_000
const INTERNAL_GOAL_PROMPTS = ['Goal actif:', 'Goal toujours actif:']

export type TranscriptExcerpt = {
	text: string
	toolCallCount: number
}

export function collectTranscriptExcerpt(
	branch: readonly SessionEntry[],
): TranscriptExcerpt {
	const chunks: string[] = []
	for (const entry of branch.slice(-TRANSCRIPT_ENTRY_BUDGET)) {
		if (entry.type !== 'message') continue
		const chunk = transcriptChunk(entry.message)
		if (chunk) chunks.push(chunk)
	}
	return {
		text: clipTail(chunks.join('\n\n'), TRANSCRIPT_CHAR_BUDGET),
		toolCallCount: countCurrentTurnToolCalls(branch),
	}
}

export function countCurrentTurnToolCalls(
	branch: readonly SessionEntry[],
): number {
	let count = 0
	for (let index = branch.length - 1; index >= 0; index -= 1) {
		const entry = branch[index]
		if (!entry || entry.type !== 'message') continue
		if (isUserMessage(entry.message)) break
		count += countToolCalls(entry.message)
	}
	return count
}

function countToolCalls(message: AgentMessage): number {
	if (!isAssistantMessage(message)) return 0
	return message.content.filter(part => part.type === 'toolCall').length
}

function transcriptChunk(message: AgentMessage): string | undefined {
	if (isAssistantMessage(message)) {
		const text = assistantText(message)
		return text ? `ASSISTANT:\n${sanitizeResultText(text)}` : undefined
	}
	if (isToolResultMessage(message)) {
		const text = textParts(message.content)
			.map(part => part.text)
			.join('\n')
		return text
			? `TOOL ${sanitizeResultText(message.toolName)}:\n${clipTail(
					sanitizeResultText(text),
					TOOL_RESULT_CHAR_BUDGET,
				)}`
			: undefined
	}
	if (isUserMessage(message)) {
		const text = userText(message.content)
		if (text && !isInternalGoalPrompt(text))
			return `USER:\n${clipHead(sanitizeResultText(text), 400)}`
	}
	return undefined
}

function isInternalGoalPrompt(text: string): boolean {
	return INTERNAL_GOAL_PROMPTS.some(prefix => text.startsWith(prefix))
}

function clipHead(value: string, max: number): string {
	if (value.length <= max) return value
	let end = max
	const finalCodeUnit = value.charCodeAt(end - 1)
	if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) end -= 1
	return value.slice(0, end)
}

function clipTail(value: string, max: number): string {
	if (value.length <= max) return value
	let start = value.length - max
	const firstCodeUnit = value.charCodeAt(start)
	if (firstCodeUnit >= 0xdc00 && firstCodeUnit <= 0xdfff) start += 1
	return value.slice(start)
}

export function assistantText(message: AssistantMessage): string {
	return message.content
		.filter((part): part is TextContent => part.type === 'text')
		.map(part => part.text)
		.join('\n')
		.trim()
}

function textParts(content: ReadonlyArray<{ type: string }>): TextContent[] {
	return content.filter((part): part is TextContent => part.type === 'text')
}

function userText(content: unknown): string {
	if (typeof content === 'string') return content
	if (!Array.isArray(content)) return ''
	return content
		.filter(
			(part): part is TextContent =>
				isRecord(part) &&
				part.type === 'text' &&
				typeof part.text === 'string',
		)
		.map(part => part.text)
		.join('\n')
}

function isAssistantMessage(value: AgentMessage): value is AssistantMessage {
	return (
		isRecord(value) &&
		value.role === 'assistant' &&
		Array.isArray(value.content)
	)
}

function isToolResultMessage(value: AgentMessage): value is ToolResultMessage {
	return (
		isRecord(value) &&
		value.role === 'toolResult' &&
		typeof value.toolName === 'string' &&
		Array.isArray(value.content)
	)
}

function isUserMessage(value: AgentMessage): value is UserMessage {
	return isRecord(value) && value.role === 'user'
}
