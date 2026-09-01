import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import { createPiNotifyExtension } from '../extensions/pi-notify.ts'

import type {
	ChildProcessLike,
	NotificationEnvironment,
	NotificationOperations,
	NotificationPoster,
} from '../extensions/pi-notify.ts'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export const HELPER =
	'/Applications/Pi Notifications.app/Contents/MacOS/pi-notify'
export const NOTIFIER = '/opt/homebrew/bin/terminal-notifier'
export const HERDR = '/opt/homebrew/bin/herdr'
export const OPEN = '/usr/bin/open'
export const PKILL = '/usr/bin/pkill'
export const ENVIRONMENT: NotificationEnvironment = {
	HERDR_ENV: '1',
	HERDR_PANE_ID: 'pane-1',
	HERDR_SOCKET_PATH: '/tmp/herdr.sock',
}

export type SpawnCall = {
	command: string
	args: readonly string[]
	options: Record<string, unknown>
	child: FakeChild
}

class FakeChild extends EventEmitter {
	readonly stdout = new EventEmitter()
	unrefCalled = false

	unref(): void {
		this.unrefCalled = true
	}
}

export class FakeOperations implements NotificationOperations {
	readonly calls: SpawnCall[] = []
	readonly available = new Set<string>()
	throwOnSpawn = false

	exists(file: string): boolean {
		return this.available.has(file)
	}

	spawn(
		command: string,
		args: readonly string[],
		options: Record<string, unknown>,
	): ChildProcessLike {
		if (this.throwOnSpawn) throw new Error('synchronous spawn failure')
		const child = new FakeChild()
		this.calls.push({ command, args: [...args], options, child })
		return child as unknown as ChildProcessLike
	}
}

export function request(pane = 'pane-1', message = 'Ready') {
	return { pane, socket: `/tmp/${pane}.sock`, title: `Pi ${pane}`, message }
}

export async function flush(): Promise<void> {
	await new Promise<void>(resolve => setImmediate(resolve))
}

export function close(call: SpawnCall, code = 0): void {
	call.child.emit('close', code, null)
}

export type Handler = (event: unknown, context: unknown) => void

export function requiredHandler(
	handlers: Map<string, Handler>,
	name: string,
): Handler {
	const handler = handlers.get(name)
	assert.ok(handler, `missing ${name} handler`)
	return handler
}

export function loadExtension(
	environment = ENVIRONMENT,
	paneFocused: (
		socket: string,
		pane: string,
	) => Promise<boolean | undefined> = async () => false,
) {
	const operations = new FakeOperations()
	operations.available.add(HELPER)
	const notifications: Array<{
		pane: string
		socket: string
		title: string
		message: string
	}> = []
	const handlers = new Map<string, Handler>()
	const poster = {
		notify: (value: (typeof notifications)[number]) =>
			notifications.push(value),
	}
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
	}

	createPiNotifyExtension({
		environment,
		operations,
		poster: poster as unknown as NotificationPoster,
		paneFocused,
		processCwd: () => '/fallback/project',
	})(pi as unknown as ExtensionAPI)
	return { handlers, notifications, operations }
}
