import assert from "node:assert/strict";
import test from "node:test";
import { createCompactRenderers } from "../extensions/compact-tools/renderer.ts";
import type { CompactRenderContext, CompactToolDefinition } from "../extensions/compact-tools/types.ts";
import { writeCollapsedBody } from "../extensions/write-view/body.ts";
import { createWriteFrameComponent } from "../extensions/write-view/component.ts";
import { parseWriteArgs, writeDiffLines, writeFrameRows } from "../extensions/write-view/frame.ts";

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
		{ kind: "added", text: "a" },
		{ kind: "added", text: "" },
		{ kind: "added", text: "b" },
	]);
	assert.deepEqual(writeDiffLines(""), []);
});

test("writeFrameRows reprend le cadre edit avec des lignes ajoutées", () => {
	const rows = writeFrameRows("/a/f.ts", "a\nb\n", 80, theme).map(stripAnsi);
	assert.match(rows[0], /^╭─ write · f\.ts · 2 lignes ─+╮$/);
	assert.match(rows[1], /^│ \+ a/);
	assert.match(rows[2], /^│ \+ b/);
	assert.match(rows[3], /^╰─ ctrl\+o · contenu natif ─+╯$/);
});

test("writeFrameRows plafonne et fond comme edit", () => {
	const content = Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n");
	const rows = writeFrameRows("/a/f.ts", content, 80, theme).map(stripAnsi);
	assert.equal(rows.length, 21);
	assert.match(rows[rows.length - 2], /^│\s+·\s+·\s+·\s*│$/);
	assert.match(rows[rows.length - 1], /⤢ \+12 lignes · ctrl\+o/);
});

test("createWriteFrameComponent reste responsive", () => {
	const component = createWriteFrameComponent("/a/f.ts", "a\nb", theme);
	assert.ok(component.render(40).every((row) => stripAnsi(row).length <= 40));
	assert.ok(component.render(80).every((row) => stripAnsi(row).length <= 80));
});

test("writeCollapsedBody rend le cadre sur succès et rien sur erreur", () => {
	const ctx = context({ args: { path: "/a/f.ts", content: "a\nb" } });
	const success = writeCollapsedBody({ content: [], isError: false }, {}, theme, ctx);
	assert.match(stripAnsi(success.render(80)[0]), /^╭─ write/);
	const error = writeCollapsedBody({ content: [], isError: true }, {}, theme, ctx);
	assert.deepEqual(error.render(80), []);
});

test("write expand utilise le renderCall natif sans perdre la row collapse", () => {
	let nativeComponent: { text: string; render(width: number): string[]; invalidate(): void } | undefined;
	const native: CompactToolDefinition = {
		name: "write",
		parameters: {},
		execute: async () => ({ content: [] }),
		renderCall(args, _theme, renderContext) {
			const component = (renderContext.lastComponent as typeof nativeComponent) ?? {
				text: "",
				render() { return [this.text]; },
				invalidate() {},
			};
			component.text = `NATIVE ${args.content}`;
			nativeComponent = component;
			return component;
		},
		renderResult: () => ({ render: () => [], invalidate() {} }),
	};
	const renderers = createCompactRenderers("write", () => native, {
		hideRowOnSuccess: true,
		collapsedBody: writeCollapsedBody,
		nativeCallWhenExpanded: true,
	});
	const ctx = context({ args: { path: "/a/f.ts", content: "a" } });
	const collapsed = renderers.renderCall({ path: "/a/f.ts", content: "a" }, theme, ctx);
	assert.deepEqual(collapsed.render(80), ["● write · f.ts"]);
	ctx.expanded = true;
	const expanded = renderers.renderCall({ path: "/a/f.ts", content: "a" }, theme, ctx);
	assert.deepEqual(expanded.render(80), ["NATIVE a"]);
	ctx.expanded = false;
	const collapsedAgain = renderers.renderCall({ path: "/a/f.ts", content: "a" }, theme, {
		...ctx,
		lastComponent: expanded,
	});
	assert.deepEqual(collapsedAgain.render(80), ["● write · f.ts"]);
});
