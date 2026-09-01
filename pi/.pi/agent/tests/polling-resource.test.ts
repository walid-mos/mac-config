import assert from 'node:assert/strict'
import test from 'node:test'

import { createPollingResource } from '../extensions/footer/polling-resource.ts'

type Deferred<T> = {
	promise: Promise<T>
	resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(done => {
		resolve = done
	})
	return { promise, resolve }
}

test('publishes only the latest concurrent refresh', async () => {
	const requests = new Map<string, Deferred<string>>()
	const values: string[] = []
	const resource = createPollingResource<string, string>({
		intervalMs: 60_000,
		load: key => {
			const request = deferred<string>()
			requests.set(key, request)
			return request.promise
		},
		onValue: value => values.push(value),
	})

	resource.start('old')
	const latest = resource.refresh('new')
	requests.get('old')?.resolve('stale')
	requests.get('new')?.resolve('fresh')
	await latest
	resource.stop()

	assert.deepEqual(values, ['fresh'])
})

test('discards an in-flight value after stop', async () => {
	const request = deferred<string>()
	const values: string[] = []
	const resource = createPollingResource<void, string>({
		intervalMs: 60_000,
		load: () => request.promise,
		onValue: value => values.push(value),
	})

	resource.start(undefined)
	resource.stop()
	request.resolve('late')
	await request.promise
	await new Promise(resolve => setImmediate(resolve))

	assert.deepEqual(values, [])
})
