import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractJsonBlocks, findOpenRawJson, MIN_RAW_LENGTH } from "../extensions/json-view/detect.ts";
import { LATTE, fgHex, rgb } from "../extensions/footer/style.ts";
import {
	blendHex,
	C_BASE,
	escapeMarkdownOutsideAnsi,
	formatJsonBytes,
	highlightJsonLine,
	JSON_MAX_LINES,
	renderJsonBox,
	transformMarkdown,
	type JsonBlock,
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

test("detect : JSON brut en cours de génération détecté (sans fence)", () => {
	const partial = 'Texte avant.\n\n{\n  "id": 1,\n  "nom": "Projet Atlas",\n  "reg';
	const open = findOpenRawJson(partial);
	assert.ok(open);
	assert.equal(open.start, partial.indexOf("{"));
	assert.ok(open.content.startsWith("{"));
	// Chaîne entamée coupée en plein milieu.
	assert.ok(findOpenRawJson('{\n  "nom": "Projet At'));
	// Un bloc d'exemple non JSON reste ignoré.
	assert.equal(findOpenRawJson("Exemple :\n\n{ a: 1, b: (x) => { return x; }"), undefined);
	// Une fence ouverte a la priorité.
	assert.equal(findOpenRawJson('```json\n{"a":'), undefined);
	// JSON complet → bloc exact, pas de cadre de croissance.
	assert.equal(findOpenRawJson(`${SMALL}`), undefined);
	// JSON court sur une seule ligne = inline de prose.
	assert.equal(findOpenRawJson(`texte {"a": 1`), undefined);
	// Candidat à l'intérieur d'une fence fermée ignoré.
	assert.equal(findOpenRawJson('```\n{"x":\n```\nTexte final.'), undefined);
});

test("detect : tableau d'objets en cours — la racine [ gagne, pas le dernier {", () => {
	const items = Array.from(
		{ length: 11 },
		(_, i) => `  {"id": ${i + 1}, "name": "item-0${i + 1}"},`,
	).join("\n");
	const fragment = `[\n${items}\n  {"id": 12, "name": "item-`;
	const open = findOpenRawJson(fragment);
	assert.ok(open);
	assert.equal(open.start, 0, "ancrage = racine [");
	assert.ok(open.content.startsWith("["));
	// Coupe nette après un objet complet : même comportement.
	assert.ok(findOpenRawJson(`${fragment.slice(0, fragment.lastIndexOf("},") + 2)}`));
});

test("detect : prose commençant par { jamais prise pour du JSON en cours", () => {
	// Accolade nue + texte libre : la troncature à `{` donnerait `{}` → rejeté.
	assert.equal(findOpenRawJson("Un template :\n\n{\n  et voila du texte libre"), undefined);
	// Membre JSON apparent suivi de prose : la queue rejetée par le garde-fou 2.
	assert.equal(
		findOpenRawJson('{\n  "titre": "Mon doc",\n  ceci n est pas du json mais voila'),
		undefined,
	);
	assert.equal(
		findOpenRawJson('{\n  "cle": "valeur",\n  and then prose that is not json'),
		undefined,
	);
	// Liste markdown à crochets non terminée.
	assert.equal(findOpenRawJson("[Note] ceci est une note en cours"), undefined);
	// Un vrai flux, lui, passe toujours : coupure après virgule, dans une clé,
	// dans une chaîne, ou en pleine valeur.
	assert.ok(findOpenRawJson('{\n  "id": 1,'));
	assert.ok(findOpenRawJson('{\n  "id": 1,\n  "reg'));
	assert.ok(findOpenRawJson('{\n  "id": 1,\n  "nom": "Projet At'));
	assert.ok(findOpenRawJson('{\n  "id": 1,\n  "poids": 7')); 
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

test("transform : JSON brut en cours de génération = cadre qui grossit (sans fence)", () => {
	const partial = 'Voici :\n\n{\n  "id": 1,\n  "nom": "Projet Atlas",\n  "stat';
	const result = transformMarkdown(partial, { expanded: false, width: 96 });
	const plain = result.replace(ANSI_STRIP, "").replace(OSC_STRIP, "");
	assert.ok(plain.startsWith("Voici :\n\n╭─ json ·"), "cadre de croissance sur JSON brut");
	assert.ok(plain.includes('"nom": "Projet Atlas"'));
	assert.ok(plain.includes("génération…"));

	// Une fois complet : boîte exacte, plus de cadre de croissance.
	const complete = transformMarkdown(`Voici :\n\n${SMALL}\n\nAprès.`, { expanded: false, width: 96 });
	const plainComplete = complete.replace(ANSI_STRIP, "");
	assert.ok(plainComplete.includes("╭─ json ·"));
	assert.ok(!plainComplete.includes("génération…"));
});

test("transform : enveloppe du cadre de croissance calée sur la largeur (JSON brut)", () => {
	const partial = '{\n  "id": 1,\n  "nom": "Projet Atlas",\n  "reg';
	const result = transformMarkdown(partial, { expanded: false, width: 80 });
	for (const row of result.split("\n")) {
		const visible = row.replace(ANSI_STRIP, "").replace(OSC_STRIP, "");
		if (/^[╭│╰]/.test(visible)) assert.equal([...visible].length, 80, JSON.stringify(visible.slice(0, 40)));
	}
});

test("transform : fence ouverte non fermée (streaming) = cadre qui grandit", () => {
	const partial = 'Voici :\n\n```json\n{\n  "id": 5,\n  "actif": true\n}';
	const result = transformMarkdown(partial, { expanded: false, width: 96 });
	// La fence est consommée et remplacée par le cadre (pas de rendu code natif).
	assert.ok(!result.includes("```"));
	const plain = result.replace(ANSI_STRIP, "").replace(OSC_STRIP, "");
	assert.ok(plain.startsWith("Voici :\n\n╭─ json ·"));
	assert.ok(plain.includes('"id": 5'));
	assert.ok(plain.includes("génération…"));
	assert.ok(result.includes("\u001b[38;2;30;102;245m"), "clés colorées pendant le streaming");
	const grown = transformMarkdown(`${partial.slice(0, -1)},\n  "email": "user5@example.com"\n}`, { expanded: false, width: 96 });
	assert.ok(grown.includes('"email"'));
	assert.ok(!grown.includes("```"));
});

const ANSI_STRIP = /\u001b\[[0-9;]*m/g;
const OSC_STRIP = /\u001b\]8;;[^\u0007]*\u0007/g;

function visibleLines(markdown: string): string[] {
	return markdown.split("\n").map((line) => [...line.replace(ANSI_STRIP, "").replace(OSC_STRIP, "")].length);
}

test("transform : bloc spécialisé, sans fence", () => {
	const markdown = `Avant.\n${SMALL}\nAprès.`;
	const result = transformMarkdown(markdown, { expanded: false, width: 96, persist: () => "file:///tmp/x.json" });
	const rows = result.split("\n").map((row) => row.replace(ANSI_STRIP, ""));
	assert.match(rows[0], /^Avant\.$/);
	const boxStart = rows.findIndex((row) => row.startsWith("╭─"));
	assert.ok(boxStart > 0);
	assert.ok(rows[boxStart].includes("json ·"));
	assert.ok(rows[boxStart].trimEnd().endsWith("╮"));
	assert.ok(rows.some((row) => row.includes("\"a\"")));
	assert.ok(rows.some((row) => row.trimEnd().endsWith("╯") && row.includes("ouvrir ⤢") && row.includes("file:///tmp/x.json")));
	assert.ok(!result.includes("```"));
});

test("transform : contenu coloré (truecolor) et markdown resté littéral", () => {
	const tricky = JSON.stringify({ note: "*gras* et <tag>", n: 3, ok: true }, null, 2);
	const result = transformMarkdown(tricky, { expanded: true, width: 96 });
	assert.ok((result.match(/\u001b\[38;2;30;102;245m/g) ?? []).length >= 2, "clés en bleu");
	assert.ok(result.includes("\u001b[38;2;64;160;43m"), "chaînes en vert");
	assert.ok(result.includes("\u001b[38;2;254;100;11m"), "nombres en peach");
	assert.ok(result.includes("\u001b[38;2;136;57;239m"), "littéraux en mauve");
	assert.ok(result.includes("\\*gras\\*"), "astérisques échappés");
	assert.ok(result.includes("\\<tag\\>"), "chevrons échappés");
});

test("transform : gros JSON replié = 18 premières lignes + marqueur cliquable", () => {
	const markdown = `${BIG}`;
	const result = transformMarkdown(markdown, { expanded: false, width: 96, persist: () => "file:///tmp/big.json" });
	assert.ok(result.includes("164 lignes"));
	assert.ok(result.includes('"item-3"'));
	assert.ok(!result.includes('"item-4"'));
	assert.ok(result.includes("⤢ +146 lignes · tout voir"));
	assert.ok(result.includes("file:///tmp/big.json"));
	assert.ok(!result.includes("```"));
});

const ansiColor = (hex: string): string => {
	const [r, g, b] = rgb(hex);
	return `\x1b[38;2;${r};${g};${b}m`;
};

test("render : coupe repliée = bande de fondu + « · · · » ; coupe absente si non capé", () => {
	const block = { raw: BIG, parsed: JSON.parse(BIG) } as JsonBlock;
	const capped = renderJsonBox(block, { expanded: false, width: 96 });
	// Une seule rangée de points, centrée, trois fondu croissants.
	const dotsRows = capped.split("\n").filter((row) => row.replace(/\x1b\[[0-9;]*m/g, "").includes("· · ·"));
	assert.equal(dotsRows.length, 1, "une seule rangée de points");
	const dotsRow = dotsRows[0];
	assert.ok(capped.includes(ansiColor(blendHex(LATTE.overlay1, C_BASE, 0.55))), "point 1 fondu");
	assert.ok(capped.includes(ansiColor(blendHex(LATTE.overlay1, C_BASE, 0.9))), "point 3 très pâle");
	// Dernière ligne de contenu dissoute : aucune couleur pure de la palette
	// (hors la bordure, chrome de la boîte).
	const border = ansiColor(LATTE.overlay1);
	const paletteAnsi = Object.values(LATTE).map(ansiColor).filter((c) => c !== border);
	const contentRows = capped.split("\n").filter((row) => row.includes("│"));
	const lastContent = contentRows[contentRows.length - 2]; // avant la rangée de points
	const colors = [...lastContent.matchAll(/\x1b\[38;2;\d+;\d+;\d+m/g)].map((m) => m[0]).filter((c) => c !== border);
	assert.ok(colors.length > 0, "la dernière ligne de contenu est colorée");
	assert.ok(colors.every((c) => !paletteAnsi.includes(c)), "fondu : que des mélanges");
	// La 1re ligne de contenu reste à pleine intensité (vert Latte pur).
	assert.ok(capped.includes(ansiColor(LATTE.green)));
	// Non capé : ni rangée de points ni fondu.
	const full = renderJsonBox(block, { expanded: true, width: 96 });
	assert.ok(!full.split("\n").some((row) => row.replace(/\x1b\[[0-9;]*m/g, "").includes("· · ·")));
	assert.ok(!full.includes(ansiColor(blendHex(LATTE.green, C_BASE, 0.5))));
});

test("transform : déplié = pretty complet même pour un gros JSON", () => {
	const result = transformMarkdown(BIG, { expanded: true, width: 96 });
	assert.ok(result.includes('"item-39"'));
	assert.ok(!result.includes("tout voir"));
});

test("transform : JSON sous le seuil reste complet quand replié", () => {
	const lines = SMALL.split("\n").length;
	assert.ok(lines <= JSON_MAX_LINES);
	const result = transformMarkdown(SMALL, { expanded: false, width: 96 });
	assert.ok(result.includes('"b"'));
	assert.ok(!result.includes("tout voir"));
});

test("transform : sans JSON, markdown intact", () => {
	const markdown = "# Titre\n\nDu texte { sans JSON }.";
	assert.equal(transformMarkdown(markdown, { expanded: false, width: 80 }), markdown);
});

test("transform : toutes les rangées du bloc calées sur la largeur", () => {
	const result = transformMarkdown(`${SMALL}\n\n${BIG}`, { expanded: false, width: 96, persist: () => "file:///tmp/x.json" });
	const boxRows = result
		.split("\n")
		.map((row) => row.replace(ANSI_STRIP, ""))
		.filter((row) => /^[╭│╰]/.test(row));
	assert.ok(boxRows.length > 20);
	for (const row of boxRows) {
		const [visible] = visibleLines(row);
		assert.equal(visible, 96, `rangée décalée : ${JSON.stringify(row.slice(0, 40))}`);
	}
});

test("transform : cadre de croissance coloré dès le streaming", () => {
	const tricky = JSON.stringify({ note: "*gras* et <tag>", n: 3, ok: true, plus: "x" }, null, 2);
	const result = transformMarkdown(tricky, { expanded: true, width: 96 });
	assert.ok(result.includes("\u001b[38;2;30;102;245m"), "clés en bleu");
	assert.ok(result.includes("\\*gras\\*"), "astérisques échappés");
	const plain = result.replace(ANSI_STRIP, "");
	assert.ok(plain.startsWith("╭─ json ·"));
});

test("escapeMarkdownOutsideAnsi : ANSI intact, markdown spécial échappé", () => {
	const ansi = "\u001b[38;2;1;2;3m[text]\u001b[39m";
	assert.equal(escapeMarkdownOutsideAnsi(ansi), ansi);
	assert.equal(escapeMarkdownOutsideAnsi("a*b`c<d~e"), "a\\*b\\`c\\<d\\~e");
});

test("highlightJsonLine : clés bleues, chaînes vertes, ponctuation grise", () => {
	const colored = highlightJsonLine('  "nom": "test",');
	assert.ok(colored.includes("\u001b[38;2;30;102;245m\"nom\"\u001b[39m"));
	assert.ok(colored.includes("\u001b[38;2;64;160;43m\"test\"\u001b[39m"));
	assert.ok(colored.includes("\u001b[38;2;140;143;161m:\u001b[39m"));
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
