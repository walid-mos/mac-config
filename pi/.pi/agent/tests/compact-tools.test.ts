import assert from "node:assert/strict";
import test from "node:test";
import { compactRowLine } from "../extensions/compact-tools/line.ts";
import { createCompactOverrides } from "../extensions/compact-tools/overrides.ts";
import { createCompactRenderers } from "../extensions/compact-tools/renderer.ts";
import { CompactRowStack, compactRowStack } from "../extensions/compact-tools/stack.ts";
import { COMPACT_TOOLS, baseName, countTextLines, subjectFor, summarizeResult, toSingleLine } from "../extensions/compact-tools/summary.ts";
import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolDefinition,
	CompactToolResult,
} from "../extensions/compact-tools/types.ts";

const theme: CompactTheme = {
	fg: (_role, text) => text,
	bold: (text) => text,
};

function fakeNative(name: string, cwd: string): CompactToolDefinition {
	return {
		name,
		label: name,
		description: `native ${name} in ${cwd}`,
		parameters: {},
		promptSnippet: `${name} snippet`,
		promptGuidelines: [`${name} guideline`],
		execute: async () => ({ content: [{ type: "text", text: "native" }], details: {} }),
		renderResult: () => ({ render: () => ["NATIVE_RESULT"], invalidate() {} }),
	};
}

function fakeContext(overrides: Partial<CompactRenderContext> = {}): CompactRenderContext {
	return {
		state: {},
		cwd: "/proj",
		executionStarted: false,
		expanded: false,
		args: undefined,
		...overrides,
	};
}

function renderOne(component: CompactComponent, width = 80): string {
	const lines = component.render(width);
	assert.equal(lines.length, 1);
	return lines[0];
}

function stackWithTools(...tools: string[]): CompactRowStack {
	const stack = new CompactRowStack();
	for (const tool of tools) stack.registerTool(tool, true);
	return stack;
}

test("COMPACT_TOOLS couvre exactement les tools collapsés (bash appartient à pi-background)", () => {
	assert.deepEqual([...COMPACT_TOOLS], ["read", "grep", "find", "ls"]);
});

test("toSingleLine réduit les commandes multilignes", () => {
	assert.equal(toSingleLine("a\nb\r\nc"), "a b c");
});

test("baseName garde le dernier segment POSIX", () => {
	assert.equal(baseName("/a/b/agent.ts"), "agent.ts");
	assert.equal(baseName("agent.ts"), "agent.ts");
});

test("subjectFor extrait le sujet par tool", () => {
	assert.equal(subjectFor("bash", { command: "pnpm\ntest" }), "pnpm test");
	assert.equal(subjectFor("read", { path: "/a/b/agent.ts" }), "agent.ts");
	assert.equal(subjectFor("read", { path: "/a/b/agent.ts", offset: 5 }), "agent.ts dès la ligne 5");
	assert.equal(subjectFor("grep", { pattern: "foo.*bar" }), '"foo.*bar"');
	assert.equal(subjectFor("ls", { path: "/a/b/c" }), "c");
	assert.equal(subjectFor("write", { path: "/a/b/new.ts" }), "new.ts");
});

test("countTextLines compte les lignes non vides", () => {
	assert.equal(countTextLines(""), 0);
	assert.equal(countTextLines("a"), 1);
	assert.equal(countTextLines("a\nb\nc"), 3);
});

test("summarizeResult bash extrait le code de sortie du message natif", () => {
	const ok: CompactToolResult = { content: [{ type: "text", text: "out" }], isError: false };
	assert.equal(summarizeResult("bash", {}, ok), "");
	const fail: CompactToolResult = {
		content: [{ type: "text", text: "boom\nCommand exited with code 2" }],
		isError: true,
	};
	assert.equal(summarizeResult("bash", {}, fail), "exit 2");
	const timeout: CompactToolResult = {
		content: [{ type: "text", text: "err: Command timed out after 30 seconds" }],
		isError: true,
	};
	assert.equal(summarizeResult("bash", {}, timeout), "timeout 30s");
});

