import path from 'node:path'

import { createFocusProbe } from './focus.ts'
import { NotificationPoster, notificationEnabled } from './poster.ts'
import { defaultNotificationOperations } from './process.ts'

import type { NotificationEnvironment } from './poster.ts'
import type { NotificationOperations } from './process.ts'
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

export function extractFinalSnippet(message: unknown): string {
	const candidate = message as
		| { role?: string; content?: unknown }
		| undefined
	if (candidate?.role !== 'assistant' || !Array.isArray(candidate.content))
		return ''
	return candidate.content
		.filter((part): part is { type: 'text'; text: string } => {
			const value = part as { type?: string; text?: unknown } | undefined
			return value?.type === 'text' && typeof value.text === 'string'
		})
		.map(part => part.text.trim())
		.filter(Boolean)
		.join(' ')
		.replace(/\s+/g, ' ')
		.slice(0, 160)
}

type ExtensionDependencies = {
	environment: NotificationEnvironment
	operations: NotificationOperations
	poster: NotificationPoster
	paneFocused(socket: string, pane: string): Promise<boolean | undefined>
	processCwd(): string
}

export function createPiNotifyExtension(
	overrides: Partial<ExtensionDependencies> = {},
): (pi: ExtensionAPI) => void {
	const operations = overrides.operations ?? defaultNotificationOperations
	const environment = overrides.environment ?? process.env
	const poster = overrides.poster ?? new NotificationPoster(operations)
	const paneFocused = overrides.paneFocused ?? createFocusProbe(operations)
	const processCwd = overrides.processCwd ?? process.cwd

	return function registerPiNotify(pi: ExtensionAPI) {
		if (!notificationEnabled(environment, operations)) return

		const pane = environment.HERDR_PANE_ID!
		const socket = environment.HERDR_SOCKET_PATH!
		let running = false
		let lastSnippet = ''
		let notificationGeneration = 0

		const cwdName = (ctx: ExtensionContext): string => {
			const cwd =
				typeof ctx?.cwd === 'string' && ctx.cwd ? ctx.cwd : processCwd()
			return path.basename(cwd)
		}
		const notify = (title: string, message: string): void => {
			try {
				poster.notify({ pane, socket, title, message })
			} catch {
				// Best-effort : silencieux, y compris pour une opération injectée défaillante.
			}
		}
		// Pas de notification quand l'utilisateur regarde déjà cette pane : une
		// sonde échouée (undefined) laisse passer, par contrat best-effort.
		const notifyIfPaneInBackground = (
			title: string,
			message: string,
		): void => {
			const generation = ++notificationGeneration
			void notifyAfterFocusProbe(generation, title, message)
		}
		const notifyAfterFocusProbe = async (
			generation: number,
			title: string,
			message: string,
		): Promise<void> => {
			const focused = await paneFocused(socket, pane).catch(
				() => undefined,
			)
			if (generation !== notificationGeneration || focused === true)
				return
			notify(title, message)
		}

		pi.on('message_end', function onMessageEnd(event) {
			const snippet = extractFinalSnippet(event?.message)
			if (snippet) lastSnippet = snippet
		})

		pi.on('agent_start', function onAgentStart(_event, ctx) {
			if (ctx?.mode !== 'tui') return
			notificationGeneration += 1
			running = true
			lastSnippet = ''
		})

		pi.on('agent_settled', function onAgentSettled(_event, ctx) {
			if (ctx?.mode !== 'tui' || ctx?.isIdle?.() !== true || !running)
				return
			running = false
			notifyIfPaneInBackground(
				`Pi · ${cwdName(ctx)} — terminé`,
				lastSnippet || 'Prêt pour la suite',
			)
		})

		pi.on(
			'tool_execution_start',
			function onToolExecutionStart(event, ctx) {
				if (
					ctx?.mode !== 'tui' ||
					event?.toolName !== 'ask_user_question'
				)
					return
				notifyIfPaneInBackground(
					`Pi · ${cwdName(ctx)} — décision requise`,
					'Une question attend ton choix',
				)
			},
		)
	}
}
