export const GOAL_DISPATCH_START_TIMEOUT_MS = 10_000

type Timer = ReturnType<typeof setTimeout>

export type GoalDispatchWatchdogOptions = {
	readonly setTimer?: (callback: () => void, delay: number) => Timer
	readonly clearTimer?: (timer: Timer) => void
}

/** Pauses a continuation when the void Extension API never starts its turn. */
export class GoalDispatchWatchdog {
	private timer: Timer | undefined
	private generation = 0
	private readonly setTimer: NonNullable<
		GoalDispatchWatchdogOptions['setTimer']
	>
	private readonly clearTimer: NonNullable<
		GoalDispatchWatchdogOptions['clearTimer']
	>

	constructor(options: GoalDispatchWatchdogOptions = {}) {
		this.setTimer = options.setTimer ?? setTimeout
		this.clearTimer = options.clearTimer ?? clearTimeout
	}

	arm(onTimeout: () => void): void {
		this.cancel()
		const generation = this.generation
		this.timer = this.setTimer(() => {
			if (generation !== this.generation) return
			this.timer = undefined
			onTimeout()
		}, GOAL_DISPATCH_START_TIMEOUT_MS)
		this.timer.unref?.()
	}

	started(): void {
		this.cancel()
	}

	cancel(): void {
		this.generation += 1
		if (!this.timer) return
		this.clearTimer(this.timer)
		this.timer = undefined
	}
}
