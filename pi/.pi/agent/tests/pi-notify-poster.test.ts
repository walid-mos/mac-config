import assert from 'node:assert/strict'
import test from 'node:test'

import {
	NotificationPoster,
	notificationEnabled,
} from '../extensions/pi-notify.ts'

import {
	ENVIRONMENT,
	FakeOperations,
	HELPER,
	NOTIFIER,
	OPEN,
	PKILL,
	close,
	flush,
	request,
} from './pi-notify.test-helpers.ts'

test('activation requires Herdr context and at least one poster', () => {
	const operations = new FakeOperations()
	assert.equal(notificationEnabled(ENVIRONMENT, operations), false)

	operations.available.add(HELPER)
	assert.equal(notificationEnabled(ENVIRONMENT, operations), true)
	assert.equal(
		notificationEnabled({ ...ENVIRONMENT, HERDR_ENV: '0' }, operations),
		false,
	)
	assert.equal(
		notificationEnabled({ ...ENVIRONMENT, HERDR_PANE_ID: '' }, operations),
		false,
	)
	assert.equal(
		notificationEnabled(
			{ ...ENVIRONMENT, HERDR_SOCKET_PATH: undefined },
			operations,
		),
		false,
	)

	operations.available.clear()
	operations.available.add(NOTIFIER)
	assert.equal(notificationEnabled(ENVIRONMENT, operations), true)
})

test('native helper kills the pane resident before opening Pi Notifications.app', async () => {
	const operations = new FakeOperations()
	operations.available.add(HELPER)
	const poster = new NotificationPoster(operations)
	poster.notify(request('pane-native', 'Native body'))
	await flush()

	assert.equal(operations.calls[0]?.command, PKILL)
	assert.match(operations.calls[0]?.args[1] ?? '', /pane-native/)
	close(operations.calls[0])
	await flush()

	const open = operations.calls[1]
	assert.equal(open?.command, OPEN)
	assert.equal(open?.options.detached, true)
	assert.equal(open?.options.stdio, 'ignore')
	assert.equal(open?.child.unrefCalled, true)
	assert.deepEqual(open?.args.slice(0, 4), [
		'-n',
		'/Applications/Pi Notifications.app',
		'--args',
		'-title',
	])
	assert.ok(open?.args.includes('Native body'))
	assert.ok(open?.args.includes('/tmp/pane-native.sock'))

	close(open)
	await poster.waitForIdle('pane-native')
})

test('terminal-notifier fallback is grouped by pane and focuses the exact Herdr socket', () => {
	const operations = new FakeOperations()
	operations.available.add(NOTIFIER)
	const poster = new NotificationPoster(operations)
	poster.notify(request('pane-fallback', 'Fallback body'))

	const call = operations.calls[0]
	assert.equal(call?.command, NOTIFIER)
	assert.equal(call?.options.detached, true)
	assert.equal(call?.child.unrefCalled, true)
	assert.deepEqual(call?.args.slice(-4, -2), ['-group', 'pi-pane-fallback'])
	assert.match(
		call?.args.at(-1) ?? '',
		/HERDR_SOCKET_PATH='\/tmp\/pane-fallback\.sock'/,
	)
	assert.match(call?.args.at(-1) ?? '', /agent focus 'pane-fallback'/)
})

test('asynchronous ChildProcess errors are always observed', () => {
	const operations = new FakeOperations()
	operations.available.add(NOTIFIER)
	const poster = new NotificationPoster(operations)
	poster.notify(request())

	assert.doesNotThrow(() =>
		operations.calls[0]?.child.emit('error', new Error('ENOENT')),
	)
})

test('synchronous spawn errors are absorbed', () => {
	const operations = new FakeOperations()
	operations.available.add(NOTIFIER)
	operations.throwOnSpawn = true
	const poster = new NotificationPoster(operations)
	assert.doesNotThrow(() => poster.notify(request()))
})

test('simultaneous same-pane calls collapse to the latest replacement', async () => {
	const operations = new FakeOperations()
	operations.available.add(HELPER)
	const poster = new NotificationPoster(operations)

	poster.notify(request('pane-simultaneous', 'old'))
	poster.notify(request('pane-simultaneous', 'latest'))
	await flush()
	const kills = operations.calls.filter(call => call.command === PKILL)
	assert.equal(kills.length, 1)
	close(kills[0])
	await flush()

	const opens = operations.calls.filter(call => call.command === OPEN)
	assert.equal(opens.length, 1)
	assert.ok(opens[0]?.args.includes('latest'))
	close(opens[0])
	await poster.waitForIdle('pane-simultaneous')
})

test('a stale same-pane replacement cannot launch its helper', async () => {
	const operations = new FakeOperations()
	operations.available.add(HELPER)
	const poster = new NotificationPoster(operations)

	poster.notify(request('pane-race', 'old'))
	await flush()
	const oldKill = operations.calls[0]
	poster.notify(request('pane-race', 'new'))
	close(oldKill)
	await flush()

	assert.equal(
		operations.calls.filter(call => call.command === OPEN).length,
		0,
	)
	const newKill = operations.calls[1]
	assert.equal(newKill?.command, PKILL)
	close(newKill)
	await flush()

	const opens = operations.calls.filter(call => call.command === OPEN)
	assert.equal(opens.length, 1)
	assert.ok(opens[0]?.args.includes('new'))
	close(opens[0])
	await poster.waitForIdle('pane-race')
})

test('different panes have independent replacement queues', async () => {
	const operations = new FakeOperations()
	operations.available.add(HELPER)
	const poster = new NotificationPoster(operations)

	poster.notify(request('pane-a'))
	poster.notify(request('pane-b'))
	await flush()
	const kills = operations.calls.filter(call => call.command === PKILL)
	assert.equal(kills.length, 2)

	close(kills[0])
	await flush()
	const openA = operations.calls.find(call => call.command === OPEN)
	assert.ok(openA?.args.includes('pane-a'))
	assert.equal(
		operations.calls.filter(call => call.command === OPEN).length,
		1,
	)

	close(kills[1])
	await flush()
	const opens = operations.calls.filter(call => call.command === OPEN)
	assert.equal(opens.length, 2)
	assert.ok(opens[1]?.args.includes('pane-b'))
	opens.forEach(call => close(call))
	await Promise.all([
		poster.waitForIdle('pane-a'),
		poster.waitForIdle('pane-b'),
	])
})

test('one pane accepts unlimited successive notifications', async () => {
	const operations = new FakeOperations()
	operations.available.add(HELPER)
	const poster = new NotificationPoster(operations)

	for (const message of ['first', 'second', 'third']) {
		poster.notify(request('pane-repeat', message))
		await flush()
		const kill = operations.calls.at(-1)!
		assert.equal(kill.command, PKILL)
		close(kill)
		await flush()
		const open = operations.calls.at(-1)!
		assert.equal(open.command, OPEN)
		assert.ok(open.args.includes(message))
		close(open)
		await poster.waitForIdle('pane-repeat')
	}

	assert.equal(
		operations.calls.filter(call => call.command === OPEN).length,
		3,
	)
})
