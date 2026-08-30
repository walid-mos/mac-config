import assert from "node:assert/strict";
import test from "node:test";
import { DOUBLE_ESCAPE_WINDOW_MS, EscapePacer } from "../extensions/double-escape/pacer.ts";

test("second escape inside the window completes the gesture", () => {
	const pacer = new EscapePacer();
	assert.equal(pacer.registerEscape(0), false);
	assert.equal(pacer.registerEscape(DOUBLE_ESCAPE_WINDOW_MS), true);
});

test("second escape outside the window does not fire", () => {
	const pacer = new EscapePacer();
	assert.equal(pacer.registerEscape(0), false);
	assert.equal(pacer.registerEscape(DOUBLE_ESCAPE_WINDOW_MS + 1), false);
});

test("fired gesture re-arms: a third escape starts a new gesture", () => {
	const pacer = new EscapePacer();
	pacer.registerEscape(0);
	assert.equal(pacer.registerEscape(100), true);
	assert.equal(pacer.registerEscape(200), false);
	assert.equal(pacer.registerEscape(300), true);
});

test("any other key resets the pending first press", () => {
	const pacer = new EscapePacer();
	assert.equal(pacer.registerEscape(0), false);
	pacer.reset();
	assert.equal(pacer.registerEscape(100), false);
});

test("fires at exactly the window boundary, not one ms later", () => {
	const pacer = new EscapePacer();
	pacer.registerEscape(1000);
	assert.equal(pacer.registerEscape(1000 + DOUBLE_ESCAPE_WINDOW_MS), true);

	const late = new EscapePacer();
	late.registerEscape(1000);
	assert.equal(late.registerEscape(1000 + DOUBLE_ESCAPE_WINDOW_MS + 1), false);
});
