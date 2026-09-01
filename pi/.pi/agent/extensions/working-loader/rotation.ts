export const WORD_ROTATION_INTERVAL_MS = 4000

export type IntervalHandle = {
	clear: () => void
}

export type IntervalScheduler = {
	setInterval: (tick: () => void, delayMs: number) => IntervalHandle
}

export const defaultIntervalScheduler: IntervalScheduler = {
	setInterval(tick, delayMs) {
		const timer = setInterval(tick, delayMs)
		return {
			clear() {
				clearInterval(timer)
			},
		}
	},
}

export type Rotation = {
	start: () => void
	stop: () => void
	isRunning: () => boolean
}

/**
 * Advances immediately on start, then on every interval tick until stopped.
 * start() is idempotent: redundant starts keep the running timer instead of
 * churning clear/set cycles.
 */
export function createRotation(options: {
	scheduler: IntervalScheduler
	intervalMs: number
	advance: () => void
}): Rotation {
	let handle: IntervalHandle | undefined

	return {
		start() {
			if (handle !== undefined) return
			options.advance()
			handle = options.scheduler.setInterval(
				options.advance,
				options.intervalMs,
			)
		},
		stop() {
			handle?.clear()
			handle = undefined
		},
		isRunning: () => handle !== undefined,
	}
}
