import assert from "node:assert/strict";
import test from "node:test";
import { createCompactRenderers } from "../extensions/compact-tools/renderer.ts";
import { terminalLineWidth } from "../extensions/ui/terminal-text.ts";
import { diffLines } from "../extensions/mutation-view/diff.ts";
import {
	createEditFrameComponent,
	editCollapsedBody,
	editFrameRows,
	parseEditArgs,
	parseNativeEditDiff,
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

test("parseNativeEditDiff récupère type, numéro réel et indentation", () => {
	assert.deepEqual(parseNativeEditDiff("  9 context\n-10   old\n+10   new\n     ..."), [
		{ kind: "context", lineNumber: 9, text: "context" },
		{ kind: "removed", lineNumber: 10, text: "  old" },
		{ kind: "added", lineNumber: 10, text: "  new" },
		{ kind: "context", text: "..." },
	]);
});

test("editFrameRows rend une mutation ouverte avec stats et chemin", () => {
	const edits = [{ oldText: "a\nb\nc", newText: "a\nB\nc" }];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("/a/f.ts", edits, diffs, 80, theme);
	assert.equal(rows.length, 8); // titre + respiration + 4 lignes + respiration + pied
	const plain = rows.map(stripAnsi);
	assert.match(plain[0], /^┌ edit ─ \/a\/f\.ts ─+ −1 \+1 · 1 édition$/);
	assert.equal(plain[1], "│ ");
	assert.match(plain[2], /^│ {3}a$/);
	assert.match(plain[3], /^│ - b$/);
	assert.match(plain[4], /^│ \+ B$/);
	assert.match(plain[5], /^│ {3}c$/);
	assert.equal(plain[6], "│ ");
	assert.equal(plain[7], "  ctrl+o · diff complet");
});

test("editFrameRows surligne suppressions et ajouts sur toute la ligne", () => {
	const edits = [{ oldText: "before", newText: "after" }];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("src/f.ts", edits, diffs, 40, {
		...theme,
		getColorMode: () => "truecolor",
	});
	assert.match(rows[2], /\x1b\[48;2;235;207;217m/);
	assert.match(rows[3], /\x1b\[48;2;213;229;215m/);
	assert.ok(rows[2].endsWith("\x1b[49m"));
	assert.ok(rows[3].endsWith("\x1b[49m"));
	assert.match(rows[2], /\u00a0+\x1b\[49m$/);
	assert.match(rows[3], /\u00a0+\x1b\[49m$/);
	assert.equal(stripAnsi(rows[2]).length, 35);
	assert.equal(stripAnsi(rows[3]).length, 35);
});

test("editFrameRows sépare plusieurs éditions par un repère", () => {
	const edits = [
		{ oldText: "a", newText: "A" },
		{ oldText: "b", newText: "B" },
	];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("/a/f.ts", edits, diffs, 80, theme);
	const plain = rows.map(stripAnsi);
	assert.match(plain[0], /−2 \+2 · 2 éditions/);
	assert.match(plain[2], /^│ - a/);
	assert.match(plain[3], /^│ \+ A/);
	assert.equal(plain[4], "│ ··· édition 2/2");
	assert.match(plain[5], /^│ - b/);
});

test("editFrameRows plafonne à 18 lignes avec fondu et compteur", () => {
	const oldText = Array.from({ length: 30 }, (_, i) => `ligne ${i}`).join("\n");
	const newText = oldText.replace("ligne 5", "LIGNE 5");
	const edits = [{ oldText, newText }];
	const diffs = edits.map((edit) => diffLines(edit.oldText, edit.newText));
	const rows = editFrameRows("/a/f.ts", edits, diffs, 80, theme);
	const plain = rows.map(stripAnsi);
	// titre + respiration + 18 lignes + points + respiration + pied
	assert.equal(rows.length, 23);
	assert.equal(plain[rows.length - 3], "│ · · ·");
	assert.equal(plain[rows.length - 2], "│ ");
	assert.match(plain[rows.length - 1], /\+13 lignes masquées · ctrl\+o/);
});

test("createEditFrameComponent garde une marge de gouttière à droite", () => {
	const edits = [{ oldText: "a", newText: "A" }];
	const component = createEditFrameComponent("/a/chemin/tres-long/f.ts", edits, theme);
	const narrow = component.render(24).map(stripAnsi);
	const regular = component.render(80).map(stripAnsi);
	const wide = component.render(160).map(stripAnsi);
	assert.ok(narrow.every((row) => row.length <= 24));
	assert.ok(regular.every((row) => row.length <= 80));
	assert.ok(wide.every((row) => row.length <= 155));
	assert.equal(wide[0].length, 155);
	assert.match(narrow[0], /^┌ edit ─ f\.ts/);
	assert.doesNotMatch(narrow[0], /édition/);
	assert.match(regular[0], /^┌ edit ─/);
});

test("editFrameRows borne aussi les glyphes plus larges que la colonne disponible", () => {
	const rows = editFrameRows(
		"f.ts",
		[{ oldText: "a", newText: "界" }],
		[[{ kind: "added", lineNumber: 1, text: "界" }]],
		10,
		theme,
	);
	assert.ok(rows.every((row) => terminalLineWidth(row) <= 10));
});

test("editFrameRows wrappe le code long sans ellipsis et répète le fond", () => {
	const longText = "const value = " + "x".repeat(240);
	const rows = editFrameRows(
		"src/long.ts",
		[{ oldText: "old", newText: longText }],
		[[{ kind: "added", lineNumber: 128, text: longText }]],
		180,
		{ ...theme, getColorMode: () => "truecolor" },
	);
	const codeRows = rows.slice(2, -2);
	assert.equal(stripAnsi(rows[0]).length, 172);
	assert.equal(codeRows.length, 2);
	assert.ok(codeRows.every((row) => row.includes("\x1b[48;2;213;229;215m")));
	assert.doesNotMatch(codeRows.map(stripAnsi).join(""), /…/);
	assert.match(stripAnsi(codeRows[0]), /^│ \+ 128 │ const value/);
	assert.match(stripAnsi(codeRows[1]), /^│ {7}│ x/);
});

function fakeNativeEdit(): CompactToolDefinition {
	return {
		name: "edit",
		label: "edit",
		parameters: {},
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
		renderCall: () => ({ render: () => ["NATIVE_EDIT_CALL"], invalidate() {} }),
		renderResult: () => ({ render: () => ["NATIVE_FULL_DIFF"], invalidate() {} }),
	};
}

function editRenderers(): ReturnType<typeof createCompactRenderers> {
	return createCompactRenderers("edit", () => fakeNativeEdit(), {
		resultBody: editCollapsedBody,
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
		{
			content: [{ type: "text", text: "ok" }],
			details: { diff: "-1 x\n+1 y" },
			isError: false,
		},
		{ expanded: false },
		theme,
		context,
	);
	assert.match(stripAnsi(body.render(80)[0]), /^┌ edit ─/);
	assert.equal(context.state.status, "ok");
	assert.deepEqual(row.render(80), [], "la row réussie ne s'affiche plus");
});

test("les renderers edit gardent la DA mutation en vue étendue", () => {
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

	const expandedContext = fakeContext({
		args: { path: "/a/f.ts", oldText: "ancienne", newText: "nouvelle" },
		expanded: true,
	});
	const expandedRow = renderers.renderCall({ path: "/a/f.ts" }, theme, expandedContext);
	const expandedBody = renderers.renderResult!(
		{
			content: [{ type: "text", text: "ok" }],
			details: { diff: Array.from({ length: 24 }, (_, index) => `+${index + 1} ligne ${index + 1}`).join("\n") },
			isError: false,
		},
		{ expanded: true },
		theme,
		expandedContext,
	);
	assert.deepEqual(expandedRow.render(80), ["✓ edit · f.ts"]);
	const rows = expandedBody.render(80).map(stripAnsi);
	assert.match(rows[0], /^┌ edit ─/);
	assert.ok(rows.some((line) => line.includes("ligne 24")));
	assert.ok(rows.some((line) => line.includes("ctrl+o · replier")));
	assert.ok(rows.every((line) => !line.includes("NATIVE")));
});
