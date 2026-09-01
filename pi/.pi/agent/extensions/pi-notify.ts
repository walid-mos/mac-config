// Notifications desktop propres pour Pi sous Herdr.
//
// Herdr continue de remonter l'état des agents pour les panes, mais ses toasts
// sont coupés. Cette extension est l'unique canal desktop : fin de tâche et
// décision requise, avec clic vers la pane Herdr émettrice.
//
// Best-effort absolu : aucune erreur de notification ne doit remonter dans Pi.

import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'

const HELPER = '/Applications/Pi Notifications.app/Contents/MacOS/pi-notify'
const NOTIFIER = '/opt/homebrew/bin/terminal-notifier'
const HERDR = '/opt/homebrew/bin/herdr'
const OPEN = '/usr/bin/open'
const PKILL = '/usr/bin/pkill'

export type NotificationEnvironment = {
	HERDR_ENV?: string
	HERDR_PANE_ID?: string
	HERDR_SOCKET_PATH?: string
}

export type ChildProcessLike = {
	on(event: 'error', listener: (error: Error) => void): ChildProcessLike
	once(
		event: 'close',
		listener: (code: number | null, signal: NodeJS.Signals | null) => void,
	): ChildProcessLike
	stdout?: {
		on(event: 'data', listener: (chunk: Buffer | string) => void): unknown
	}
	kill?(): boolean
	unref?(): void
}

export type NotificationOperations = {
	exists(file: string): boolean
	spawn(
		command: string,
		args: readonly string[],
		options: SpawnOptions,
	): ChildProcessLike
}

type ProcessResult =
	| { outcome: 'started' }
	| { outcome: 'closed'; code: number | null }
	| { outcome: 'failed' }

type NotificationRequest = {
	pane: string
	socket: string
	title: string
	message: string
}

type PaneQueue = {
	generation: number
	tail: Promise<void>
}

const defaultOperations: NotificationOperations = {
	exists: existsSync,
	spawn(command, args, options) {
		return nodeSpawn(command, [...args], options)
	},
}

function runBestEffort(
	operations: NotificationOperations,
	command: string,
	args: readonly string[],
	options: SpawnOptions,
	waitForClose: boolean,
): Promise<ProcessResult> {
	return new Promise(function executeProcess(resolve) {
		let settled = false
		const finish = (result: ProcessResult) => {
			if (settled) return
			settled = true
			resolve(result)
		}

		try {
			const child = operations.spawn(command, args, options)
			// Keep a permanent listener: even a surprising second `error` event must
			// remain harmless after the launch promise has already settled.
			child.on('error', () => finish({ outcome: 'failed' }))
			if (waitForClose) {
				child.once('close', code => finish({ outcome: 'closed', code }))
			}
			if (options.detached) child.unref?.()
			if (!waitForClose) finish({ outcome: 'started' })
		} catch {
			finish({ outcome: 'failed' })
		}
	})
}

function detachedOptions(): SpawnOptions {
	return { detached: true, stdio: 'ignore' }
}

/**
 * Sonde best-effort de l'état de focalisation Herdr : `true` (pane focalisée,
 * l'utilisateur la regarde déjà), `false` (pane en arrière-plan) ou
 * `undefined` (sonde indisponible — échec, sortie illisible, timeout).
 * `undefined` laisse passer la notification : rater une fin de tâche est pire
 * qu'un doublon rare.
 */
export function createFocusProbe(
	operations: NotificationOperations,
	timeoutMs = 1_500,
): (socket: string, pane: string) => Promise<boolean | undefined> {
	return async function probe(
		socket: string,
		pane: string,
	): Promise<boolean | undefined> {
		const stdout = await runCollecting(
			operations,
			HERDR,
			['agent', 'get', pane],
			{
				env: { ...process.env, HERDR_SOCKET_PATH: socket },
				timeout: timeoutMs,
			},
			timeoutMs,
		)
		try {
			const parsed = JSON.parse(stdout ?? '') as {
				result?: { agent?: { focused?: unknown } }
			}
			const focused = parsed.result?.agent?.focused
			return typeof focused === 'boolean' ? focused : undefined
		} catch {
			return undefined
		}
	}
}

