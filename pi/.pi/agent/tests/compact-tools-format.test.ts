import assert from "node:assert/strict";
import { test } from "node:test";
import {
	bashHeader,
	editHeader,
	findHeader,
	grepHeader,
	joinCollapsed,
	lsHeader,
	readHeader,
	showCallLine,
	writeHeader,
} from "../extensions/compact-tools/format.ts";

const identity = (path: string): string => path;

test("collapsed lines are a single header · meta pair", () => {
	assert.equal(joinCollapsed("read compact-tools.ts", "387 lines"), "read compact-tools.ts · 387 lines");
	assert.equal(joinCollapsed("grep /renderShell/ in .", "12 matches"), "grep /renderShell/ in . · 12 matches");
	assert.equal(joinCollapsed("$ git status", "terminé"), "$ git status · terminé");
});

test("headers stay one line for typical args", () => {
	assert.equal(readHeader({ path: "compact-tools.ts" }, identity), "read compact-tools.ts");
	assert.equal(readHeader({ path: "a.ts", offset: 10, limit: 5 }, identity), "read a.ts:10-14");
	assert.equal(bashHeader({ command: "git status" }), "$ git status");
	assert.equal(bashHeader({ command: "printf foo\nprintf bar" }), "$ printf foo ↵ printf bar");
	assert.equal(editHeader({ path: "Makefile" }, identity), "edit Makefile");
	assert.equal(writeHeader({ path: "a.ts", content: "a\nb\n" }, identity), "write a.ts (3 lines)");
	assert.equal(grepHeader({ pattern: "renderShell", path: "." }, identity), "grep /renderShell/ in .");
	assert.equal(findHeader({ pattern: "*.ts", path: "pi" }, identity), "find *.ts in pi");
	assert.equal(lsHeader({ path: "pi/.pi/agent" }, identity), "ls pi/.pi/agent");
});

test("call line stays visible only while running or expanded", () => {
	assert.equal(showCallLine({ expanded: false, isPartial: true }), true);
	assert.equal(showCallLine({ expanded: true, isPartial: false }), true);
	assert.equal(showCallLine({ expanded: false, isPartial: false }), false);
});

test("collapsed output has no blank lines", () => {
	const lines = [
		joinCollapsed(readHeader({ path: "a.ts" }, identity), "12 lines"),
		joinCollapsed(grepHeader({ pattern: "x", path: "." }, identity), "3 matches"),
		joinCollapsed(bashHeader({ command: "pwd" }), "1 lines"),
	];
	assert.equal(lines.join("\n").includes("\n\n"), false);
	assert.equal(lines.every((line) => !line.includes("\n")), true);
});
