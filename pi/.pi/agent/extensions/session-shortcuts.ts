import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

type InputEvent = {
	text: string
	source: 'interactive' | 'rpc' | 'extension'
}

export type QuitIntent = 'graceful' | 'force'

/** Parse Vim quit aliases only for text entered directly in the TUI. */
export function quitIntent(event: InputEvent): QuitIntent | undefined {
	if (event.source !== 'interactive') return undefined

	switch (event.text.trim()) {
		case ':q':
			return 'graceful'
		case ':q!':
			return 'force'
		default:
			return undefined
	}
}

/**
 * Handoff file for surviving session replacement: extension instances are
 * re-created on newSession(), so only serialized data crosses the boundary.
 */
function handoffFile(): string {
	return join(tmpdir(), `pi-clear-model-${process.pid}.json`)
}

export default function sessionShortcuts(pi: ExtensionAPI): void {
	pi.registerCommand('clear', {
		description: 'Start a new session (keeps current model)',
		handler: async (_args, ctx) => {
			const model = ctx.model
			if (model) {
				// Only plain data survives the session switch (docs: session
				// replacement lifecycle) - so persist provider/id/thinking.
				try {
					writeFileSync(
						handoffFile(),
						JSON.stringify({
							provider: model.provider,
							id: model.id,
							thinkingLevel: ctx.thinkingLevel,
						}),
					)
				} catch {
					// Best effort: fall back to default model on failure.
				}
			}
			await ctx.newSession()
		},
	})

	pi.on('session_start', (event, ctx) => {
		if (event.reason !== 'new') return
		try {
			const raw = readFileSync(handoffFile(), 'utf8')
			rmSync(handoffFile(), { force: true })
			const saved = JSON.parse(raw) as {
				provider: string
				id: string
				thinkingLevel?: string
			}
			const model = ctx.modelRegistry.find(saved.provider, saved.id)
			if (!model) return
			void pi.setModel(model).then(ok => {
				if (ok && saved.thinkingLevel) {
					pi.setThinkingLevel(
						saved.thinkingLevel as Parameters<
							typeof pi.setThinkingLevel
						>[0],
					)
				}
			})
		} catch {
			// No handoff (or unreadable): keep the default model.
		}
	})

	pi.on('input', (event, ctx) => {
		const intent = quitIntent(event)
		if (!intent) return { action: 'continue' }

		if (intent === 'force' && !ctx.isIdle()) ctx.abort()
		ctx.shutdown()
		return { action: 'handled' }
	})
}
