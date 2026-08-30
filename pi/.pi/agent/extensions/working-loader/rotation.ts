export const DEFAULT_ROTATION_INTERVAL_MS = 4000;

export type IntervalHandle = {
	clear: () => void;
};

export type IntervalScheduler = {
	setInterval: (tick: () => void, delayMs: number) => IntervalHandle;
};

export const defaultIntervalScheduler: IntervalScheduler = {
	setInterval(tick, delayMs) {
		const timer = setInterval(tick, delayMs);
		return {
			clear() {
				clearInterval(timer);
			},
		};
	},
};

export type WordRotation = {
	start: () => void;
	stop: () => void;
	isRunning: () => boolean;
};

/**
 * Calls nextWord immediately on start, then on every interval tick until
 * stopped. start() is idempotent: redundant starts keep the running timer
 * instead of churning clear/set cycles.
 */
export function createWordRotation(options: {
	scheduler: IntervalScheduler;
	intervalMs?: number;
	nextWord: () => void;
}): WordRotation {
	const intervalMs = options.intervalMs ?? DEFAULT_ROTATION_INTERVAL_MS;
	let handle: IntervalHandle | undefined;

	return {
		start() {
			if (handle !== undefined) return;
			options.nextWord();
			handle = options.scheduler.setInterval(options.nextWord, intervalMs);
		},
		stop() {
			handle?.clear();
			handle = undefined;
		},
		isRunning: () => handle !== undefined,
	};
}
