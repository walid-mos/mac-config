import assert from "node:assert/strict";
import { AskParams, normalizeQuestions } from "../extensions/ask-user-question/schema.ts";

function testValueFallsBackToLabel(): void {
	const [question] = normalizeQuestions([
		{
			id: "scope",
			prompt: "Which scope?",
			options: [
				{ label: "Full repo" },
				{ value: "src", label: "src only" },
			],
		},
	]);
	assert.deepEqual(
		question.options.map((option) => option.value),
		["Full repo", "src"],
	);
}

function testDefaultsApplied(): void {
	const [question] = normalizeQuestions([{ id: "q", prompt: "Open ended?" }]);
	assert.equal(question.label, "Q1");
	assert.deepEqual(question.options, []);
	assert.equal(question.allowOther, true);
	assert.equal(question.multiSelect, false);
}

const tests: Array<[string, () => void]> = [
	["missing option value falls back to label", testValueFallsBackToLabel],
	["defaults applied to raw payload", testDefaultsApplied],
];

for (const [name, test] of tests) {
	test();
	console.log(`ok  ${name}`);
}
console.log(`${tests.length} passed`);
