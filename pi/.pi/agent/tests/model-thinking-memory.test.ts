import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createThinkingMemory,
	decideThinkingLevelWrite,
	loadThinkingMemoryFile,
	parseThinkingMemoryCommand,
	parseThinkingMemoryFile,
	saveThinkingMemoryFile,
	type ThinkingLevel,
} from "../extensions/model-thinking-memory.ts";

function testCorruptAndBareJsonAreTolerated(): void {
	assert.deepEqual(parseThinkingMemoryFile(""), {});
	assert.deepEqual(parseThinkingMemoryFile("not-json"), {});
	assert.deepEqual(parseThinkingMemoryFile("null"), {});
	assert.deepEqual(parseThinkingMemoryFile("[]"), {});
	assert.deepEqual(
		parseThinkingMemoryFile(
			JSON.stringify({
				version: 1,
				levels: {
					"openai/gpt": "medium",
					bad: "high",
					"deepseek/chat": "nope",
					"anthropic/sonnet": "low",
				},
			}),
		),
		{ "openai/gpt": "medium", "anthropic/sonnet": "low" },
	);
	assert.deepEqual(parseThinkingMemoryFile(JSON.stringify({ "openai/gpt": "high" })), {
		"openai/gpt": "high",
	});
}

function testMissingFileLoadsEmpty(): void {
	assert.deepEqual(loadThinkingMemoryFile(join(tmpdir(), "missing-thinking-memory.json")), {});
}