test("summarizeResult read utilise totalLines et marque la troncature", () => {
	const result: CompactToolResult = {
		content: [{ type: "text", text: "ligne\nligne" }],
		details: { truncation: { truncated: true, totalLines: 250 } },
	};
	assert.equal(summarizeResult("read", {}, result), "250 lignes · tronqué");
});

test("summarizeResult grep/find/ls signalent les limites atteintes", () => {
	const grep: CompactToolResult = { content: [], details: { matchLimitReached: 200 } };
	assert.equal(summarizeResult("grep", {}, grep), "200+ correspondances");
	const find: CompactToolResult = { content: [], details: { resultLimitReached: 50 } };
	assert.equal(summarizeResult("find", {}, find), "50+ résultats");
	const ls: CompactToolResult = { content: [{ type: "text", text: "a\nb" }], details: {} };
	assert.equal(summarizeResult("ls", {}, ls), "2 lignes");
});

test("subjectFor background cible l'action et le job ou la source", () => {
	assert.equal(subjectFor("background", { action: "start", source: "demo-counter" }), "start · demo-counter");
	assert.equal(subjectFor("background", { action: "read", job: "bg_1" }), "read · bg_1");
	assert.equal(subjectFor("background", { action: "list" }), "list");
});

test("summarizeResult background résume la première ligne de sortie", () => {
	const result: CompactToolResult = { content: [{ type: "text", text: "tick 1\ntick 2" }] };
	assert.equal(summarizeResult("background", {}, result), "tick 1");
});

test("summarizeResult edit/write résume la première ligne d'erreur seulement", () => {
	const ok: CompactToolResult = { content: [{ type: "text", text: "ok" }], isError: false };
	assert.equal(summarizeResult("edit", {}, ok), "");
	const fail: CompactToolResult = {
		content: [{ type: "text", text: "oldText introuvable\ndétails" }],
		isError: true,
	};
	assert.equal(summarizeResult("edit", {}, fail), "oldText introuvable");
	assert.equal(summarizeResult("write", {}, fail), "oldText introuvable");
});

test("compactRowLine compose glyphe, label, sujet et résumé", () => {
	const line = compactRowLine(
		{ tool: "bash", subject: "pnpm test", state: { status: "error", summary: "exit 1" }, theme },
		80,
		theme,
	);
	assert.equal(line, "✗ bash · pnpm test · exit 1");
});

test("compactRowLine tronque à la largeur demandée", () => {
	const line = compactRowLine(
		{ tool: "bash", subject: "x".repeat(200), state: { status: "ok" } },
		40,
		theme,
	);
	assert.ok(line.length <= 40 + "…".length);
	assert.ok(line.startsWith("✓ bash"));
});

test("createCompactOverrides produit un override par tool avec renderShell self", () => {
	const created: Array<[string, string]> = [];
	const overrides = createCompactOverrides({
		createBuiltin: (name, cwd) => {
			created.push([name, cwd]);
			return fakeNative(name, cwd);
		},
	});
	assert.equal(overrides.length, COMPACT_TOOLS.length);
	for (const definition of overrides) {
		assert.equal(definition.renderShell, "self");
		assert.equal(definition.promptSnippet, `${definition.name} snippet`);
		assert.ok(definition.promptGuidelines?.length === 1);
	}
	assert.deepEqual(created.map(([name]) => name), [...COMPACT_TOOLS]);
});

test("renderCall rend une ligne pending qui suit l'état partagé", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative });
	const context = fakeContext({ args: { path: "/a/b/agent.ts" } });
	const component = definition.renderCall!({ path: "/a/b/agent.ts" }, theme, context);
	assert.equal(renderOne(component), "● read · agent.ts");
	context.state.status = "ok";
	context.state.summary = "";
	assert.equal(renderOne(component), "✓ read · agent.ts");
	context.state.status = "error";
	context.state.summary = "erreur";
	assert.equal(renderOne(component), "✗ read · agent.ts · erreur");
});

test("renderCall seed startedAt au démarrage d'exécution", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative });
	const context = fakeContext({ executionStarted: true });
	definition.renderCall!({}, theme, context);
	assert.ok(typeof context.state.startedAt === "number");
});

