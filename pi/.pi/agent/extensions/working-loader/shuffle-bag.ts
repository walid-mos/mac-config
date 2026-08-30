export type NonEmptyArray<T> = readonly [T, ...T[]];

export type ShuffleBag<T> = {
	next: () => T;
};

/**
 * Random order without repeats inside a cycle, and without repeating the last
 * item of a cycle at the start of the next one. Fisher-Yates runs in place on
 * a single pooled buffer: steady-state rotation allocates nothing.
 */
export function createShuffleBag<T>(
	items: NonEmptyArray<T>,
	random: () => number = Math.random,
): ShuffleBag<T> {
	let bag: T[] = [];
	let cursor = 0;
	let previous: T | undefined;

	function refill(): void {
		if (bag.length === 0) bag = [...items];
		for (let index = bag.length - 1; index > 0; index--) {
			const swapIndex = Math.floor(random() * (index + 1));
			const swapped = bag[swapIndex];
			const current = bag[index];
			if (swapped === undefined || current === undefined) continue;
			bag[swapIndex] = current;
			bag[index] = swapped;
		}
		if (bag.length > 1 && bag[0] === previous) {
			const otherIndex = 1 + Math.floor(random() * (bag.length - 1));
			const repeat = bag[0];
			const other = bag[otherIndex];
			if (repeat !== undefined && other !== undefined) {
				bag[0] = other;
				bag[otherIndex] = repeat;
			}
		}
		cursor = 0;
	}

	return {
		next(): T {
			if (cursor >= bag.length) refill();
			const item = bag[cursor++];
			if (item === undefined) {
				throw new Error("shuffle bag produced no item after refill");
			}
			previous = item;
			return item;
		},
	};
}
