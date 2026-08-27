export const ROTATION_INTERVAL_MS = 3000;

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

export type WorkingRotation = {
	start: () => void;
	stop: () => void;
	shutdown: () => void;
	isRunning: () => boolean;
};

export function createWorkingRotation(options: {
	rotate: () => void;
	hideTranscriptThinking: () => void;
	restoreWorkingMessage: () => void;
	restoreDefaults: () => void;
	scheduler: IntervalScheduler;
	intervalMs?: number;
}): WorkingRotation {
	const intervalMs = options.intervalMs ?? ROTATION_INTERVAL_MS;
	let handle: IntervalHandle | undefined;

	function clearTimer(): void {
		handle?.clear();
		handle = undefined;
	}

	function stop(): void {
		clearTimer();
		options.restoreWorkingMessage();
	}

	function start(): void {
		clearTimer();
		options.hideTranscriptThinking();
		options.rotate();
		handle = options.scheduler.setInterval(options.rotate, intervalMs);
	}

	function shutdown(): void {
		stop();
		options.restoreDefaults();
	}

	return {
		start,
		stop,
		shutdown,
		isRunning: () => handle !== undefined,
	};
}
