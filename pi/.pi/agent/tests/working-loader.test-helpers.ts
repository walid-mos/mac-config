import assert from 'node:assert/strict'

import workingLoader from '../extensions/working-loader/index.ts'
import { SAND_SPINNER } from '../extensions/working-loader/spinner.ts'

import type { IntervalScheduler } from '../extensions/working-loader/rotation.ts'

type Fn = (...args: never[]) => unknown

export function fakeScheduler() {
	const timers: Array<{ tick: Fn; delayMs: number; cleared: boolean }> = []
	const scheduler: IntervalScheduler = {
		setInterval(tick: Fn, delayMs: number) {
			const timer = { tick, delayMs, cleared: false }
			timers.push(timer)
			return {
				clear: () => {
					timer.cleared = true
				},
			}
		},
	}
	const fireAll = () => {
		for (const timer of timers) if (!timer.cleared) timer.tick()
	}
	return { scheduler, timers, fireAll }
}

export function fakeTheme() {
	return { fg: (_role: string, text: string) => text }
}

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g

export function stripAnsi(text: string): string {
	return text.replace(ANSI_PATTERN, '')
}

export function assertSandLoaderPrefix(line: string): void {
	assert.ok(
		SAND_SPINNER.frames.some(frame => line.startsWith(`${frame} `)),
		`expected a sand frame at the start of ${JSON.stringify(line)}`,
	)
	assert.match(line, /^. \w+\.\.\./u)
}

type StreamPayload = {
	assistantMessageEvent?: { type: string; delta?: string }
}
type Handler = (
	event: { toolName?: string } & StreamPayload,
	ctx: { ui: unknown },
) => Promise<void> | void

export function harness(uiOverrides: Partial<Record<string, Fn>> = {}) {
	const handlers = new Map<string, Handler>()
	const calls: string[] = []
	const ui = {
		setWidget: () => {},
		requestRender: () => {},
		setWorkingVisible: (visible: boolean) =>
			calls.push(`workingVisible:${String(visible)}`),
		setHiddenThinkingLabel: (label?: string) =>
			calls.push(`thinkingLabel:${String(label)}`),
		get theme() {
			return fakeTheme()
		},
		...uiOverrides,
	}
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
	}
	;(workingLoader as unknown as (api: unknown) => void)(pi)
	const emit = (event: string, toolName?: string, payload?: StreamPayload) =>
		handlers.get(event)?.({ toolName, ...payload }, { ui })
	return { emit, calls, ui }
}
