/**
 * The interactive questionnaire TUI component, run through ctx.ui.custom().
 * Thin wiring: keyboard input -> QuestionnaireState transitions -> effects
 * (render/advance/submit/cancel) applied against the TUI; rendering itself
 * lives in questionnaire-render.ts.
 */

import { Editor, type EditorTheme, Key, matchesKey } from "@earendil-works/pi-tui";
import type { AskResult, Question, QuestionnaireInitialState } from "./questionnaire-model";
import type { QuestionnairePalette } from "./questionnaire-render";
import { renderQuestionnaire } from "./questionnaire-render";
import { type EditorPort, type QuestionnaireEffect, QuestionnaireState } from "./questionnaire-state";

/** Loosened TUI surface: the real TUI has more, we only need re-rendering. */
interface RenderHandle {
	requestRender(): void;
}

interface CustomComponent {
	render(width: number): string[];
	invalidate(): void;
	handleInput(data: string): void;
}

interface SelectionKeybindings {
	matches(data: string, action: "tui.select.up" | "tui.select.down"): boolean;
}

type CustomFactory<T> = (
	tui: RenderHandle,
	theme: QuestionnairePalette,
	keybindings: SelectionKeybindings,
	done: (result: T) => void,
) => CustomComponent;

/** Editor cursor position, or undefined when the editor doesn't have focus. */
function editorCursor(state: QuestionnaireState, editor: Editor): { line: number; col: number } | undefined {
	if (!state.editorHasFocus()) return undefined;
	return editor.getCursor();
}

/** True when ↑ can leave the editor for the option above. */
function cursorOnFirstRow(state: QuestionnaireState, editor: Editor): boolean {
	return editorCursor(state, editor)?.line === 0;
}

/** True when ↓ can leave the editor for the option below. */
function cursorOnLastRow(state: QuestionnaireState, editor: Editor): boolean {
	const cursor = editorCursor(state, editor);
	if (!cursor) return false;
	return cursor.line === editor.getLines().length - 1;
}

/** True when ←/→ should navigate between questionnaire tabs instead of moving
 * within the editor buffer. */
function cursorAtBufferStart(editor: Editor): boolean {
	const cursor = editor.getCursor();
	return cursor.line === 0 && cursor.col === 0;
}

function cursorAtBufferEnd(editor: Editor): boolean {
	const cursor = editor.getCursor();
	const lines = editor.getLines();
	const lastLine = lines[lines.length - 1];
	if (lastLine === undefined) return false;
	return cursor.line === lines.length - 1 && cursor.col >= lastLine.length;
}