function runCollecting(
	operations: NotificationOperations,
	command: string,
	args: readonly string[],
	options: SpawnOptions,
	timeoutMs: number,
): Promise<string | undefined> {
	return new Promise(function collectProcess(resolve) {
		let settled = false
		let stdout = ''
		const finish = () => {
			if (settled) return
			settled = true
			resolve(stdout)
		}

		try {
			const child = operations.spawn(command, args, options)
			child.on('error', () => finish())
			child.stdout?.on('data', (chunk: Buffer | string) => {
				stdout +=
					typeof chunk === 'string' ? chunk : chunk.toString('utf8')
			})
			child.once('close', () => finish())
			setTimeout(() => {
				child.kill?.()
				finish()
			}, timeoutMs).unref?.()
		} catch {
			finish()
		}
	})
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`
}

function regexQuote(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fallbackFocusCommand(request: NotificationRequest): string {
	return [
		'open -a Ghostty',
		'sleep 0.2',
		`HERDR_SOCKET_PATH=${shellQuote(request.socket)} ${HERDR} agent focus ${shellQuote(request.pane)}`,
	].join('; ')
}

function commonArguments(request: NotificationRequest): string[] {
	return [
		'-title',
		request.title,
		'-subtitle',
		`pane ${request.pane}`,
		'-message',
		request.message,
	]
}

export function notificationEnabled(
	environment: NotificationEnvironment,
	operations: NotificationOperations = defaultOperations,
): boolean {
	const hasHerdrContext =
		environment.HERDR_ENV === '1' &&
		Boolean(environment.HERDR_PANE_ID) &&
		Boolean(environment.HERDR_SOCKET_PATH)
	return (
		hasHerdrContext &&
		(operations.exists(HELPER) || operations.exists(NOTIFIER))
	)
}

export class NotificationPoster {
	private readonly queues = new Map<string, PaneQueue>()
	private readonly operations: NotificationOperations

	constructor(operations: NotificationOperations = defaultOperations) {
		this.operations = operations
	}

	notify(request: NotificationRequest): void {
		if (this.operations.exists(HELPER)) {
			this.replaceNative(request)
			return
		}
		if (this.operations.exists(NOTIFIER)) this.postFallback(request)
	}

	waitForIdle(pane: string): Promise<void> {
		return this.queues.get(pane)?.tail ?? Promise.resolve()
	}

	private replaceNative(request: NotificationRequest): void {
		const queue = this.queues.get(request.pane) ?? {
			generation: 0,
			tail: Promise.resolve(),
		}
		const generation = queue.generation + 1
		queue.generation = generation
		queue.tail = queue.tail
			.then(() => this.runNativeReplacement(request, queue, generation))
			.catch(() => undefined)
		this.queues.set(request.pane, queue)
	}

	private async runNativeReplacement(
		request: NotificationRequest,
		queue: PaneQueue,
		generation: number,
	): Promise<void> {
		if (queue.generation !== generation) return
		const stopped = await runBestEffort(
			this.operations,
			PKILL,
			['-f', `MacOS/pi-notify .*-pane ${regexQuote(request.pane)}( |$)`],
			{ stdio: 'ignore', timeout: 750 },
			true,
		)
		if (queue.generation !== generation || !this.canLaunchAfter(stopped))
			return

		await runBestEffort(
			this.operations,
			OPEN,
			[
				'-n',
				'/Applications/Pi Notifications.app',
				'--args',
				...commonArguments(request),
				'-pane',
				request.pane,
				'-socket',
				request.socket,
			],
			{ ...detachedOptions(), timeout: 2_000 },
			true,
		)
	}

	private canLaunchAfter(result: ProcessResult): boolean {
		return (
			result.outcome === 'closed' &&
			(result.code === 0 || result.code === 1)
		)
	}

	private postFallback(request: NotificationRequest): void {
		void runBestEffort(
			this.operations,
			NOTIFIER,
			[
				...commonArguments(request),
				'-group',
				`pi-${request.pane}`,
				'-execute',
				fallbackFocusCommand(request),
			],
			detachedOptions(),
			false,
		)
	}
}

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
	const operations = overrides.operations ?? defaultOperations
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

export default createPiNotifyExtension()
