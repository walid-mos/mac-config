import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import sessionShortcuts, {
	quitIntent,
} from '../extensions/session-shortcuts.ts'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

function handoffFile(): string {
	return join(tmpdir(), `pi-clear-model-${process.pid}.json`)
}

type CommandDefinition = {
	description: string
	handler: (
		args: string,
		ctx: {
			model?: { provider: string; id: string }
			thinkingLevel?: string
			newSession: () => Promise<unknown>
		},
	) => Promise<void>
}

type SessionStartHandler = (
	event: { reason: string },
	ctx: { modelRegistry: { find: (provider: string, id: string) => unknown } },
) => Promise<void>

type InputHandler = (
	event: { text: string; source: 'interactive' | 'rpc' | 'extension' },
	ctx: { isIdle: () => boolean; abort: () => void; shutdown: () => void },
) => { action: 'continue' | 'handled' }

function loadExtension(): {
	command: CommandDefinition
	input: InputHandler
	sessionStart: SessionStartHandler | undefined
	setModelCalls: unknown[]
	thinkingLevels: unknown[]
} {
	let command: CommandDefinition | undefined
	let input: InputHandler | undefined
	let sessionStart: SessionStartHandler | undefined
	const setModelCalls: unknown[] = []
	const thinkingLevels: unknown[] = []

	const pi = {
		registerCommand(name: string, definition: CommandDefinition) {
			assert.equal(name, 'clear')
			command = definition
		},
		on(event: string, handler: InputHandler | SessionStartHandler) {
			if (event === 'input') input = handler as InputHandler
			if (event === 'session_start')
				sessionStart = handler as SessionStartHandler
		},
		async setModel(model: unknown) {
			setModelCalls.push(model)
			return true
		},
		setThinkingLevel(level: unknown) {
			thinkingLevels.push(level)
		},
	}

	sessionShortcuts(pi as unknown as ExtensionAPI)
	assert.ok(command)
	assert.ok(input)
	return { command, input, sessionStart, setModelCalls, thinkingLevels }
}

test('recognizes Vim quit aliases only for interactive input', () => {
	assert.equal(
		quitIntent({ text: ' :q ', source: 'interactive' }),
		'graceful',
	)
	assert.equal(quitIntent({ text: ':q!', source: 'interactive' }), 'force')
	assert.equal(
		quitIntent({ text: ':quit', source: 'interactive' }),
		undefined,
	)
	assert.equal(quitIntent({ text: ':q', source: 'rpc' }), undefined)
	assert.equal(quitIntent({ text: ':q', source: 'extension' }), undefined)
})

test('registers /clear as a new-session command', async () => {
	const { command } = loadExtension()
	let calls = 0

	await command.handler('', {
		newSession: async () => {
			calls += 1
			return { cancelled: false }
		},
	})

	assert.equal(
		command.description,
		'Start a new session (keeps current model)',
	)
	assert.equal(calls, 1)
})

test('/clear writes a model handoff for the replacement session', async () => {
	const { command } = loadExtension()
	let calls = 0

	await command.handler('', {
		model: { provider: 'anthropic', id: 'claude-test' },
		thinkingLevel: 'high',
		newSession: async () => {
			calls += 1
			return { cancelled: false }
		},
	})

	try {
		assert.deepEqual(JSON.parse(readFileSync(handoffFile(), 'utf8')), {
			provider: 'anthropic',
			id: 'claude-test',
			thinkingLevel: 'high',
		})
		assert.equal(calls, 1)
	} finally {
		rmSync(handoffFile(), { force: true })
	}
})

test('session_start restores the handed-off model', async () => {
	const { sessionStart, setModelCalls, thinkingLevels } = loadExtension()
	assert.ok(sessionStart)

	writeFileSync(
		handoffFile(),
		JSON.stringify({
			provider: 'anthropic',
			id: 'claude-test',
			thinkingLevel: 'high',
		}),
	)

	try {
		await sessionStart(
			{ reason: 'new' },
			{ modelRegistry: { find: (provider, id) => ({ provider, id }) } },
		)
		await new Promise(resolve => setTimeout(resolve, 0)) // flush le .then du setModel

		assert.deepEqual(setModelCalls, [
			{ provider: 'anthropic', id: 'claude-test' },
		])
		assert.deepEqual(thinkingLevels, ['high'])
		assert.equal(existsSync(handoffFile()), false) // handoff consommé
	} finally {
		rmSync(handoffFile(), { force: true })
	}
})

test('session_start keeps the default model without a handoff', async () => {
	const { sessionStart, setModelCalls } = loadExtension()
	assert.ok(sessionStart)

	await sessionStart(
		{ reason: 'new' },
		{ modelRegistry: { find: () => undefined } },
	)
	await new Promise(resolve => setTimeout(resolve, 0))

	assert.deepEqual(setModelCalls, [])
})

test('session_start ignores non-new reasons', async () => {
	const { sessionStart, setModelCalls } = loadExtension()
	assert.ok(sessionStart)

	writeFileSync(
		handoffFile(),
		JSON.stringify({ provider: 'anthropic', id: 'claude-test' }),
	)

	try {
		await sessionStart(
			{ reason: 'resume' },
			{
				modelRegistry: {
					find: () => ({ provider: 'anthropic', id: 'claude-test' }),
				},
			},
		)

		assert.deepEqual(setModelCalls, [])
		assert.equal(existsSync(handoffFile()), true) // handoff intact
	} finally {
		rmSync(handoffFile(), { force: true })
	}
})

test(':q requests a graceful shutdown without aborting active work', () => {
	const { input } = loadExtension()
	let aborted = false
	let shutdown = false

	const result = input(
		{ text: ':q', source: 'interactive' },
		{
			isIdle: () => false,
			abort: () => {
				aborted = true
			},
			shutdown: () => {
				shutdown = true
			},
		},
	)

	assert.deepEqual(result, { action: 'handled' })
	assert.equal(aborted, false)
	assert.equal(shutdown, true)
})

test(':q! aborts active work before requesting shutdown', () => {
	const { input } = loadExtension()
	const calls: string[] = []

	const result = input(
		{ text: ':q!', source: 'interactive' },
		{
			isIdle: () => false,
			abort: () => calls.push('abort'),
			shutdown: () => calls.push('shutdown'),
		},
	)

	assert.deepEqual(result, { action: 'handled' })
	assert.deepEqual(calls, ['abort', 'shutdown'])
})

test('unrelated input passes through untouched', () => {
	const { input } = loadExtension()
	const result = input(
		{ text: 'hello', source: 'interactive' },
		{
			isIdle: () => true,
			abort: () => assert.fail('must not abort'),
			shutdown: () => assert.fail('must not shutdown'),
		},
	)

	assert.deepEqual(result, { action: 'continue' })
})
