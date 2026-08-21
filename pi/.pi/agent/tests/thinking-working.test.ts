import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createWorkingRotation,
	type IntervalHandle,
	type IntervalScheduler,
} from "../extensions/thinking-working/rotation.ts";
import { createShuffleBag, workingMessage } from "../extensions/thinking-working/shuffle-bag.ts";
import { THINKING_WORKING_WORDS } from "../extensions/thinking-working/words.ts";

test("word list includes Sloubagoubliming and stays unique", () => {
	assert.ok(THINKING_WORKING_WORDS.includes("Sloubagoubliming"));
	assert.equal(new Set(THINKING_WORKING_WORDS).size, THINKING_WORKING_WORDS.length);
	assert.ok(THINKING_WORKING_WORDS.length >= 20);
});

test("workingMessage appends ellipsis once", () => {
	assert.equal(workingMessage("Pondering"), "Pondering...");
});

test("shuffle bag yields each item once per cycle", () => {
	const bag = createShuffleBag(["a", "b", "c"] as const, () => 0);
	const firstCycle = [bag.next(), bag.next(), bag.next()];
	assert.deepEqual(new Set(firstCycle), new Set(["a", "b", "c"]));
});

test("shuffle bag does not repeat the last item across a refill", () => {
	const bag = createShuffleBag(["a", "b"] as const, () => 0);
	const sequence = [bag.next(), bag.next(), bag.next(), bag.next()];
	for (let index = 1; index < sequence.length; index++) {
		assert.notEqual(sequence[index], sequence[index - 1]);
	}
});

function fakeScheduler(): {
	scheduler: IntervalScheduler;
	fire: () => void;
	pending: () => number;
} {
	const ticks: Array<() => void> = [];
	return {
		scheduler: {
			setInterval(tick: () => void, _delayMs: number): IntervalHandle {
				ticks.push(tick);
				return {
					clear() {
						const index = ticks.indexOf(tick);
						if (index < 0) return;
						ticks.splice(index, 1);
					},
				};
			},
		},
		fire() {
			for (const tick of [...ticks]) tick();
		},
		pending: () => ticks.length,
	};
}

test("rotation starts immediately then follows the interval", () => {
	const clock = fakeScheduler();
	const calls: string[] = [];
	const rotation = createWorkingRotation({
		scheduler: clock.scheduler,
		intervalMs: 3000,
		hideTranscriptThinking() {
			calls.push("hide");
		},
		rotate() {
			calls.push("rotate");
		},
		restoreWorkingMessage() {
			calls.push("working");
		},
		restoreDefaults() {
			calls.push("restore");
		},
	});

	rotation.start();
	assert.deepEqual(calls, ["hide", "rotate"]);
	assert.equal(clock.pending(), 1);
	assert.equal(rotation.isRunning(), true);

	clock.fire();
	assert.deepEqual(calls, ["hide", "rotate", "rotate"]);
});

test("stop restores the working message and is idempotent", () => {
	const clock = fakeScheduler();
	const calls: string[] = [];
	const rotation = createWorkingRotation({
		scheduler: clock.scheduler,
		hideTranscriptThinking() {},
		rotate() {},
		restoreWorkingMessage() {
			calls.push("working");
		},
		restoreDefaults() {
			calls.push("restore");
		},
	});

	rotation.start();
	rotation.stop();
	rotation.stop();
	assert.deepEqual(calls, ["working", "working"]);
	assert.equal(clock.pending(), 0);
	assert.equal(rotation.isRunning(), false);
});

test("shutdown restores defaults and clears the timer", () => {
	const clock = fakeScheduler();
	const calls: string[] = [];
	const rotation = createWorkingRotation({
		scheduler: clock.scheduler,
		hideTranscriptThinking() {
			calls.push("hide");
		},
		rotate() {
			calls.push("rotate");
		},
		restoreWorkingMessage() {
			calls.push("working");
		},
		restoreDefaults() {
			calls.push("restore");
		},
	});

	rotation.start();
	rotation.shutdown();
	rotation.shutdown();
	assert.deepEqual(calls, ["hide", "rotate", "working", "restore", "working", "restore"]);
	assert.equal(clock.pending(), 0);
});

test("restarting does not leak timers", () => {
	const clock = fakeScheduler();
	const rotation = createWorkingRotation({
		scheduler: clock.scheduler,
		hideTranscriptThinking() {},
		rotate() {},
		restoreWorkingMessage() {},
		restoreDefaults() {},
	});

	rotation.start();
	rotation.start();
	assert.equal(clock.pending(), 1);
	rotation.stop();
	assert.equal(clock.pending(), 0);
});