function testAtomicSaveRoundTrip(): void {
	const directory = mkdtempSync(join(tmpdir(), "thinking-memory-"));
	const path = join(directory, "model-thinking-memory.json");
	try {
		saveThinkingMemoryFile(path, { "openai/gpt": "medium", "deepseek/chat": "high" });
		assert.deepEqual(loadThinkingMemoryFile(path), {
			"openai/gpt": "medium",
			"deepseek/chat": "high",
		});
		const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
		assert.equal(typeof raw === "object" && raw !== null && "version" in raw, true);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

function testClampDoesNotWriteNewModelAndSnapshotsOld(): void {
	assert.deepEqual(
		decideThinkingLevelWrite({
			restoring: false,
			lastModelKey: undefined,
			currentModelKey: "deepseek/chat",
			level: "high",
			previousLevel: "medium",
		}),
		undefined,
	);
	assert.deepEqual(
		decideThinkingLevelWrite({
			restoring: false,
			lastModelKey: "openai/gpt",
			currentModelKey: "deepseek/chat",
			level: "high",
			previousLevel: "medium",
		}),
		{ modelKey: "openai/gpt", level: "medium" },
	);
	assert.deepEqual(
		decideThinkingLevelWrite({
			restoring: false,
			lastModelKey: "openai/gpt",
			currentModelKey: "deepseek/chat",
			level: "high",
			previousLevel: undefined,
		}),
		undefined,
	);
	assert.deepEqual(
		decideThinkingLevelWrite({
			restoring: true,
			lastModelKey: "openai/gpt",
			currentModelKey: "openai/gpt",
			level: "medium",
			previousLevel: "high",
		}),
		undefined,
	);
	assert.deepEqual(
		decideThinkingLevelWrite({
			restoring: false,
			lastModelKey: "openai/gpt",
			currentModelKey: "openai/gpt",
			level: "low",
			previousLevel: "medium",
		}),
		{ modelKey: "openai/gpt", level: "low" },
	);
}

function testFreeSwitchRestoresManualLevelAndIgnoresClamp(): void {
	const writes: Array<Record<string, ThinkingLevel>> = [];
	const memory = createThinkingMemory({
		levels: { "openai/gpt": "medium" },
		persist: (levels) => writes.push({ ...levels }),
	});

	memory.selectModel("openai/gpt", "medium", () => {
		assert.fail("startup clamp must not rewrite a matching stored level");
	});
	memory.noteThinkingLevel({ currentModelKey: "openai/gpt", level: "low", previousLevel: "medium" });
	assert.deepEqual(memory.list(), { "openai/gpt": "low" });
	assert.equal(writes.length, 1);

	memory.noteThinkingLevel({
		currentModelKey: "deepseek/chat",
		level: "high",
		previousLevel: "low",
	});
	assert.deepEqual(memory.list(), { "openai/gpt": "low" });

	let applied: ThinkingLevel | undefined;
	memory.selectModel("deepseek/chat", "high", (level) => {
		applied = level;
		memory.noteThinkingLevel({
			currentModelKey: "deepseek/chat",
			level,
			previousLevel: "high",
		});
	});
	assert.equal(applied, undefined);
	assert.equal(memory.list()["deepseek/chat"], undefined);

	memory.noteThinkingLevel({
		currentModelKey: "openai/gpt",
		level: "high",
		previousLevel: "high",
	});
	applied = undefined;
	memory.selectModel("openai/gpt", "high", (level) => {
		applied = level;
		memory.noteThinkingLevel({
			currentModelKey: "openai/gpt",
			level,
			previousLevel: "high",
		});
	});
	assert.equal(applied, "low");
	assert.deepEqual(memory.list(), { "openai/gpt": "low", "deepseek/chat": "high" });
	assert.equal(writes.length, 2);
}

function testClampSnapshotsPreviousModelWithoutTouchingTarget(): void {
	const memory = createThinkingMemory({
		levels: { "openai/gpt": "low" },
	});
	memory.selectModel("openai/gpt", "low", () => {
		assert.fail("matching stored level must not restore");
	});
	memory.noteThinkingLevel({
		currentModelKey: "deepseek/chat",
		level: "high",
		previousLevel: "low",
	});
	assert.deepEqual(memory.list(), { "openai/gpt": "low" });
	assert.equal(memory.list()["deepseek/chat"], undefined);

	memory.selectModel("deepseek/chat", "high", () => {
		assert.fail("no stored DeepSeek preference");
	});
	memory.noteThinkingLevel({
		currentModelKey: "deepseek/chat",
		level: "high",
		previousLevel: "high",
	});
	assert.deepEqual(memory.list(), { "openai/gpt": "low", "deepseek/chat": "high" });

	let applied: ThinkingLevel | undefined;
	memory.noteThinkingLevel({
		currentModelKey: "openai/gpt",
		level: "high",
		previousLevel: "high",
	});
	memory.selectModel("openai/gpt", "high", (level) => {
		applied = level;
		memory.noteThinkingLevel({
			currentModelKey: "openai/gpt",
			level,
			previousLevel: "high",
		});
	});
	assert.equal(applied, "low");
	assert.deepEqual(memory.list(), { "openai/gpt": "low", "deepseek/chat": "high" });
}

function testInitialClampIsNotRemembered(): void {
	const memory = createThinkingMemory();
	memory.noteThinkingLevel({ currentModelKey: "deepseek/chat", level: "high" });
	memory.selectModel("deepseek/chat", "high", () => {
		assert.fail("no stored preference to restore");
	});
	assert.deepEqual(memory.list(), {});
	memory.noteThinkingLevel({ currentModelKey: "deepseek/chat", level: "high" });
	assert.deepEqual(memory.list(), { "deepseek/chat": "high" });
}

function testRestoreDoesNotPersistClampedResult(): void {
	const memory = createThinkingMemory({
		levels: { "openai/gpt": "medium" },
	});
	memory.selectModel("openai/gpt", "high", (level) => {
		assert.equal(level, "medium");
		memory.noteThinkingLevel({
			currentModelKey: "openai/gpt",
			level: "high",
			previousLevel: "high",
		});
	});
	assert.deepEqual(memory.list(), { "openai/gpt": "medium" });
}

function testResetCommands(): void {
	const memory = createThinkingMemory({
		levels: { "openai/gpt": "low", "deepseek/chat": "high" },
	});
	assert.equal(memory.reset("missing/model"), false);
	assert.equal(memory.reset("openai/gpt"), true);
	assert.deepEqual(memory.list(), { "deepseek/chat": "high" });
	memory.resetAll();
	assert.deepEqual(memory.list(), {});
}

function testCommandParsing(): void {
	assert.deepEqual(parseThinkingMemoryCommand(""), { type: "list" });
	assert.deepEqual(parseThinkingMemoryCommand("  reset  "), { type: "reset", scope: "current" });
	assert.deepEqual(parseThinkingMemoryCommand("reset all"), { type: "reset", scope: "all" });
	assert.deepEqual(parseThinkingMemoryCommand("nope"), { type: "unknown", args: "nope" });
}

function testCorruptOnDiskFileIsIgnoredThenReplaced(): void {
	const directory = mkdtempSync(join(tmpdir(), "thinking-memory-"));
	const path = join(directory, "model-thinking-memory.json");
	try {
		writeFileSync(path, "{not json");
		assert.deepEqual(loadThinkingMemoryFile(path), {});
		saveThinkingMemoryFile(path, { "openai/gpt": "medium" });
		assert.deepEqual(loadThinkingMemoryFile(path), { "openai/gpt": "medium" });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

const tests: Array<[string, () => void]> = [
	["corrupt and bare JSON are tolerated", testCorruptAndBareJsonAreTolerated],
	["missing file loads empty", testMissingFileLoadsEmpty],
	["atomic save round-trips", testAtomicSaveRoundTrip],
	["clamp does not write new model and snapshots old", testClampDoesNotWriteNewModelAndSnapshotsOld],
	["free switch restores manual level and ignores clamp", testFreeSwitchRestoresManualLevelAndIgnoresClamp],
	["clamp snapshots previous model without touching target", testClampSnapshotsPreviousModelWithoutTouchingTarget],
	["initial clamp is not remembered", testInitialClampIsNotRemembered],
	["restore does not persist clamped result", testRestoreDoesNotPersistClampedResult],
	["reset commands forget keys", testResetCommands],
	["command parsing", testCommandParsing],
	["corrupt on-disk file is ignored then replaced", testCorruptOnDiskFileIsIgnoredThenReplaced],
];

for (const [name, test] of tests) {
	test();
	console.log(`ok  ${name}`);
}
console.log(`${tests.length} passed`);
