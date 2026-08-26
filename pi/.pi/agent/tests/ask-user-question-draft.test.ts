import assert from "node:assert/strict";
import { QuestionnaireState } from "../extensions/ask-user-question/questionnaire-state.ts";

/** Editor stub mirroring the pi-tui Editor contract the state machine relies
 * on: the buffer is cleared BEFORE onSubmit fires. */
function makeEditor() {
	const buf = { text: "" };
	return {
		setText: (t: string) => {
			buf.text = t;
		},
		getText: () => buf.text,
		clearLikeRealTui: () => {
			buf.text = "";
		},
	};
}

const questions = [
	{
		id: "q1",
		label: "Q1",
		prompt: "Question 1 ?",
		options: [{ value: "a", label: "Option A" }],
		allowOther: true,
		multiSelect: false,
	},
	{ id: "q2", label: "Q2", prompt: "Question 2 ?", options: [{ value: "b", label: "Option B" }], allowOther: true, multiSelect: false },
];

function advanceToNextQuestion(state: QuestionnaireState): void {
	const target = state.advanceTarget();
	if (target === "submit") throw new Error("Expected another question");
	state.enterTab(target);
}

function testCommittedCustomTextSurvivesTabSwitch(): void {
	const editor = makeEditor();
	const state = new QuestionnaireState(questions, editor);
	state.moveCursor(1); // onto the "Type something." row
	editor.setText("mon texte custom");
	const effects = state.submitEditorText(editor.getText());
	editor.clearLikeRealTui(); // the real Editor clears before onSubmit fires
	assert.deepEqual(effects, ["advance"]);
	advanceToNextQuestion(state); // auto-advance
	state.enterTab(0); // user comes back
	assert.equal(editor.getText(), "mon texte custom", "draft restored in the editor");
	assert.ok(state.editorHasFocus(), "cursor back on the custom row");
	assert.ok(state.answerFor("q1"), "answer still recorded");
}

function testOpenEndedAnswerSurvivesAdvance(): void {
	const openEnded = [
		{ id: "q1", label: "Q1", prompt: "Question 1 ?", options: [], allowOther: true, multiSelect: false },
		{ id: "q2", label: "Q2", prompt: "Question 2 ?", options: [{ value: "b", label: "Option B" }], allowOther: true, multiSelect: false },
	];
	const editor = makeEditor();
	const state = new QuestionnaireState(openEnded, editor);
	editor.setText("réponse libre");
	const effects = state.submitEditorText(editor.getText());
	editor.clearLikeRealTui();
	assert.deepEqual(effects, ["advance"]);
	advanceToNextQuestion(state);
	state.enterTab(0);
	assert.equal(editor.getText(), "réponse libre", "free answer restored");
	assert.ok(state.answerFor("q1"), "answer still recorded");
}

function testManualEraseStillClearsDraft(): void {
	const editor = makeEditor();
	const state = new QuestionnaireState(questions, editor);
	state.moveCursor(1);
	editor.setText("brouillon");
	// switch away WITHOUT submitting: normal save path
	state.enterTab(1);
	assert.equal(state.initialState().drafts.q1, "brouillon");
	// come back, erase the field, switch again: draft must be gone
	state.enterTab(0);
	editor.setText("");
	state.enterTab(1);
	assert.equal(state.initialState().drafts.q1, undefined, "manual erase still clears the draft");
}

function testSelectingRegularOptionClearsCustomDraft(): void {
	const editor = makeEditor();
	const state = new QuestionnaireState(questions, editor);
	state.moveCursor(1); // focus the custom input
	editor.setText("draft abandonné");
	state.moveCursor(-1); // return to the regular option without clearing the input
	assert.deepEqual(state.selectOption(0), ["advance"]);
	advanceToNextQuestion(state);
	state.enterTab(0);	assert.equal(editor.getText(), "", "custom input is cleared after selecting a regular option");
	assert.equal(state.cursor, 0, "regular option is selected on revisit");
	assert.equal(state.initialState().drafts.q1, undefined, "custom draft is discarded");
}

function testSelectedRegularOptionIsRestored(): void {
	const editor = makeEditor();
	const twoOptions = [
		{ id: "q1", label: "Q1", prompt: "Question 1 ?", options: [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }], allowOther: true, multiSelect: false },
		questions[1],
	];
	const state = new QuestionnaireState(twoOptions, editor);
	assert.deepEqual(state.selectOption(1), ["advance"]); // choose option 2
	advanceToNextQuestion(state);
	state.enterTab(0);
	assert.equal(state.cursor, 1, "the second regular option is selected on revisit");
	assert.equal(editor.getText(), "", "custom input stays empty");
}

function testEmptySubmitDoesNotSkipFollowingDraft(): void {
	const editor = makeEditor();
	const state = new QuestionnaireState(questions, editor);
	state.moveCursor(1);
	editor.setText("old draft");
	assert.deepEqual(state.submitEditorText(""), ["render"]);
	editor.clearLikeRealTui();
	editor.setText("replacement draft");
	state.enterTab(1);
	state.enterTab(0);
	assert.equal(editor.getText(), "replacement draft", "replacement draft is saved after an empty submit");
}

function testEmptyMultiSelectSubmitDoesNotSkipFollowingDraft(): void {
	const editor = makeEditor();
	const multiQuestions = [
		{ ...questions[0], multiSelect: true },
		questions[1],
	];
	const state = new QuestionnaireState(multiQuestions, editor);
	state.moveCursor(1);
	editor.setText("old draft");
	assert.deepEqual(state.submitEditorText(""), []);
	editor.clearLikeRealTui();
	editor.setText("replacement draft");
	state.enterTab(1);
	state.enterTab(0);
	assert.equal(editor.getText(), "replacement draft", "replacement multi-select draft is saved");
}

const tests: Array<[string, () => void]> = [
	["committed custom text survives the auto-advance tab switch", testCommittedCustomTextSurvivesTabSwitch],
	["open-ended free answer survives the auto-advance", testOpenEndedAnswerSurvivesAdvance],
	["manually erased draft is still discarded", testManualEraseStillClearsDraft],
	["selecting a regular option discards the custom draft", testSelectingRegularOptionClearsCustomDraft],
	["selected regular option is restored on revisit", testSelectedRegularOptionIsRestored],
	["empty submit does not skip the following draft", testEmptySubmitDoesNotSkipFollowingDraft],
	["empty multi-select submit does not skip the following draft", testEmptyMultiSelectSubmitDoesNotSkipFollowingDraft],
];

for (const [name, test] of tests) {
	test();
	console.log(`ok  ${name}`);
}
console.log(`${tests.length} passed`);
