import assert from "node:assert/strict";
import test from "node:test";
import { Check } from "typebox/value";
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

function testSchemaAcceptsOmittedOptionValue(): void {
	assert.equal(
		Check(AskParams, {
			questions: [{ id: "scope", prompt: "Which scope?", options: [{ label: "Full repo" }] }],
		}),
		true,
	);
}

function testExplicitEmptyOptionValueIsPreserved(): void {
	const [question] = normalizeQuestions([
		{ id: "empty", prompt: "Empty value?", options: [{ value: "", label: "Empty value" }] },
	]);
	assert.equal(question.options[0]?.value, "");
}

test("missing option value falls back to label", testValueFallsBackToLabel);
test("defaults applied to raw payload", testDefaultsApplied);
test("schema accepts omitted option value", testSchemaAcceptsOmittedOptionValue);
test("explicit empty option value is preserved", testExplicitEmptyOptionValueIsPreserved);