export function runQuestionnaire<TUi>(
	custom: <T>(factory: CustomFactory<T>) => Promise<T>,
	questions: Question[],
	initialState?: QuestionnaireInitialState,
): Promise<AskResult> {
	return custom<AskResult>((tui, theme, keybindings, done) => {
		const editorTheme: EditorTheme = {
			borderColor: (s) => theme.fg("accent", s),
			selectList: {
				selectedPrefix: (t) => theme.fg("accent", t),
				selectedText: (t) => theme.fg("accent", t),
				description: (t) => theme.fg("muted", t),
				scrollInfo: (t) => theme.fg("dim", t),
				noMatch: (t) => theme.fg("warning", t),
			},
		};
		const editor = new Editor(tui as never, editorTheme, { paddingX: 0 });
		const editorPort: EditorPort = {
			getText: () => editor.getText(),
			setText: (text) => editor.setText(text),
		};
		const state = new QuestionnaireState(questions, editorPort, initialState);

		let cachedLines: string[] | undefined;
		let cachedWidth: number | undefined;

		function refresh(): void {
			cachedLines = undefined;
			cachedWidth = undefined;
			tui.requestRender();
		}

		function finish(cancelled: boolean): void {
			done({ questions, answers: state.collectedAnswers(), cancelled });
		}

		function finishChat(): void {
			const chat = state.chatRequest();
			if (chat) done({ questions, answers: state.collectedAnswers(), cancelled: false, chat });
		}

		function applyEffects(effects: QuestionnaireEffect[]): void {
			for (const effect of effects) {
				applyEffect(effect);
				if (effect === "submit" || effect === "cancel" || effect === "chat") return; // terminal
			}
		}

		function applyEffect(effect: QuestionnaireEffect): void {
			switch (effect) {
				case "render":
					refresh();
					return;
				case "advance": {
					const target = state.advanceTarget();
					if (target === "submit") finish(false);
					else {
						state.enterTab(target);
						refresh();
					}
					return;
				}
				case "submit":
					finish(false);
					return;
				case "cancel":
					finish(true);
					return;
				case "chat":
					finishChat();
					return;
			}
		}

		// Enter inside the always-visible free-text editor.
		editor.onSubmit = (value) => applyEffects(state.submitEditorText(value));

		function handleEditorKey(data: string): void {
			const q = state.currentQuestion();
			if (state.isMulti) {
				if (matchesKey(data, Key.tab)) {
					state.enterTab((state.tab + 1) % state.totalTabs);
					refresh();
					return;
				}
				if (matchesKey(data, Key.shift("tab"))) {
					state.enterTab((state.tab - 1 + state.totalTabs) % state.totalTabs);
					refresh();
					return;
				}
			}
			// ←/→ at the input's buffer edges navigate between questions. Inside
			// the buffer they retain the editor's normal cursor movement.
			if (q && !state.isOpenEnded(q) && state.isMulti && matchesKey(data, Key.right) && cursorAtBufferEnd(editor)) {
				state.enterTab((state.tab + 1) % state.totalTabs);
				refresh();
				return;
			}
			if (q && !state.isOpenEnded(q) && state.isMulti && matchesKey(data, Key.left) && cursorAtBufferStart(editor)) {
				state.enterTab((state.tab - 1 + state.totalTabs) % state.totalTabs);
				refresh();
				return;
			}
			// ↑/↓ at the editor's buffer edges leave the editor for the neighbouring
			// option row; inside the buffer they move the cursor.
			if (q && !state.isOpenEnded(q) && matchesKey(data, Key.up) && cursorOnFirstRow(state, editor)) {
				applyEffects(state.moveCursor(-1));
				return;
			}
			if (q && matchesKey(data, Key.down) && cursorOnLastRow(state, editor)) {
				applyEffects(state.moveCursor(1));
				return;
			}
			if (matchesKey(data, Key.escape)) {
				applyEffects(state.escape());
				return;
			}
			editor.handleInput(data);
			refresh();
		}

		function handleOptionKey(data: string): void {
			if (keybindings.matches(data, "tui.select.up")) {
				applyEffects(state.moveCursor(-1));
				return;
			}
			if (keybindings.matches(data, "tui.select.down")) {
				applyEffects(state.moveCursor(1));
				return;
			}
			const q = state.currentQuestion();
			if (!q) return;

			// Number keys 1-9: instant select (single) or toggle (multi)
			if (/^[1-9]$/.test(data)) {
				const idx = Number.parseInt(data, 10) - 1;
				if (idx >= state.currentOptions().length) return;
				applyEffects(q.multiSelect ? state.toggleMultiOption(idx) : state.selectOption(idx));
				return;
			}
			if (q.multiSelect && matchesKey(data, Key.space)) {
				applyEffects(state.toggleMultiOption(state.cursor));
				return;
			}
			if (matchesKey(data, Key.enter)) {
				const effects = state.isChatAction()
					? state.requestChat()
					: q.multiSelect
						? state.commitMultiSelection(q)
						: state.selectOption(state.cursor);
				applyEffects(effects);
				return;
			}
			if (matchesKey(data, Key.escape)) {
				applyEffects(state.escape());
			}
		}

		function handleInput(data: string): void {
			if (matchesKey(data, Key.ctrl("g"))) {
				applyEffects(state.requestChat());
				return;
			}

			// Editor focused (cursor on "Type something." or open-ended question):
			// route everything to the always-visible editor, including digits.
			if (state.editorHasFocus()) {
				handleEditorKey(data);
				return;
			}

			if (state.isMulti) {
				if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
					state.enterTab((state.tab + 1) % state.totalTabs);
					refresh();
					return;
				}
				if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
					state.enterTab((state.tab - 1 + state.totalTabs) % state.totalTabs);
					refresh();
					return;
				}
			}

			if (state.isOnSubmitTab()) {
				if (matchesKey(data, Key.enter) && state.allAnswered()) applyEffects(["submit"]);
				else if (matchesKey(data, Key.escape)) applyEffects(["cancel"]);
				return;
			}

			handleOptionKey(data);
		}

		return {
			render(width: number): string[] {
				if (!cachedLines || cachedWidth !== width) {
					cachedLines = renderQuestionnaire(state, questions, editor, theme, width);
					cachedWidth = width;
				}
				return cachedLines;
			},
			invalidate: () => {
				cachedLines = undefined;
				cachedWidth = undefined;
			},
			handleInput,
		};
	});
}
