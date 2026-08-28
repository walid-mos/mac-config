import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractJsonBlocks, MIN_RAW_LENGTH } from "../extensions/json-view/detect.ts";
import {
	formatJsonBytes,
	JSON_MAX_LINES,
	transformMarkdown,
} from "../extensions/json-view/render.ts";
import {
	blobByRecency,
	persistJson,
	readBlob,
	recentBlobs,
	setBlobDir,
} from "../extensions/json-view/blob-store.ts";

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

test("transform : bloc isolé avec séparateur slim, sans fence", () => {
	const markdown = `Avant.\n${SMALL}\nAprès.`;
	const result = transformMarkdown(markdown, { expanded: false, width: 120, persist: () => "file:///tmp/x.json" });
	assert.match(result, /^Avant\.\n\n/);
	assert.match(result, /── json · \d[,\d]* o · 7 lignes · \[ouvrir ⤢\]\(file:\/\/\/tmp\/x\.json\) ─+\n/);
	assert.match(result, /\n\{\n  "a": 1,\n  "b": \\\[\n    2,\n    3\n  \\\]\n\}\n\nAprès\.$/);
	assert.ok(!result.includes("```"));
});

test("transform : gros JSON replié = 18 premières lignes + marqueur cliquable", () => {
	const markdown = `${BIG}`;
	const result = transformMarkdown(markdown, { expanded: false, width: 80, persist: () => "file:///tmp/big.json" });
	assert.ok(result.includes("164 lignes"));
	assert.ok(result.includes('"item-3"'));
	assert.ok(!result.includes('"item-4"'));
	assert.ok(result.includes("[⤢ +146 lignes · tout voir](file:///tmp/big.json)"));
	assert.ok(!result.includes("```"));
});

test("transform : déplié = pretty complet même pour un gros JSON", () => {
	const result = transformMarkdown(BIG, { expanded: true, width: 80 });
	assert.ok(result.includes('"item-39"'));
	assert.ok(!result.includes("tout voir"));
});

test("transform : JSON sous le seuil reste complet quand replié", () => {
	const lines = SMALL.split("\n").length;
	assert.ok(lines <= JSON_MAX_LINES);
	const result = transformMarkdown(SMALL, { expanded: false, width: 80 });
	assert.ok(result.includes('"b"'));
	assert.ok(!result.includes("tout voir"));
});

test("transform : sans JSON, markdown intact", () => {
	const markdown = "# Titre\n\nDu texte { sans JSON }.";
	assert.equal(transformMarkdown(markdown, { expanded: false, width: 80 }), markdown);
});

test("transform : contenu markdown-escapé (pas d'interprétation)", () => {
	const tricky = JSON.stringify({ note: "*gras* et `code` et <tag> et [lien]" }, null, 2);
	const result = transformMarkdown(tricky, { expanded: true, width: 80 });
	assert.ok(result.includes("\\*gras\\*"));
	assert.ok(result.includes("\\`code\\`"));
	assert.ok(result.includes("\\<tag\\>"));
	assert.ok(result.includes("\\[lien\\]"));
});

test("transform : séparateur calé sur la largeur", () => {
	const result = transformMarkdown(SMALL, { expanded: false, width: 80, persist: () => "file:///tmp/x.json" });
	const header = result.split("\n").find((line) => line.startsWith("── json")) ?? "";
	// Largeur visible = syntaxe lien retirée, un caractère par colonne.
	const visible = header.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
	assert.equal([...visible].length, 80);
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

test("blob-store : historique réhydraté après reset (simulate reload)", () => {
	const dir = mkdtempSync(join(tmpdir(), "json-view-test-"));
	setBlobDir(dir);
	const url = persistJson(BIG, JSON.parse(BIG));
	assert.ok(url);

	// ctx.reload() réimporte le module : historique vidé, puis relu depuis index.json.
	setBlobDir(`${dir}/`);
	const blob = blobByRecency(1);
	assert.ok(blob);
	assert.equal(blob.url, url);
	// readBlob rend le contenu sans le retour à la ligne final d'écriture.
	assert.equal(readBlob(blob), BIG);

	rmSync(dir, { recursive: true, force: true });
});

test("formatJsonBytes : unités françaises", () => {
	assert.equal(formatJsonBytes(12), "12 o");
	assert.equal(formatJsonBytes(2048), "2 Ko");
	assert.equal(formatJsonBytes(1536), "1,5 Ko");
});
