import assert from "node:assert/strict";
import test from "node:test";
import {
	createWordRotation,
	DEFAULT_ROTATION_INTERVAL_MS,
	type IntervalScheduler,
} from "../extensions/working-loader/rotation.ts";
import { createShuffleBag, type NonEmptyArray } from "../extensions/working-loader/shuffle-bag.ts";
import { WORKING_WORDS } from "../extensions/working-loader/words.ts";
import { isThinkingStreamEvent, isWorkingStreamEvent } from "../extensions/working-loader/index.ts";
import { surfaceRegistry, subscribeSurfaceChanges } from "../extensions/ui/surface.ts";
import { ABOVE_EDITOR_PRIORITY } from "../extensions/ui/ordered-widget-stack.ts";
import workingLoader from "../extensions/working-loader/index.ts";

type Fn = (...args: never[]) => unknown;

function fakeScheduler() {
	const timers: Array<{ tick: Fn; delayMs: number; cleared: boolean }> = [];
	const scheduler: IntervalScheduler = {
		setInterval(tick: Fn, delayMs: number) {
			const timer = { tick, delayMs, cleared: false };
			timers.push(timer);
			return { clear: () => { timer.cleared = true; } };
		},
	};
	const fireAll = () => {
		for (const timer of timers) if (!timer.cleared) timer.tick();
	};
	return { scheduler, timers, fireAll };
}

function fakeTheme() {
	return { fg: (_role: string, text: string) => text };
}

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_PATTERN, "");
}

type StreamPayload = { assistantMessageEvent?: { type: string } };
type Handler = (
	event: { toolName?: string } & StreamPayload,
	ctx: { ui: unknown },
) => Promise<void> | void;

function harness(uiOverrides: Partial<Record<string, Fn>> = {}) {
	const handlers = new Map<string, Handler>();
	const calls: string[] = [];
	const ui = {
		setWidget: () => {},
		requestRender: () => {},
		setWorkingVisible: (visible: boolean) => calls.push(`workingVisible:${String(visible)}`),
		setHiddenThinkingLabel: (label?: string) => calls.push(`thinkingLabel:${String(label)}`),
		get theme() {
			return fakeTheme();
		},
		...uiOverrides,
	};
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
	};
	(workingLoader as unknown as (api: unknown) => void)(pi);
	const emit = (event: string, toolName?: string, payload?: StreamPayload) =>
		handlers.get(event)?.({ toolName, ...payload }, { ui });
	return { emit, calls, ui };
}

test("shuffle bag yields every word once per cycle without immediate repeats", () => {
	const bag = createShuffleBag(WORKING_WORDS);
	const firstCycle = Array.from({ length: WORKING_WORDS.length }, () => bag.next());
	assert.deepEqual([...firstCycle].sort(), [...WORKING_WORDS].sort());
	const seen = new Set(firstCycle);
	assert.equal(seen.size, WORKING_WORDS.length, "no repeats inside a cycle");

	const secondCycle = Array.from({ length: WORKING_WORDS.length }, () => bag.next());
	assert.notEqual(secondCycle[0], firstCycle[WORKING_WORDS.length - 1], "no repeat across cycles");
	assert.deepEqual([...secondCycle].sort(), [...WORKING_WORDS].sort());
});

test("shuffle bag tolerates a single item", () => {
	const bag = createShuffleBag(["solo"] as unknown as NonEmptyArray<string>);
	assert.equal(bag.next(), "solo");
	assert.equal(bag.next(), "solo");
});

test("rotation fires immediately, then per tick, and start is idempotent", () => {
	const { scheduler, timers, fireAll } = fakeScheduler();
	let ticks = 0;
	const rotation = createWordRotation({
		scheduler,
		nextWord: () => {
			ticks += 1;
		},
	});

	rotation.start();
	assert.equal(ticks, 1, "immediate first word");
	rotation.start();
	assert.equal(timers.length, 1, "no duplicate timer on redundant start");

	fireAll();
	assert.equal(ticks, 2);
	assert.equal(DEFAULT_ROTATION_INTERVAL_MS, 4000);
	assert.equal(timers[0]?.delayMs, DEFAULT_ROTATION_INTERVAL_MS);

	rotation.stop();
	assert.equal(timers[0]?.cleared, true);
	assert.equal(rotation.isRunning(), false);
});

test("shows a rotating word above the editor while the agent works", () => {
	surfaceRegistry.clear();
	const { emit } = harness();
	try {
		emit("session_start");
		emit("agent_start");

		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), true);
		const rendered = surfaceRegistry.render("aboveEditor", 80, fakeTheme());
		assert.equal(rendered.length, 1);
		assert.match(rendered[0] ?? "", /✻ \w+\.\.\./u);

		emit("agent_end");
		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), false);
	} finally {
		surfaceRegistry.clear();
	}
});

