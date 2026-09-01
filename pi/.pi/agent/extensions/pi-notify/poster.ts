import {
	defaultNotificationOperations,
	detachedOptions,
	runBestEffort,
} from './process.ts'

import type { NotificationOperations, ProcessResult } from './process.ts'

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
	operations: NotificationOperations = defaultNotificationOperations,
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

	constructor(
		operations: NotificationOperations = defaultNotificationOperations,
	) {
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
