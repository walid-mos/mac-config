export type NonEmptyArray<T> = readonly [T, ...T[]];

export type ShuffleBag<T> = {
	next: () => T;
};

export function createShuffleBag<T>(
	items: NonEmptyArray<T>,
	random: () => number = Math.random,
): ShuffleBag<T> {
	let remaining: T[] = [];
	let previous: T | undefined;

	function refill(): void {
		remaining = [...items];
		for (let index = remaining.length - 1; index > 0; index--) {
			const swapIndex = Math.floor(random() * (index + 1));
			const current = remaining[index];
			const swapped = remaining[swapIndex];
			if (current === undefined || swapped === undefined) continue;
			remaining[index] = swapped;
			remaining[swapIndex] = current;
		}
		if (remaining.length < 2 || remaining[remaining.length - 1] !== previous) return;
		const first = remaining[0];
		const last = remaining[remaining.length - 1];
		if (first === undefined || last === undefined) return;
		remaining[0] = last;
		remaining[remaining.length - 1] = first;
	}

	return {
		next(): T {
			if (remaining.length === 0) refill();
			const item = remaining.pop();
			if (item === undefined) {
				throw new Error("shuffle bag produced no item after refill");
			}
			previous = item;
			return item;
		},
	};
}

export function workingMessage(word: string): string {
	return `${word}...`;
}
