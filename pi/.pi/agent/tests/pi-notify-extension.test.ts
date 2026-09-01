import assert from 'node:assert/strict'
import test from 'node:test'

import { extractFinalSnippet } from '../extensions/pi-notify.ts'

import {
	ENVIRONMENT,
	flush,
	loadExtension,
	requiredHandler,
} from './pi-notify.test-helpers.ts'

test('disabled extension registers no handlers', () => {
	const { handlers, operations } = loadExtension({
		...ENVIRONMENT,
		HERDR_ENV: '0',
	})
	operations.available.clear()
	assert.equal(handlers.size, 0)
})

test('agent completion notifies exactly once with the final snippet', async () => {
	const { handlers, notifications } = loadExtension()
	requiredHandler(handlers, 'agent_start')({}, { mode: 'tui' })
	requiredHandler(handlers, 'message_end')(
		{
			message: {
				role: 'assistant',
				content: [{ type: 'text', text: '  Work\n complete  ' }],
			},
		},
		{},
	)
	const context = { mode: 'tui', cwd: '/work/repository', isIdle: () => true }
	const settled = requiredHandler(handlers, 'agent_settled')
	settled({}, context)
	settled({}, context)
	await flush()

	assert.deepEqual(notifications, [
		{
			pane: 'pane-1',
			socket: '/tmp/herdr.sock',
			title: 'Pi · repository — terminé',
			message: 'Work complete',
		},
	])
})

test('a new run invalidates an older completion probe', async () => {
	const probes: Array<(focused: boolean | undefined) => void> = []
	const { handlers, notifications } = loadExtension(
		ENVIRONMENT,
		() => new Promise(resolve => probes.push(resolve)),
	)
	const start = requiredHandler(handlers, 'agent_start')
	const settled = requiredHandler(handlers, 'agent_settled')
	const context = { mode: 'tui', cwd: '/work/repository', isIdle: () => true }

	start({}, context)
	settled({}, context)
	assert.equal(probes.length, 1)
	start({}, context)
	probes[0]?.(false)
	await flush()
	assert.deepEqual(notifications, [])

	settled({}, context)
	assert.equal(probes.length, 2)
	probes[1]?.(false)
	await flush()
	assert.equal(notifications.length, 1)
})

test('completion stays silent when the pane is already focused', async () => {
	const { handlers, notifications } = loadExtension(
		ENVIRONMENT,
		async () => true,
	)
	requiredHandler(handlers, 'agent_start')({}, { mode: 'tui' })
	const context = { mode: 'tui', cwd: '/work/repository', isIdle: () => true }
	requiredHandler(handlers, 'agent_settled')({}, context)
	await flush()

	assert.deepEqual(notifications, [])
})

test('a failed focus probe still notifies', async () => {
	const { handlers, notifications } = loadExtension(
		ENVIRONMENT,
		async () => undefined,
	)
	requiredHandler(handlers, 'agent_start')({}, { mode: 'tui' })
	const context = { mode: 'tui', cwd: '/work/repository', isIdle: () => true }
	requiredHandler(handlers, 'agent_settled')({}, context)
	await flush()

	assert.equal(notifications.length, 1)
})

test('ask_user_question emits the decision notification', async () => {
	const { handlers, notifications } = loadExtension()
	requiredHandler(handlers, 'tool_execution_start')(
		{ toolName: 'ask_user_question' },
		{ mode: 'tui', cwd: '/work/repository' },
	)
	await flush()
	assert.equal(notifications.length, 1)
	const notification = notifications[0]
	assert.ok(notification)
	assert.match(notification.title, /décision requise/)
	assert.equal(notification.message, 'Une question attend ton choix')
})

test('ask_user_question stays silent when the pane is focused', async () => {
	const { handlers, notifications } = loadExtension(
		ENVIRONMENT,
		async () => true,
	)
	requiredHandler(handlers, 'tool_execution_start')(
		{ toolName: 'ask_user_question' },
		{ mode: 'tui', cwd: '/work/repository' },
	)
	await flush()

	assert.deepEqual(notifications, [])
})

test('all notification hooks are guarded by TUI mode', async () => {
	const { handlers, notifications } = loadExtension()
	requiredHandler(handlers, 'agent_start')({}, { mode: 'rpc' })
	requiredHandler(handlers, 'agent_settled')(
		{},
		{ mode: 'rpc', isIdle: () => true },
	)
	requiredHandler(handlers, 'tool_execution_start')(
		{ toolName: 'ask_user_question' },
		{ mode: 'json' },
	)
	await flush()
	assert.deepEqual(notifications, [])
})

test('final snippet keeps text parts, normalizes whitespace, and truncates at 160 characters', () => {
	const text = `  first\npart  ${'x'.repeat(200)}`
	const snippet = extractFinalSnippet({
		role: 'assistant',
		content: [
			{ type: 'thinking', text: 'secret' },
			{ type: 'text', text },
			{ type: 'text', text: 'tail' },
		],
	})
	assert.equal(snippet.length, 160)
	assert.match(snippet, /^first part x+/)
	assert.equal(snippet.includes('secret'), false)
	assert.equal(
		extractFinalSnippet({
			role: 'user',
			content: [{ type: 'text', text: 'no' }],
		}),
		'',
	)
})
