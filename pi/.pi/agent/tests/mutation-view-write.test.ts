import assert from "node:assert/strict";
import test from "node:test";
import { createCompactRenderers } from "../extensions/compact-tools/renderer.ts";
import type { CompactRenderContext } from "../extensions/compact-tools/types.ts";
import {
	createWriteFrameComponent,
	parseWriteArgs,
	writeCollapsedBody,
	writeDiffLines,
	writeFrameRows,
} from "../extensions/mutation-view/write.ts";

const theme = {
	fg: (_role: string, text: string) => text,
	bold: (text: string) => text,
};
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const stripAnsi = (text: string) => text.replace(ANSI_PATTERN, "");

function context(overrides: Partial<CompactRenderContext> = {}): CompactRenderContext {
	return {
		state: {},
		cwd: "/proj",
		executionStarted: false,
		expanded: false,
		args: undefined,
		...overrides,
	};
}

test("parseWriteArgs accepte path/file_path et exige un contenu string", () => {
	assert.deepEqual(parseWriteArgs({ path: "/a/f.ts", content: "x" }), {
		path: "/a/f.ts",
		content: "x",
	});
	assert.deepEqual(parseWriteArgs({ file_path: "/a/f.ts", content: "" }), {
		path: "/a/f.ts",
		content: "",
	});
	assert.equal(parseWriteArgs({ path: "/a/f.ts" }), undefined);
	assert.equal(parseWriteArgs({ path: "/a/f.ts", content: 42 }), undefined);
});

test("writeDiffLines normalise CRLF et retire les fins vides", () => {
	assert.deepEqual(writeDiffLines("a\r\n\r\nb\n"), [
		{ kind: "added", text: "a", lineNumber: 1 },
		{ kind: "added", text: "", lineNumber: 2 },
		{ kind: "added", text: "b", lineNumber: 3 },
	]);
	assert.deepEqual(writeDiffLines(""), []);
});

test("writeFrameRows reprend la mutation ouverte avec des lignes ajoutées", () => {
	const rows = writeFrameRows("/a/f.ts", "a\nb\n", 80, theme).map(stripAnsi);
	assert.match(rows[0], /^┌ write ─ \/a\/f\.ts ─+ \+2 lignes$/);
	assert.equal(rows[1], "│ ");
	assert.equal(rows[2], "│ + 1 │ a");
	assert.equal(rows[3], "│ + 2 │ b");
	assert.equal(rows[4], "│ ");
	assert.equal(rows[5], "  ctrl+o · contenu complet");
});

test("writeFrameRows plafonne et fond comme edit", () => {
	const content = Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n");
	const rows = writeFrameRows("/a/f.ts", content, 80, theme).map(stripAnsi);
	assert.equal(rows.length, 23);
	assert.equal(rows[rows.length - 3], "│ · · ·");
	assert.equal(rows[rows.length - 2], "│ ");
	assert.match(rows[rows.length - 1], /\+12 lignes masquées · ctrl\+o/);
});

test("createWriteFrameComponent reste responsive avec une marge de gouttière", () => {
	const component = createWriteFrameComponent("/a/f.ts", "a\nb", theme);
	assert.ok(component.render(40).every((row) => stripAnsi(row).length <= 40));
	assert.ok(component.render(80).every((row) => stripAnsi(row).length <= 80));
	const wide = component.render(160).map(stripAnsi);
	assert.ok(wide.every((row) => row.length <= 154));
	assert.equal(wide[0].length, 154);
});

test("writeCollapsedBody rend le cadre sur succès et rien sur erreur", () => {
	const ctx = context({ args: { path: "/a/f.ts", content: "a\nb" } });
	const success = writeCollapsedBody({ content: [], isError: false }, {}, theme, ctx);
	assert.match(stripAnsi(success.render(80)[0]), /^┌ write ─/);
	const error = writeCollapsedBody({ content: [], isError: true }, {}, theme, ctx);
	assert.deepEqual(error.render(80), []);
});

test("write expand conserve la DA mutation et révèle tout le contenu", () => {
	const content = Array.from({ length: 24 }, (_, index) => `ligne ${index + 1}`).join("\n");
	const renderers = createCompactRenderers("write", undefined, {
		resultBody: writeCollapsedBody,
	});
	const ctx = context({ args: { path: "/a/f.ts", content }, expanded: true });
	const row = renderers.renderCall({ path: "/a/f.ts", content }, theme, ctx);
	const body = renderers.renderResult!(
		{ content: [], isError: false },
		{ expanded: true },
		theme,
		ctx,
	);

	assert.deepEqual(row.render(80), ["✓ write · f.ts"]);
	const rows = body.render(80).map(stripAnsi);
	assert.match(rows[0], /^┌ write ─/);
	assert.ok(rows.some((line) => line.includes("ligne 24")));
	assert.ok(rows.some((line) => line.includes("ctrl+o · replier")));
});
