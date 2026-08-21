import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../");
const patcher = join(repoRoot, "scripts/pi-patch-tool-execution.py");

const ORIGINAL = `            if (contentLines.length > 0) {
                lines.push("");
                lines.push(...contentLines);
            }
            const callRenderer = this.getCallRenderer();
            if (!callRenderer) {
                renderContainer.addChild(this.createCallFallback());
                hasContent = true;
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

test("patcher self-test", () => {
	const result = spawnSync("python3", [patcher], {
		env: { ...process.env, PI_PATCH_SELF_TEST: "1" },
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /self-test ok/);
});

test("patcher makes self-render spacing opt-in and is idempotent", () => {
	const dir = mkdtempSync(join(tmpdir(), "pi-patch-"));
	const file = join(dir, "tool-execution.js");
	writeFileSync(file, ORIGINAL);

	const first = patch(file);
	assert.equal(first.status, 0, first.stderr);
	const patched = readFileSync(file, "utf8");
	assert.match(patched, /rendererState\.compactSpacing !== true/);
	assert.match(patched, /lines\.push\(""\)/);
	assert.match(patched, /const callRenderer = this\.getCallRenderer\(\)/);
	assert.doesNotMatch(patched, /skipCollapsedCall/);

	const second = patch(file);
	assert.equal(second.status, 0, second.stderr);
	assert.match(second.stdout, /already patched/);
	assert.equal(readFileSync(file, "utf8"), patched);
	rmSync(dir, { recursive: true, force: true });
});
