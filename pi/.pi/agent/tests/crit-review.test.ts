import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCritProcess } from "../extensions/crit-process.ts";
import { formatCritOutput, formatCritProgress } from "../extensions/crit-review-output.ts";

const output = formatCritOutput({
	stdout: "apply these comments\nrun crit --session abc",
	stderr: "approved: false",
	code: 0,
	killed: false,
});
assert.match(output, /Crit instructions \(stdout\):\napply these comments/);
assert.match(output, /run crit --session abc/);
assert.match(output, /Crit status \(stderr\):\napproved: false/);
assert.match(output, /exited with code 0/);
assert.equal(
	formatCritProgress({ stdout: "Review URL: http://localhost:1234", stderr: "", code: 0, killed: false }),
	"Review URL: http://localhost:1234",
);

const progress: string[] = [];
const completed = await runCritProcess(
	process.execPath,
	["-e", "process.stdout.write('Review URL: http://localhost:1234\\n'); setTimeout(() => process.exit(0), 30)"],
	process.cwd(),
	undefined,
	(result) => progress.push(result.stdout),
);
assert.equal(completed.code, 0);
assert.equal(completed.killed, false);
assert.ok(progress.some((value) => value.includes("Review URL:")), "startup URL must be published before completion");

const controller = new AbortController();
setTimeout(() => controller.abort(), 20);
const cancelled = await runCritProcess(
	process.execPath,
	["-e", "setInterval(() => {}, 1000)"],
	process.cwd(),
	controller.signal,
	undefined,
);
assert.equal(cancelled.killed, true);
assert.notEqual(cancelled.code, 0);
assert.match(formatCritOutput(cancelled), /cancelled/);

const source = readFileSync(new URL("../extensions/crit-review.ts", import.meta.url), "utf8");
assert.match(source, /runCritProcess\("crit", params\.arguments/);
assert.doesNotMatch(source, /timeout:/);
assert.match(source, /result\.killed \|\| result\.code !== 0/);
assert.match(source, /pi\.registerCommand\("cg"/);
assert.match(source, /"\/skill:crit-guided"/);
assert.match(source, /expandPromptTemplates: true/);

console.log("crit-review tests passed");
