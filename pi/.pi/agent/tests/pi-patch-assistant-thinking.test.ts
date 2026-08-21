import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../");
const patcher = join(repoRoot, "scripts/pi-patch-assistant-thinking.py");

const ORIGINAL = `        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));
        if (hasVisibleContent) {
            this.contentContainer.addChild(new Spacer(1));
        }
                if (this.hideThinkingBlock) {
                    // Show one static label for each run of thinking blocks when hidden.
                    this.contentContainer.addChild(new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0));
                }
                const hasVisibleContentAfter = message.content
                    .slice(i + 1)
                    .some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));
                if (hasVisibleContentAfter) {
                    this.contentContainer.addChild(new Spacer(1));
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

test("assistant thinking patcher self-test", () => {
	const result = spawnSync("python3", [patcher], {
		env: { ...process.env, PI_PATCH_SELF_TEST: "1" },
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /self-test ok/);
});

test("empty hidden labels skip spacer and text, idempotently", () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-think-"));
	const file = join(dir, "assistant-message.js");
	writeFileSync(file, ORIGINAL);

	const first = patch(file);
	assert.equal(first.status, 0, first.stderr);
	const patched = readFileSync(file, "utf8");
	assert.match(patched, /thinkingVisible/);
	assert.match(patched, /hiddenThinkingLabel\.trim\(\)/);
	assert.match(patched, /hasVisibleTextBefore/);
	assert.match(patched, /\(thinkingVisible \|\| hasVisibleTextBefore\) && hasVisibleContentAfter/);
	assert.doesNotMatch(patched, /Show one static label for each run of thinking blocks when hidden/);

	const second = patch(file);
	assert.equal(second.status, 0, second.stderr);
	assert.match(second.stdout, /already patched/);
	assert.equal(readFileSync(file, "utf8"), patched);
	rmSync(dir, { recursive: true, force: true });
});