test("uses the working priority and pauses during ask_user_question", () => {
	surfaceRegistry.clear();
	const { emit, calls } = harness();
	try {
		emit("session_start");
		emit("agent_start");

		const entries = surfaceRegistry.render("aboveEditor", 80, fakeTheme());
		assert.equal(entries.length, 1, "registered while working");
		assert.deepEqual(calls, ["thinkingLabel:", "workingVisible:false"], "native spinner hidden while loader is up");

		emit("tool_execution_start", "ask_user_question");
		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), false);
		assert.deepEqual(
			calls,
			["thinkingLabel:", "workingVisible:false", "workingVisible:true"],
			"restored during questionnaire",
		);

		emit("tool_execution_end", "ask_user_question");
		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), true);

		emit("agent_end");
		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), false);
		assert.deepEqual(calls, [
			"thinkingLabel:",
			"workingVisible:false",
			"workingVisible:true",
			"workingVisible:false",
			"workingVisible:true",
		]);
	} finally {
		surfaceRegistry.clear();
	}
});

test("ignores unrelated tools and restores defaults on shutdown", () => {
	surfaceRegistry.clear();
	const { emit, calls } = harness();
	try {
		emit("session_start");
		assert.equal(calls[0], "thinkingLabel:", "thinking label hidden at session start");

		emit("tool_execution_start", "read");
		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), false, "unrelated tools never toggle the loader");

		emit("agent_start");
		emit("session_shutdown");
		assert.equal(surfaceRegistry.hasEntries("aboveEditor"), false);
		assert.ok(calls.includes("thinkingLabel:undefined"), "thinking label restored on shutdown");
	} finally {
		surfaceRegistry.clear();
	}
});

test("declares the working priority in the shared constant", () => {
	assert.equal(ABOVE_EDITOR_PRIORITY.working, 50);
	const removeListener = subscribeSurfaceChanges(() => {});
	removeListener();
});

test("stream helpers classify assistant events", () => {
	assert.equal(isThinkingStreamEvent("thinking_start"), true);
	assert.equal(isThinkingStreamEvent("thinking_delta"), true);
	assert.equal(isThinkingStreamEvent("text_delta"), false);
	assert.equal(isWorkingStreamEvent("text_start"), true);
	assert.equal(isWorkingStreamEvent("toolcall_start"), true);
	assert.equal(isWorkingStreamEvent("thinking_end"), true);
	assert.equal(isWorkingStreamEvent("thinking_delta"), false);
});

test("thinking streams append the ✽ marker at the far right of the loader line", () => {
	surfaceRegistry.clear();
	const { emit } = harness();
	try {
		emit("session_start");
		emit("agent_start");
		emit("message_update", undefined, { assistantMessageEvent: { type: "thinking_start" } });

		const width = 80;
		const rendered = surfaceRegistry.render("aboveEditor", width, fakeTheme());
		const line = stripAnsi(rendered[0] ?? "");
		assert.match(line, /^✻ \w+\.\.\./u, "les mots de travail continuent à gauche");
		assert.match(line, /✽ raisonnement$/u, "marqueur à l'extrême droite");
		assert.equal(line.length, width, "la ligne occupe exactement la largeur");

		emit("message_update", undefined, { assistantMessageEvent: { type: "text_start" } });
		const backToWork = stripAnsi(surfaceRegistry.render("aboveEditor", width, fakeTheme())[0] ?? "");
		assert.doesNotMatch(backToWork, /✽/u, "marqueur retiré hors raisonnement");
	} finally {
		surfaceRegistry.clear();
	}
});

test("mode flips repaint immediately, not on the next rotation tick", () => {
	surfaceRegistry.clear();
	const { emit } = harness();
	try {
		emit("session_start");
		emit("agent_start");
		emit("message_update", undefined, { assistantMessageEvent: { type: "thinking_delta" } });
		assert.match(
			stripAnsi(surfaceRegistry.render("aboveEditor", 80, fakeTheme())[0] ?? ""),
			/✽ raisonnement$/u,
		);
		emit("agent_end");
	} finally {
		surfaceRegistry.clear();
	}
});

test("the marker is dropped on narrow widths instead of breaking the line", () => {
	surfaceRegistry.clear();
	const { emit } = harness();
	try {
		emit("session_start");
		emit("agent_start");
		emit("message_update", undefined, { assistantMessageEvent: { type: "thinking_start" } });

		const line = stripAnsi(surfaceRegistry.render("aboveEditor", 24, fakeTheme())[0] ?? "");
		assert.match(line, /^✻ \w+\.\.\.$/u, "seul le mot de travail reste");
		emit("agent_end");
	} finally {
		surfaceRegistry.clear();
	}
});

test("message_end returns the loader to working mode", () => {
	surfaceRegistry.clear();
	const { emit } = harness();
	try {
		emit("session_start");
		emit("agent_start");
		emit("message_update", undefined, { assistantMessageEvent: { type: "thinking_start" } });
		emit("message_end");
		assert.doesNotMatch(
			stripAnsi(surfaceRegistry.render("aboveEditor", 80, fakeTheme())[0] ?? ""),
			/✽/u,
		);
		emit("agent_end");
	} finally {
		surfaceRegistry.clear();
	}
});
