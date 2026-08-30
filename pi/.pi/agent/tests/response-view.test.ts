import assert from "node:assert/strict";
import test from "node:test";
import {
	RESPONSE_RULE_MAX_WIDTH,
	frameAssistantMarkdown,
	responseBottomRule,
	responseTopRule,
	type ResponseTheme,
} from "../extensions/response-view/frame.ts";

const theme: ResponseTheme = {
	fg: (_role, text) => text,
	bold: (text) => text,
};

test("encadre une réponse finalisée avec une hiérarchie minimale", () => {
	const framed = frameAssistantMarkdown("**Fait.**", {
		width: 40,
		isStreaming: false,
		theme,
	});
	const lines = framed.split("\n");
	assert.equal(lines[0], `╭─ réponse ${"─".repeat(29)}`);
	assert.equal(lines[1], "");
	assert.equal(lines[2], "**Fait.**");
	assert.equal(lines[3], "");
	assert.equal(lines[4], `╰${"─".repeat(39)}`);
});

test("laisse la surface ouverte pendant le streaming", () => {
	const framed = frameAssistantMarkdown("Réponse en cours", {
		width: 32,
		isStreaming: true,
		theme,
	});
	assert.ok(framed.startsWith("╭─ réponse "));
	assert.ok(framed.endsWith("Réponse en cours"));
	assert.ok(!framed.includes("\n\n╰"));
});

test("plafonne les séparateurs sur un terminal ultra-large", () => {
	assert.equal([...responseTopRule(240, theme)].length, RESPONSE_RULE_MAX_WIDTH);
	assert.equal([...responseBottomRule(240, theme)].length, RESPONSE_RULE_MAX_WIDTH);
});

test("reste sûr sur les largeurs étroites et les messages vides", () => {
	assert.equal(responseTopRule(4, theme), "────");
	assert.equal(responseBottomRule(1, theme), "╰");
	assert.equal(
		frameAssistantMarkdown("   ", { width: 80, isStreaming: false, theme }),
		"   ",
	);
});
