import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process'
import { existsSync } from 'node:fs'

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

export type ProcessResult =
	| { outcome: 'started' }
	| { outcome: 'closed'; code: number | null }
	| { outcome: 'failed' }

export const defaultNotificationOperations: NotificationOperations = {
	exists: existsSync,
	spawn(command, args, options) {
		return nodeSpawn(command, [...args], options)
	},
}

export function runBestEffort(
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
			if (waitForClose)
				child.once('close', code => finish({ outcome: 'closed', code }))
			if (options.detached) child.unref?.()
			if (!waitForClose) finish({ outcome: 'started' })
		} catch {
			finish({ outcome: 'failed' })
		}
	})
}

export function runCollecting(
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

export function detachedOptions(): SpawnOptions {
	return { detached: true, stdio: 'ignore' }
}
