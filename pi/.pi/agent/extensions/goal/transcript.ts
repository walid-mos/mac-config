import { MAX_EVALUATOR_REASON_CHARS } from './contracts.ts'
import {
	GOAL_CONTINUE_PROMPT_PREFIX,
	GOAL_KICKOFF_PROMPT_PREFIX,
} from './presentation.ts'
import {
	isRecord,
	normalizeBoundedText,
	sanitizeEvaluatorText,
} from './values.ts'

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
const USER_TEXT_CHAR_BUDGET = 800
const ASSISTANT_TEXT_CHAR_BUDGET = 4_000
const TOOL_CALL_CHAR_BUDGET = 2_000
const TOOL_RESULT_CHAR_BUDGET = 4_000
const INTERNAL_GOAL_PROMPTS = [
	GOAL_KICKOFF_PROMPT_PREFIX,
	GOAL_CONTINUE_PROMPT_PREFIX,
]
const EXPANDED_GOAL_PROMPT = /^<skill\s+name=(?:"goal"|'goal')(?:\s|>)/u
const CONTENT_OMISSION = '\n… [content omitted] …\n'
const EVIDENCE_OMISSION = '\n… [evidence omitted] …\n'

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
		text: clipEvidence(chunks.join('\n\n'), TRANSCRIPT_CHAR_BUDGET),
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
	if (isAssistantMessage(message)) return assistantTranscriptChunk(message)
	if (isToolResultMessage(message)) return toolResultTranscriptChunk(message)
	if (!isUserMessage(message)) return undefined
	const text = userText(message.content)
	return text && !isInternalGoalPrompt(text)
		? `USER:\n${boundedSanitizedEvidence(text, 400)}`
		: undefined
}

function assistantTranscriptChunk(
	message: AssistantMessage,
): string | undefined {
	const chunks: string[] = []
	const text = boundedTextParts(message.content, ASSISTANT_TEXT_CHAR_BUDGET)
	if (text) chunks.push(`ASSISTANT:\n${text.trim()}`)
	for (const part of message.content) {
		if (part.type !== 'toolCall') continue
		const identity = `${sanitizeEvaluatorText(part.name)} (${sanitizeEvaluatorText(part.id)})`
		chunks.push(
			`TOOL CALL ${identity}:\n${boundedSanitizedEvidence(
				serializeToolArguments(part.arguments),
				TOOL_CALL_CHAR_BUDGET,
			)}`,
		)
	}
	return chunks.join('\n') || undefined
}

function toolResultTranscriptChunk(message: ToolResultMessage): string {
	const text = boundedTextParts(message.content, TOOL_RESULT_CHAR_BUDGET)
	const identity = `${sanitizeEvaluatorText(message.toolName)} (${sanitizeEvaluatorText(message.toolCallId)})`
	const status = message.isError ? 'ERROR' : 'OK'
	const output = text || '(empty output)'
	return `TOOL RESULT ${status} ${identity}:\n${output}`
}

function isInternalGoalPrompt(text: string): boolean {
	return (
		EXPANDED_GOAL_PROMPT.test(text) ||
		INTERNAL_GOAL_PROMPTS.some(prefix => text.startsWith(prefix))
	)
}

function boundedTextParts(
	content: ReadonlyArray<{ type: string }>,
	max: number,
): string {
	const parts = textParts(content)
	if (parts.length === 0) return ''
	if (parts.length === 1)
		return boundedSanitizedEvidence(parts[0]?.text ?? '', max)
	const joinedLength = parts.reduce(
		(total, part) => total + part.text.length,
		parts.length - 1,
	)
	if (joinedLength <= max)
		return sanitizeEvaluatorText(parts.map(part => part.text).join('\n'))
	const available = Math.max(0, max - CONTENT_OMISSION.length)
	const first = sanitizeEvaluatorText(parts[0]?.text ?? '')
	const last = sanitizeEvaluatorText(parts.at(-1)?.text ?? '')
	let headLength = Math.min(first.length, Math.ceil(available / 2))
	const tailLength = Math.min(last.length, available - headLength)
	headLength = Math.min(first.length, available - tailLength)
	const bounded = `${clipHead(first, headLength)}${CONTENT_OMISSION}${clipTail(
		last,
		tailLength,
	)}`
	return sanitizeEvaluatorText(bounded)
}

function boundedSanitizedEvidence(value: string, max: number): string {
	return clipEvidence(sanitizeEvaluatorText(value), max)
}

function serializeToolArguments(value: unknown): string {
	try {
		return JSON.stringify(value) ?? '{}'
	} catch {
		return '[unserializable arguments]'
	}
}

function clipEvidence(value: string, max: number): string {
	if (value.length <= max) return value
	const available = Math.max(0, max - EVIDENCE_OMISSION.length)
	const headLength = Math.ceil(available / 2)
	return `${clipHead(value, headLength)}${EVIDENCE_OMISSION}${clipTail(
		value,
		available - headLength,
	)}`
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

export function settledTurnFailure(
	branch: readonly SessionEntry[],
): string | undefined {
	for (let index = branch.length - 1; index >= 0; index -= 1) {
		const entry = branch[index]
		if (entry?.type !== 'message' || !isAssistantMessage(entry.message))
			continue
		if (
			entry.message.stopReason === 'stop' ||
			entry.message.stopReason === undefined
		)
			return undefined
		const reason =
			typeof entry.message.errorMessage === 'string'
				? entry.message.errorMessage
				: `assistant stopped with ${entry.message.stopReason ?? 'unknown status'}`
		return normalizeBoundedText(
			`Goal paused after assistant failure: ${reason}`,
			MAX_EVALUATOR_REASON_CHARS,
		)
	}
	return undefined
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
	const text = content.filter(
		(part): part is TextContent =>
			isRecord(part) &&
			part.type === 'text' &&
			typeof part.text === 'string',
	)
	return boundedTextParts(text, USER_TEXT_CHAR_BUDGET)
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
