import assert from "node:assert/strict";
import test from "node:test";
import { createCompactRenderers } from "../extensions/compact-tools/renderer.ts";
import { diffLines } from "../extensions/mutation-view/diff.ts";
import {
	createEditFrameComponent,
	editCollapsedBody,
	editFrameRows,
	parseEditArgs,
} from "../extensions/mutation-view/edit.ts";
import type {
	CompactRenderContext,
	CompactToolDefinition,
} from "../extensions/compact-tools/types.ts";

const theme = {
	fg: (_role: string, text: string) => text,
	bold: (text: string) => text,
};

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_PATTERN, "");
}

test("diffLines marque contextes, suppressions et ajouts", () => {
	const diff = diffLines("a\nb\nc", "a\nB\nc");
	assert.deepEqual(diff, [
		{ kind: "context", text: "a" },
		{ kind: "removed", text: "b" },
		{ kind: "added", text: "B" },
		{ kind: "context", text: "c" },
	]);
});

test("diffLines gère création, suppression totale et textes identiques", () => {
	assert.deepEqual(diffLines("", "x\ny"), [
		{ kind: "added", text: "x" },
		{ kind: "added", text: "y" },
	]);
	assert.deepEqual(diffLines("x\ny", ""), [
		{ kind: "removed", text: "x" },
		{ kind: "removed", text: "y" },
	]);
	const same = diffLines("a\nb", "a\nb");
	assert.ok(same.every((line) => line.kind === "context"));
	assert.equal(same.length, 2);
});

test("diffLines borne les remplacements massifs sans table LCS", () => {
	const oldText = Array.from({ length: 50 }, (_, i) => `old ${i}`).join("\n");
	const newText = Array.from({ length: 50 }, (_, i) => `new ${i}`).join("\n");
	const diff = diffLines(oldText, newText);
	assert.equal(diff.filter((line) => line.kind === "removed").length, 50);
	assert.equal(diff.filter((line) => line.kind === "added").length, 50);
	assert.equal(diff.some((line) => line.kind === "context"), false);
});

test("parseEditArgs accepte edits[], edits en JSON string et la paire legacy", () => {
	assert.deepEqual(
		parseEditArgs({ path: "/a/f.ts", edits: [{ oldText: "x", newText: "y" }] }),
		{ path: "/a/f.ts", edits: [{ oldText: "x", newText: "y" }] },
	);
	assert.deepEqual(
		parseEditArgs({ path: "/a/f.ts", edits: JSON.stringify([{ oldText: "x", newText: "y" }]) }),
		{ path: "/a/f.ts", edits: [{ oldText: "x", newText: "y" }] },
	);
	assert.deepEqual(parseEditArgs({ path: "/a/f.ts", oldText: "x", newText: "y" }), {
		path: "/a/f.ts",
		edits: [{ oldText: "x", newText: "y" }],
	});
	assert.equal(parseEditArgs({ path: "/a/f.ts" }), undefined);
	assert.equal(parseEditArgs({ path: "/a/f.ts", edits: "{broken" }), undefined);
	assert.equal(parseEditArgs(undefined), undefined);
});

test("editFrameRows encadre les diffs dans un cadre titré", () => {
	const edits = [{ oldText: "a\nb\nc", newText: "a\nB\nc" }];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("/a/f.ts", edits, diffs, 80, theme);
	assert.equal(rows.length, 6); // titre + 4 lignes de diff + pied
	const plain = rows.map(stripAnsi);
	assert.match(plain[0], /^╭─ edit · f\.ts · 1 édition ─+╮$/);
	assert.match(plain[1], /^\│ {3}a.*│$/);
	assert.match(plain[2], /^\│ - b.*│$/);
	assert.match(plain[3], /^\│ \+ B.*│$/);
	assert.match(plain[4], /^\│ {3}c.*│$/);
	assert.match(plain[5], /^╰─ ctrl\+o · diff natif ─+╯$/);
});

test("editFrameRows sépare plusieurs éditions par une ligne vide", () => {
	const edits = [
		{ oldText: "a", newText: "A" },
		{ oldText: "b", newText: "B" },
	];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("/a/f.ts", edits, diffs, 80, theme);
	const plain = rows.map(stripAnsi);
	assert.match(plain[0], /2 éditions/);
	assert.match(plain[1], /^\│ - a/);
	assert.match(plain[2], /^\│ \+ A/);
	assert.match(plain[3], /^│ +│$/);
	assert.match(plain[4], /^\│ - b/);
});

