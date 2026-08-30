import assert from "node:assert/strict";
import test from "node:test";
import {
	createRotation,
	type IntervalScheduler,
	WORD_ROTATION_INTERVAL_MS,
} from "../extensions/working-loader/rotation.ts";
import { createShuffleBag, type NonEmptyArray } from "../extensions/working-loader/shuffle-bag.ts";
import {
	createSpinnerRotation,
	SAND_SPINNER,
} from "../extensions/working-loader/spinner.ts";
import {
	appendThinkingDelta,
	MAX_THINKING_BUFFER_LENGTH,
	normalizeThinkingText,
	rollingThinkingPreview,
	THINKING_ICON,
} from "../extensions/working-loader/thinking-preview.ts";
import { WORKING_WORDS } from "../extensions/working-loader/words.ts";
import { isThinkingStreamEvent, isWorkingStreamEvent } from "../extensions/working-loader/index.ts";
import { surfaceRegistry, subscribeSurfaceChanges } from "../extensions/ui/surface.ts";
import { ABOVE_EDITOR_PRIORITY } from "../extensions/ui/ordered-widget-stack.ts";
import { terminalLineWidth } from "../extensions/ui/terminal-text.ts";
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

function assertSandLoaderPrefix(line: string): void {
	assert.ok(
		SAND_SPINNER.frames.some((frame) => line.startsWith(`${frame} `)),
		`expected a sand frame at the start of ${JSON.stringify(line)}`,
	);
	assert.match(line, /^. \w+\.\.\./u);
}

type StreamPayload = { assistantMessageEvent?: { type: string; delta?: string } };
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
	const rotation = createRotation({
		scheduler,
		intervalMs: WORD_ROTATION_INTERVAL_MS,
		advance: () => {
			ticks += 1;
		},
	});

	rotation.start();
	assert.equal(ticks, 1, "immediate first tick");
	rotation.start();
	assert.equal(timers.length, 1, "no duplicate timer on redundant start");

	fireAll();
	assert.equal(ticks, 2);
	assert.equal(WORD_ROTATION_INTERVAL_MS, 4000);
	assert.equal(timers[0]?.delayMs, WORD_ROTATION_INTERVAL_MS);

	rotation.stop();
	assert.equal(timers[0]?.cleared, true);
	assert.equal(rotation.isRunning(), false);
});

test("sand spinner emits its canonical frames at 80ms and loops", () => {
	const { scheduler, timers, fireAll } = fakeScheduler();
	const frames: string[] = [];
	const rotation = createSpinnerRotation({
		scheduler,
		spinner: SAND_SPINNER,
		onFrame: (frame) => frames.push(frame),
	});

	rotation.start();
	assert.deepEqual(frames, [SAND_SPINNER.frames[0]]);
	assert.equal(timers[0]?.delayMs, 80);

	for (let index = 1; index < SAND_SPINNER.frames.length; index += 1) fireAll();
	assert.deepEqual(frames, SAND_SPINNER.frames);
	fireAll();
	assert.equal(frames.at(-1), SAND_SPINNER.frames[0], "loops to the first frame");

	rotation.stop();
	assert.equal(timers[0]?.cleared, true);
});

test("thinking preview is safe, bounded, and keeps a rolling tail", () => {
	const source = "\x1b[31m## Checking **widget alignment**\n- while reasoning streams\x1b[0m";
	assert.equal(normalizeThinkingText(source), "Checking widget alignment while reasoning streams");
	const preview = rollingThinkingPreview(source, 24);
	assert.equal(terminalLineWidth(preview), 24);
	assert.match(preview, /^…/u);
	assert.match(preview, /reasoning streams$/u);
	assert.equal(terminalLineWidth(THINKING_ICON), 1, "Nerd Font brain occupies one terminal cell");

	const bounded = appendThinkingDelta("x".repeat(MAX_THINKING_BUFFER_LENGTH), "tail");
	assert.equal(bounded.length, MAX_THINKING_BUFFER_LENGTH);
	assert.match(bounded, /tail$/u);
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
		assertSandLoaderPrefix(stripAnsi(rendered[0] ?? ""));

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

test("thinking streams show a brain and rolling excerpt at the far right", () => {
	surfaceRegistry.clear();
	const { emit } = harness();
	try {
		emit("session_start");
		emit("agent_start");
		emit("message_update", undefined, { assistantMessageEvent: { type: "thinking_start" } });

		const width = 80;
		const fallback = stripAnsi(surfaceRegistry.render("aboveEditor", width, fakeTheme())[0] ?? "");
		assertSandLoaderPrefix(fallback);
		assert.match(fallback, new RegExp(`${THINKING_ICON} raisonnement$`, "u"));
		assert.equal(terminalLineWidth(fallback), width, "la ligne occupe exactement la largeur");

		emit("message_update", undefined, {
			assistantMessageEvent: {
				type: "thinking_delta",
				delta: "Inspecting the shared widget alignment and current reasoning stream.",
			},
		});
		const rolling = stripAnsi(surfaceRegistry.render("aboveEditor", width, fakeTheme())[0] ?? "");
		assert.match(rolling, new RegExp(`${THINKING_ICON} ….*current reasoning stream\\.$`, "u"));
		assert.equal(terminalLineWidth(rolling), width);

		emit("message_update", undefined, { assistantMessageEvent: { type: "text_start" } });
		const backToWork = stripAnsi(surfaceRegistry.render("aboveEditor", width, fakeTheme())[0] ?? "");
		assert.doesNotMatch(backToWork, new RegExp(THINKING_ICON, "u"), "aperçu retiré hors raisonnement");
		emit("agent_end");
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
		emit("message_update", undefined, {
			assistantMessageEvent: { type: "thinking_delta", delta: "Checking repaint behavior" },
		});
		assert.match(
			stripAnsi(surfaceRegistry.render("aboveEditor", 80, fakeTheme())[0] ?? ""),
			new RegExp(`${THINKING_ICON} Checking repaint behavior$`, "u"),
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
		assertSandLoaderPrefix(line);
		assert.doesNotMatch(line, new RegExp(THINKING_ICON, "u"), "seul le mot de travail reste");
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
			new RegExp(THINKING_ICON, "u"),
		);
		emit("agent_end");
	} finally {
		surfaceRegistry.clear();
	}
});