test("renderResult collapsé met à jour l'état et n'affiche rien", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative });
	const context = fakeContext({ args: { command: "false" } });
	definition.renderCall!({ command: "false" }, theme, context);
	const component = definition.renderResult!(
		{ content: [{ type: "text", text: "boom\nCommand exited with code 1" }], isError: true },
		{ expanded: false },
		theme,
		context,
	);
	assert.deepEqual(component.render(80), []);
	assert.equal(context.state.status, "error");
	assert.equal(context.state.summary, "2 lignes");
	const line = renderOne(definition.renderCall!({ path: "x" }, theme, context));
	assert.equal(line, "✗ read · x · 2 lignes");
});

test("renderResult prend l'état d'erreur depuis le contexte Pi", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative });
	const context = fakeContext({ args: { path: "x" }, isError: true });
	definition.renderCall!({ path: "x" }, theme, context);
	definition.renderResult!(
		{ content: [{ type: "text", text: "lecture impossible" }] },
		{ expanded: false },
		theme,
		context,
	);
	assert.equal(context.state.status, "error");
	assert.equal(context.state.summary, "1 lignes");
});

test("renderResult étendu délègue au renderer natif", () => {
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative });
	const context = fakeContext({ args: { command: "ls" }, cwd: "/proj", expanded: true });
	const component = definition.renderResult!(
		{ content: [{ type: "text", text: "out" }], isError: false },
		{ expanded: true },
		theme,
		context,
	);
	assert.deepEqual(component.render(80), ["NATIVE_RESULT"]);
});

test("execute délègue à la définition native du cwd courant", async () => {
	const calls: string[] = [];
	const overrides = createCompactOverrides({
		createBuiltin: (name, cwd) => {
			const native = fakeNative(name, cwd);
			return {
				...native,
				execute: async () => {
					calls.push(`${name}@${cwd}`);
					return { content: [{ type: "text", text: "ok" }], details: {} };
				},
			};
		},
	});
	const read = overrides.find((definition) => definition.name === "read")!;
	await read.execute("t1", { path: "x" }, undefined, undefined, { cwd: "/elsewhere" });
	assert.deepEqual(calls, ["read@/elsewhere"]);
	await read.execute("t2", { path: "x" }, undefined, undefined, { cwd: "/elsewhere" });
	assert.equal(calls.length, 2, "le cache par cwd réutilise la même définition");
});

test("createCompactRenderers outille un tool possédé par une autre extension", () => {
	let resolved = 0;
	const renderers = createCompactRenderers("bash", () => {
		resolved += 1;
		return fakeNative("bash", "/proj");
	});
	const context = fakeContext({ args: { command: "pnpm test" } });
	const component = renderers.renderCall({ command: "pnpm test" }, theme, context);
	assert.equal(renderOne(component), "● bash · pnpm test");
	const collapsed = renderers.renderResult(
		{ content: [{ type: "text", text: "out" }], isError: false },
		{ expanded: false },
		theme,
		context,
	);
	assert.deepEqual(collapsed.render(80), []);
	assert.equal(context.state.status, "ok");
	assert.equal(renderOne(component), "✓ bash · pnpm test");
	const expanded = renderers.renderResult(
		{ content: [{ type: "text", text: "out" }], isError: false },
		{ expanded: true },
		theme,
		context,
	);
	assert.deepEqual(expanded.render(80), ["NATIVE_RESULT"]);
	assert.equal(resolved, 1, "le resolver natif n'est appelé que pour l'expand");
});

test("createCompactOverrides ignore les tools natifs inconnus", () => {
	const overrides = createCompactOverrides({
		createBuiltin: () => undefined,
		tools: ["bash", "nope"],
	});
	assert.equal(overrides.length, 0);
});

