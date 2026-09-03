import { createHash } from 'node:crypto'

import { frameAssistantMarkdown, frameIntermediateMarkdown } from './frame.ts'
import { softenThinkingMarkdown } from './thinking.ts'

import type {
	ExtensionAPI,
	ExtensionUIContext,
	SessionEntry,
} from '@earendil-works/pi-coding-agent'

const textHash = (text: string): string =>
	createHash('sha256').update(text).digest('hex')

/**
 * Gives assistant prose a distinct reading surface without changing session
 * content. A final answer — one not followed by tool calls — opens with the
 * labelled accent trace; intermediate outputs between tool calls reduce to a
 * labelless muted trace. While a message is still streaming its kind is unknown,
 * so it keeps the quiet treatment until completion reveals it.
 */
export default function responseView(pi: ExtensionAPI): void {
	let ui: ExtensionUIContext | undefined
	let finalHashes = new Set<string>()

	const isFinalAnswer = (markdown: string): boolean =>
		finalHashes.has(textHash(markdown))

	const rememberMessage = (message: {
		content: { type: string; text?: string }[]
	}): void => {
		const intermediate = message.content.some(
			block => block.type === 'toolCall',
		)
		if (intermediate) return
		for (const block of message.content) {
			if (block.type === 'text' && block.text?.trim()) {
				finalHashes.add(textHash(block.text.trim()))
			}
		}
	}

	const hydrateFinalHashes = (entries: readonly SessionEntry[]): void => {
		finalHashes = new Set()
		for (const entry of entries) {
			if (
				entry.type === 'message' &&
				entry.message.role === 'assistant'
			) {
				rememberMessage(entry.message)
			}
		}
	}

	pi.on('session_start', (_event, context) => {
		ui = context.ui
		hydrateFinalHashes(context.sessionManager.getBranch())
	})

	pi.on('message_end', event => {
		if (event.message.role !== 'assistant') return
		rememberMessage(event.message)
	})

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType === 'assistant-thinking') {
			return softenThinkingMarkdown(markdown)
		}
		if (context.messageType !== 'assistant') return markdown
		if (!ui)
			throw new Error('response-view requires an active Pi UI session')
		const options = { width: context.availableWidth, theme: ui.theme }
		if (context.isStreaming || !isFinalAnswer(markdown)) {
			return frameIntermediateMarkdown(markdown, options)
		}
		return frameAssistantMarkdown(markdown, options)
	})

	pi.on('session_shutdown', () => {
		ui = undefined
		finalHashes = new Set()
	})
}
