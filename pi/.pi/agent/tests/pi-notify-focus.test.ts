import assert from 'node:assert/strict'
import test from 'node:test'

import { createFocusProbe } from '../extensions/pi-notify.ts'

import {
	FakeOperations,
	HERDR,
	close,
	flush,
} from './pi-notify.test-helpers.ts'

test('default focus probe reads Herdr and lets the caller decide', async () => {
	const operations = new FakeOperations()
	const probe = createFocusProbe(operations, 1_000)

	const focused = probe('/tmp/herdr.sock', 'pane-1')
	await flush()
	const probeCall = operations.calls.find(call => call.command === HERDR)
	assert.ok(probeCall, 'the probe must spawn the herdr CLI')
	assert.equal(probeCall.args.join(' '), 'agent get pane-1')
	assert.equal(
		(probeCall.options.env as Record<string, string>).HERDR_SOCKET_PATH,
		'/tmp/herdr.sock',
	)
	probeCall.child.stdout?.emit(
		'data',
		JSON.stringify({
			result: { agent: { focused: true, pane_id: 'pane-1' } },
		}),
	)
	close(probeCall)
	assert.equal(await focused, true)

	const unfocused = probe('/tmp/herdr.sock', 'pane-2')
	await flush()
	const second = operations.calls.at(-1)!
	second.child.stdout?.emit(
		'data',
		JSON.stringify({
			result: { agent: { focused: false } },
		}),
	)
	close(second)
	assert.equal(await unfocused, false)

	const broken = probe('/tmp/herdr.sock', 'pane-3')
	await flush()
	close(operations.calls.at(-1)!)
	assert.equal(
		await broken,
		undefined,
		'malformed output must read as undefined',
	)
})

test('default focus probe survives a spawn failure', async () => {
	const operations = new FakeOperations()
	operations.throwOnSpawn = true
	const probe = createFocusProbe(operations)
	assert.equal(await probe('/tmp/herdr.sock', 'pane-1'), undefined)
})
