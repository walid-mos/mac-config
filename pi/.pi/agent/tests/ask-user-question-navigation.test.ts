import assert from "node:assert/strict";
import test from "node:test";
import { runQuestionnaire } from "../extensions/ask-user-question/questionnaire-component.ts";
import type { QuestionnairePalette } from "../extensions/ask-user-question/questionnaire-render.ts";

interface TestComponent {
	render(width: number): string[];
	invalidate(): void;
	handleInput(data: string): void;
}

interface TestTui {
	requestRender(): void;
	terminal: { rows: number; columns: number };
}

interface TestKeybindings {
	matches(data: string, action: "tui.select.up" | "tui.select.down"): boolean;
}

type TestFactory<T> = (
	tui: TestTui,
	theme: QuestionnairePalette,
	keybindings: TestKeybindings,
	done: (result: T) => void,
) => TestComponent;

const arrowLeft = "\u001b[D";
const arrowRight = "\u001b[C";
const arrowDown = "\u001b[B";
const fakeTui: TestTui = { requestRender() {}, terminal: { rows: 40, columns: 120 } };
const theme: QuestionnairePalette = {
	fg: (_color, text) => text,
	bg: (_color, text) => text,
	bold: (text) => text,
};
const keybindings: TestKeybindings = {
	matches: (data, action) => data === arrowDown && action === "tui.select.down",
};

const questions = [
	{
		id: "q1",
		label: "Q1",
		prompt: "Question 1 ?",
		options: [{ value: "a", label: "Option A" }],
		allowOther: true,
		multiSelect: false,
	},
	{
		id: "q2",
		label: "Q2",
		prompt: "Question 2 ?",
		options: [{ value: "b", label: "Option B" }],
		allowOther: true,
		multiSelect: false,
	},
];

function createCapturedQuestionnaire(): TestComponent {
	let captured: TestComponent | undefined;
	function capture<T>(factory: TestFactory<T>): Promise<T> {
		captured = factory(fakeTui, theme, keybindings, () => {});
		return new Promise<T>(() => {});
	}
	runQuestionnaire(capture, questions);
	if (captured === undefined) throw new Error("Questionnaire component was not created");
	return captured;
}

function renderedText(component: TestComponent): string {
	return component.render(80).join("\n");
}

function testRightEdgeAdvancesAndInternalArrowDoesNot(): void {
	const component = createCapturedQuestionnaire();
	component.handleInput(arrowDown); // focus Q1 custom input
	component.handleInput("abc");
	component.handleInput(arrowLeft); // move inside the buffer, not to Q2
	assert.match(renderedText(component), /Question 1 \?/);
	component.handleInput(arrowRight); // back to the end of the buffer
	component.handleInput(arrowRight); // edge navigation to Q2
	assert.match(renderedText(component), /Question 2 \?/);
}

function testLeftEdgeReturnsToPreviousQuestion(): void {
	const component = createCapturedQuestionnaire();
	component.handleInput(arrowDown); // focus Q1 custom input
	component.handleInput("abc");
	component.handleInput(arrowRight); // Q2
	component.handleInput(arrowDown); // focus Q2 custom input
	component.handleInput(arrowLeft); // at column 0: return to Q1
	assert.match(renderedText(component), /Question 1 \?/);
	assert.match(renderedText(component), /abc/);
}

test(
	"right edge advances while internal right/left movement stays in the question",
	testRightEdgeAdvancesAndInternalArrowDoesNot,
);
test("left edge returns to the previous question", testLeftEdgeReturnsToPreviousQuestion);
