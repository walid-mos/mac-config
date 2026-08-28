import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractJsonBlocks, MIN_RAW_LENGTH } from "../extensions/json-view/detect.ts";
import {
	COLLAPSED_LINE_THRESHOLD,
	formatJsonBytes,
	transformMarkdown,
} from "../extensions/json-view/render.ts";
import { persistJson, recentBlobs, setBlobDir } from "../extensions/json-view/blob-store.ts";

const MINI = JSON.stringify({ kind: "review", session: "render-fixture-v2" });
const SMALL = JSON.stringify({ a: 1, b: [2, 3] }, null, 2);
const BIG = JSON.stringify(
	{ items: Array.from({ length: 40 }, (_, i) => ({ index: i, label: `item-${i}` })) },
	null,
	2,
);

test("detect : fence ```json", () => {
	const markdown = `Avant\n\n\`\`\`json\n${SMALL}\n\`\`\`\n\nAprès`;
	const blocks = extractJsonBlocks(markdown);
	assert.equal(blocks.length, 1);
	assert.equal(blocks[0].source, "fence");
	assert.deepEqual(blocks[0].parsed, { a: 1, b: [2, 3] });
});

test("detect : fence sans langage mais parseable", () => {
	const body = JSON.stringify({
		kind: "review",
		session: "render-fixture-v2",
		note: "0123456789012345678901234567890123456789",
	});
	const blocks = extractJsonBlocks("```\n" + body + "\n```");
	assert.equal(blocks.length, 1);
	assert.equal(blocks[0].source, "fence");
});

test("detect : petite fence sans langage ignorée (exemple de code)", () => {
	assert.deepEqual(extractJsonBlocks("```\n" + SMALL + "\n```"), []);
});

test("detect : fence non JSON ignorée", () => {
	const markdown = `\`\`\`ts\nconst x = { a: 1 };\n\`\`\``;
	assert.deepEqual(extractJsonBlocks(markdown), []);
});

test("detect : JSON brut minifié en début de ligne", () => {
	const raw = JSON.stringify({
		kind: "review",
		session: "render-fixture-v2",
		note: "0123456789012345678901234567890123456789",
	});
	if (raw.length <= MIN_RAW_LENGTH) throw new Error("fixture trop courte");
	const markdown = `Texte avant.\n${raw}\nTexte après.`;
	const blocks = extractJsonBlocks(markdown);
	assert.equal(blocks.length, 1);
	assert.equal(blocks[0].source, "raw");
	assert.deepEqual(blocks[0].parsed, JSON.parse(raw));
	// Le bloc couvre depuis le début de ligne pour éviter un indent hérité.
	assert.equal(markdown.slice(blocks[0].start, blocks[0].end), raw);
});

test("detect : JSON brut multiligne indiqué", () => {
	const markdown = `Intro :\n${SMALL}\nFin.`;
	const blocks = extractJsonBlocks(markdown);
	assert.equal(blocks.length, 1);
	assert.deepEqual(blocks[0].parsed, { a: 1, b: [2, 3] });
});

test("detect : accolades dans des chaînes", () => {
	const raw = `{"code":"if (a) { return \\"}\\"; }","note":"${"x".repeat(MIN_RAW_LENGTH)}"}`;
	const markdown = `${raw}\nsuite`;
	const blocks = extractJsonBlocks(markdown);
	assert.equal(blocks.length, 1);
	assert.equal(blocks[0].end - blocks[0].start, raw.length);
});

test("detect : JSON inline court et prose intact", () => {
	const markdown = `Voir {"a": 1} dans le texte et { du texte libre.`;
	assert.deepEqual(extractJsonBlocks(markdown), []);
});

test("detect : JSON non strict ignoré", () => {
	const markdown = `{ a: 1, b: () => 2 } et puis rien`;
	assert.deepEqual(extractJsonBlocks(markdown), []);
});

test("transform : bloc isolé avec en-tête et fence", () => {
	const markdown = `Avant.\n${SMALL}\nAprès.`;
	const result = transformMarkdown(markdown, { expanded: false, width: 120 });
	assert.match(result, /\*json · \d[,\d]* o · 7 lignes · `\/json open`\*\n\n/);
	assert.match(result, /```json\n\{\n  "a": 1,\n  "b": \[\n    2,\n    3\n  \]\n\}\n```/);
	assert.match(result, /^Avant\.\n\n/);
	assert.match(result, /```\n\nAprès\.$/);
});

test("transform : gros JSON replié = aperçu minifié tronqué", () => {
	const markdown = `${BIG}`;
	const result = transformMarkdown(markdown, { expanded: false, width: 80 });
	const fence = result.match(/```json\n(.*)\n```/s)?.[1] ?? "";
	assert.ok(fence.endsWith(" …"));
	const previewLine = fence.replace(/ …$/, "");
	assert.ok([...previewLine].length <= 78);
	assert.ok(result.includes("164 lignes"));
});

test("transform : déplié = pretty complet même pour un gros JSON", () => {
	const result = transformMarkdown(BIG, { expanded: true, width: 80 });
	assert.ok(result.includes('"item-39"'));
	assert.ok(!result.includes("…\n```"));
});

test("transform : JSON sous le seuil reste complet quand replié", () => {
	const lines = SMALL.split("\n").length;
	assert.ok(lines <= COLLAPSED_LINE_THRESHOLD);
	const result = transformMarkdown(SMALL, { expanded: false, width: 80 });
	assert.ok(result.includes('"b"'));
});

test("transform : sans JSON, markdown intact", () => {
	const markdown = "# Titre\n\nDu texte { sans JSON }.";
	assert.equal(transformMarkdown(markdown, { expanded: false, width: 80 }), markdown);
});

test("transform : idempotent", () => {
	const once = transformMarkdown(SMALL, { expanded: false, width: 80, persist: () => "file:///tmp/x.json" });
	const twice = transformMarkdown(once, { expanded: false, width: 80, persist: () => "file:///tmp/x.json" });
	assert.equal(twice, once);
});

test("blob-store : un fichier par contenu, historique ordonné", () => {
	const dir = mkdtempSync(join(tmpdir(), "json-view-test-"));
	setBlobDir(dir);
	try {
		const urlA = persistJson(BIG, JSON.parse(BIG));
		const urlA2 = persistJson(BIG, JSON.parse(BIG));
		assert.equal(urlA, urlA2);
		const urlB = persistJson(SMALL, JSON.parse(SMALL));
		assert.notEqual(urlA, urlB);
		assert.deepEqual(recentBlobs().map((blob) => blob.url), [urlA, urlB]);
		assert.match(urlA ?? "", /^file:\/\//);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("formatJsonBytes : unités françaises", () => {
	assert.equal(formatJsonBytes(12), "12 o");
	assert.equal(formatJsonBytes(2048), "2 Ko");
	assert.equal(formatJsonBytes(1536), "1,5 Ko");
});