test("CompactRowStack regroupe les calls compacts consécutifs sans spacer intermédiaire", () => {
	const stack = stackWithTools("read", "grep");
	stack.rebuild([
		{ role: "user", content: "test" },
		{ role: "assistant", content: [{ type: "toolCall", id: "r1", name: "read" }] },
		{ role: "toolResult" },
		{ role: "assistant", content: [{ type: "toolCall", id: "r2", name: "read" }] },
		{ role: "assistant", content: [{ type: "toolCall", id: "r3", name: "grep" }] },
	]);
	const view = (tool: string, subject: string) => ({
		tool,
		subject,
		state: { status: "ok" as const },
		theme,
	});
	stack.attach("r1", view("read", "a.ts"), () => {});
	stack.attach("r2", view("read", "b.ts"), () => {});
	stack.attach("r3", view("grep", '"needle"'), () => {});
	assert.deepEqual(stack.render("r1", view("read", "a.ts"), 80), []);
	assert.deepEqual(stack.render("r2", view("read", "b.ts"), 80), []);
	assert.deepEqual(stack.render("r3", view("grep", '"needle"'), 80), [
		"  ✓ read · a.ts",
		" ✓ read · b.ts",
		'✓ grep · "needle"',
	]);
});

test("CompactRowStack coupe la pile sur texte visible, user et tool non enregistré", () => {
	const stack = stackWithTools("read");
	stack.rebuild([
		{ role: "assistant", content: [{ type: "toolCall", id: "r1", name: "read" }] },
		{ role: "assistant", content: [{ type: "text", text: "progression" }, { type: "toolCall", id: "r2", name: "read" }] },
		{ role: "assistant", content: [{ type: "toolCall", id: "w1", name: "write" }] },
		{ role: "assistant", content: [{ type: "toolCall", id: "r3", name: "read" }] },
		{ role: "user", content: "suite" },
		{ role: "assistant", content: [{ type: "toolCall", id: "r4", name: "read" }] },
	]);
	assert.deepEqual(stack.groups(), [["r1"], ["r2"], ["r3"], ["r4"]]);
});

test("CompactRowStack déduplique les message_update streamés", () => {
	const stack = stackWithTools("read");
	stack.beginMessage({ role: "assistant", content: [{ type: "text", text: "go" }] });
	stack.updateMessage({
		role: "assistant",
		content: [{ type: "text", text: "go" }, { type: "toolCall", id: "r1", name: "read" }],
	});
	stack.updateMessage({
		role: "assistant",
		content: [
			{ type: "text", text: "go" },
			{ type: "toolCall", id: "r1", name: "read" },
			{ type: "toolCall", id: "r2", name: "read" },
		],
	});
	stack.endMessage({
		role: "assistant",
		content: [
			{ type: "text", text: "go" },
			{ type: "toolCall", id: "r1", name: "read" },
			{ type: "toolCall", id: "r2", name: "read" },
		],
	});
	assert.deepEqual(stack.groups(), [["r1", "r2"]]);
});

test("tout renderer compact s'enregistre automatiquement dans la pile", () => {
	const stack = new CompactRowStack();
	stack.registerTool("custom_search", true);
	stack.rebuild([
		{ role: "assistant", content: [{ type: "toolCall", id: "c1", name: "custom_search" }] },
		{ role: "assistant", content: [{ type: "toolCall", id: "c2", name: "custom_search" }] },
	]);
	assert.deepEqual(stack.groups(), [["c1", "c2"]]);
});

test("les renderers délèguent la pile au dernier composant", () => {
	compactRowStack.reset();
	const [definition] = createCompactOverrides({ createBuiltin: fakeNative });
	compactRowStack.rebuild([
		{ role: "assistant", content: [{ type: "toolCall", id: "r1", name: "read" }] },
		{ role: "assistant", content: [{ type: "toolCall", id: "r2", name: "read" }] },
	]);
	const firstContext = fakeContext({ toolCallId: "r1", args: { path: "/a.ts" } });
	const secondContext = fakeContext({ toolCallId: "r2", args: { path: "/b.ts" } });
	const first = definition.renderCall!({ path: "/a.ts" }, theme, firstContext);
	const second = definition.renderCall!({ path: "/b.ts" }, theme, secondContext);
	assert.deepEqual(first.render(80), []);
	assert.deepEqual(second.render(80), [" ● read · a.ts", "● read · b.ts"]);
	compactRowStack.reset();
});
