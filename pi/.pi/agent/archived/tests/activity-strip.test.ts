import assert from "node:assert/strict";
import test from "node:test";
import {
	clipToTerminalWidth,
	countTool,
	countTurn,
	emptyActivityStrip,
	formatActivityLine,
	formatElapsed,
	settleStrip,
	startPrompt,
	tickElapsed,
} from "../extensions/activity-strip/state.ts";

test("formatElapsed uses unbounded minutes and seconds", () => {
	assert.equal(formatElapsed(0), "0:00");
	assert.equal(formatElapsed(12_000), "0:12");
	assert.equal(formatElapsed(12 * 60_000 + 47_000), "12:47");
	assert.equal(formatElapsed(61 * 60_000), "61:00");
});

test("startPrompt resets counters and tracked activity", () => {
	let state = startPrompt(1_000);
	state = countTurn(state);
	state = countTool(state);
	state = startPrompt(9_000);
	assert.equal(state.promptStarted, true);
	assert.equal(state.frozen, false);
	assert.equal(state.elapsedMs, 0);
	assert.equal(state.turns, 0);
	assert.equal(state.tools, 0);
	assert.equal(state.startedAtMs, 9_000);
});

test("counts turns and tools only after a prompt starts", () => {
	let state = emptyActivityStrip();
	state = countTurn(state);
	state = countTool(state);
	assert.equal(state.turns, 0);
	assert.equal(state.tools, 0);
	state = startPrompt(0);
	state = countTurn(countTurn(state));
	state = countTool(state);
	assert.equal(state.turns, 2);
	assert.equal(state.tools, 1);
});

test("settled duration freezes", () => {
	let state = startPrompt(0);
	state = settleStrip(state, 12_000);
	state = tickElapsed(state, 40_000);
	assert.equal(state.elapsedMs, 12_000);
	assert.equal(formatElapsed(state.elapsedMs), "0:12");
});







test("format sample and width clipping never emit a newline", () => {
	let state = tickElapsed(startPrompt(0), 12 * 60_000 + 47_000);
	state = { ...state, turns: 9, tools: 38 };
	const line = formatActivityLine(state);
	assert.equal(line, "◷ 12:47 · 9 turns · 38 tools");
	assert.equal(line.includes("\n"), false);
	const clipped = clipToTerminalWidth(`${line}\nextra`, 20);
	assert.equal(clipped.includes("\n"), false);
	assert.ok(clipped.length <= 20);
	assert.equal(clipToTerminalWidth(line, line.length), line);
});