test("editFrameRows plafonne à 18 lignes avec fondu et compteur", () => {
	const oldText = Array.from({ length: 30 }, (_, i) => `ligne ${i}`).join("\n");
	const newText = oldText.replace("ligne 5", "LIGNE 5");
	const edits = [{ oldText, newText }];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("/a/f.ts", edits, diffs, 80, theme);
	const plain = rows.map(stripAnsi);
	// titre + 18 lignes + rangée de points + pied
	assert.equal(rows.length, 21);
	assert.match(plain[rows.length - 2], /^│\s+·\s+·\s+·\s*│$/);
	assert.match(plain[rows.length - 1], /⤢ \+13 lignes · ctrl\+o/);
});

test("createEditFrameComponent rend à chaque largeur avec diffs en cache", () => {
	const edits = [{ oldText: "a", newText: "A" }];
	const component = createEditFrameComponent("/a/f.ts", edits, theme);
	const narrow = component.render(40);
	const wide = component.render(80);
	assert.ok(narrow.every((row) => stripAnsi(row).length <= 40));
	assert.ok(wide.every((row) => stripAnsi(row).length <= 80));
	assert.match(stripAnsi(wide[0]), /^╭─/);
});

function fakeNativeEdit(): CompactToolDefinition {
	return {
		name: "edit",
		label: "edit",
		parameters: {},
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
		renderResult: () => ({ render: () => ["NATIVE_FULL_DIFF"], invalidate() {} }),
	};
}

function editRenderers(): ReturnType<typeof createCompactRenderers> {
	return createCompactRenderers("edit", () => fakeNativeEdit(), {
		hideRowOnSuccess: true,
		collapsedBody: editCollapsedBody,
		stackRows: false,
	});
}

const cwd = "/proj";

function fakeContext(overrides: Partial<CompactRenderContext> = {}): CompactRenderContext {
	return {
		state: {},
		cwd,
		executionStarted: false,
		expanded: false,
		args: undefined,
		...overrides,
	};
}

test("les renderers edit masquent la row une fois le succès établi (collapsé)", () => {
	const renderers = editRenderers();
	const context = fakeContext({
		args: { path: "/a/f.ts", edits: [{ oldText: "x", newText: "y" }] },
	});
	const row = renderers.renderCall({ path: "/a/f.ts" }, theme, context);
	assert.match(row.render(80)[0], /^● edit · f\.ts$/);

	const body = renderers.renderResult!(
		{ content: [{ type: "text", text: "ok" }], isError: false },
		{ expanded: false },
		theme,
		context,
	);
	assert.match(stripAnsi(body.render(80)[0]), /^╭─/);
	assert.equal(context.state.status, "ok");
	assert.deepEqual(row.render(80), [], "la row réussie ne s'affiche plus");
});

test("les renderers edit gardent la row sur erreur et en vue étendue", () => {
	const renderers = editRenderers();
	const context = fakeContext({ args: { path: "/a/f.ts" } });
	const row = renderers.renderCall({ path: "/a/f.ts" }, theme, context);
	renderers.renderResult!(
		{ content: [{ type: "text", text: "oldText introuvable" }], isError: true },
		{ expanded: false },
		theme,
		context,
	);
	assert.equal(context.state.status, "error");
	assert.equal(context.state.summary, "oldText introuvable");
	assert.match(row.render(80)[0], /^✗ edit · f\.ts · oldText introuvable$/);

	const expandedContext = fakeContext({ args: { path: "/a/f.ts" }, expanded: true });
	const expandedRow = renderers.renderCall({ path: "/a/f.ts" }, theme, expandedContext);
	renderers.renderResult!(
		{ content: [{ type: "text", text: "ok" }], isError: false },
		{ expanded: true },
		theme,
		expandedContext,
	);
	assert.equal(expandedRow.render(80).length, 1, "la row reste visible au-dessus du diff natif");
	const expandedBody = renderers.renderResult!(
		{ content: [{ type: "text", text: "ok" }], isError: false },
		{ expanded: true },
		theme,
		expandedContext,
	);
	assert.deepEqual(expandedBody.render(80), ["NATIVE_FULL_DIFF"]);
});
