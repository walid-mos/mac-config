export type PollingResource<Arguments, Value> = {
	start: (args: Arguments) => void;
	refresh: (args?: Arguments) => Promise<void>;
	stop: () => void;
};

type PollingResourceOptions<Arguments, Value> = {
	intervalMs: number;
	load: (args: Arguments) => Promise<Value>;
	onValue: (value: Value) => void;
};

/** Owns one timer and discards stale async results after refreshes or shutdown. */
export function createPollingResource<Arguments, Value>(
	options: PollingResourceOptions<Arguments, Value>,
): PollingResource<Arguments, Value> {
	let active = false;
	let latestArgs: Arguments;
	let generation = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	async function refresh(args?: Arguments): Promise<void> {
		if (args !== undefined) latestArgs = args;
		if (!active) return;
		const requestGeneration = ++generation;
		try {
			const value = await options.load(latestArgs);
			if (!active || requestGeneration !== generation) return;
			options.onValue(value);
		} catch {
			// Polling data is decorative and must not destabilize the extension runtime.
		}
	}

	function start(args: Arguments): void {
		latestArgs = args;
		active = true;
		void refresh();
		if (timer) return;
		timer = setInterval(() => void refresh(), options.intervalMs);
		timer.unref?.();
	}

	function stop(): void {
		active = false;
		generation += 1;
		if (timer) clearInterval(timer);
		timer = undefined;
	}

	return { start, refresh, stop };
}
