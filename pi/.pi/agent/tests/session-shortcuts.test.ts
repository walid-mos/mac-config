import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import sessionShortcuts, { quitIntent } from "../extensions/session-shortcuts.ts";

type CommandDefinition = {
	description: string;
	handler: (args: string, ctx: { newSession: () => Promise<unknown> }) => Promise<void>;
};

type InputHandler = (
	event: { text: string; source: "interactive" | "rpc" | "extension" },
	ctx: { isIdle: () => boolean; abort: () => void; shutdown: () => void },
) => { action: "continue" | "handled" };

function loadExtension(): { command: CommandDefinition; input: InputHandler } {
	let command: CommandDefinition | undefined;
	let input: InputHandler | undefined;

	const pi = {
		registerCommand(name: string, definition: CommandDefinition) {
			assert.equal(name, "clear");
			command = definition;
		},
		on(event: string, handler: InputHandler) {
			assert.equal(event, "input");
			input = handler;
		},
	};

	sessionShortcuts(pi as unknown as ExtensionAPI);
	assert.ok(command);
	assert.ok(input);
	return { command, input };
}

test("recognizes Vim quit aliases only for interactive input", () => {
	assert.equal(quitIntent({ text: " :q ", source: "interactive" }), "graceful");
	assert.equal(quitIntent({ text: ":q!", source: "interactive" }), "force");
	assert.equal(quitIntent({ text: ":quit", source: "interactive" }), undefined);
	assert.equal(quitIntent({ text: ":q", source: "rpc" }), undefined);
	assert.equal(quitIntent({ text: ":q", source: "extension" }), undefined);
});

test("registers /clear as a new-session command", async () => {
	const { command } = loadExtension();
	let calls = 0;

	await command.handler("", {
		newSession: async () => {
			calls += 1;
			return { cancelled: false };
		},
	});

	assert.equal(command.description, "Start a new session");
	assert.equal(calls, 1);
});

test(":q requests a graceful shutdown without aborting active work", () => {
	const { input } = loadExtension();
	let aborted = false;
	let shutdown = false;

	const result = input(
		{ text: ":q", source: "interactive" },
		{
			isIdle: () => false,
			abort: () => {
				aborted = true;
			},
			shutdown: () => {
				shutdown = true;
			},
		},
	);

	assert.deepEqual(result, { action: "handled" });
	assert.equal(aborted, false);
	assert.equal(shutdown, true);
});

test(":q! aborts active work before requesting shutdown", () => {
	const { input } = loadExtension();
	const calls: string[] = [];

	const result = input(
		{ text: ":q!", source: "interactive" },
		{
			isIdle: () => false,
			abort: () => calls.push("abort"),
			shutdown: () => calls.push("shutdown"),
		},
	);

	assert.deepEqual(result, { action: "handled" });
	assert.deepEqual(calls, ["abort", "shutdown"]);
});

test("unrelated input passes through untouched", () => {
	const { input } = loadExtension();
	const result = input(
		{ text: "hello", source: "interactive" },
		{
			isIdle: () => true,
			abort: () => assert.fail("must not abort"),
			shutdown: () => assert.fail("must not shutdown"),
		},
	);

	assert.deepEqual(result, { action: "continue" });
});
