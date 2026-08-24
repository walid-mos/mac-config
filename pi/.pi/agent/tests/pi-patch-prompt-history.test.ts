import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../");
const patcher = join(repoRoot, "scripts/pi-patch-prompt-history.py");

const ORIGINAL = `import { getKeybindings } from "../keybindings.js";
const graphemeSegmenter = getGraphemeSegmenter();
    history = [];
        if (this.history.length > 100) {
            this.history.pop();
        }`;

function patch(file: string) {
	return spawnSync(
		"python3",
		[
			"-c",
			`from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("patcher", ${JSON.stringify(patcher)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.patch_file(Path(${JSON.stringify(file)})))`,
		],
		{ encoding: "utf8" },
	);
}

test("prompt history patcher self-test", () => {
	const result = spawnSync("python3", [patcher], {
		env: { ...process.env, PI_PATCH_SELF_TEST: "1" },
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /self-test ok/);
});

test("prompt history is loaded and saved idempotently", () => {
	const directory = mkdtempSync(join(tmpdir(), "pi-prompt-history-"));
	const file = join(directory, "editor.js");
	writeFileSync(file, ORIGINAL);

	const first = patch(file);
	assert.equal(first.status, 0, first.stderr);
	const patched = readFileSync(file, "utf8");
	assert.match(patched, /createHash/);
	assert.match(patched, /loadPromptHistory/);
	assert.match(patched, /history = loadPromptHistory\(\)/);
	assert.match(patched, /savePromptHistory\(trimmed\)/);
	assert.match(patched, /appendFileSync/);
	assert.match(patched, /mode: 0o600/);

	const second = patch(file);
	assert.equal(second.status, 0, second.stderr);
	assert.match(second.stdout, /already patched/);
	assert.equal(readFileSync(file, "utf8"), patched);
	rmSync(directory, { recursive: true, force: true });
});
