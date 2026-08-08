/**
 * Pure navigation/selection state machine for the questionnaire.
 *
 * No TUI dependency: the editor text is mirrored via a small adapter, and
 * transitions that end the flow surface as QuestionnaireEffect for the
 * caller (the component) to apply. This keeps the logic unit-testable.
 */

import type { Answer, Question, RenderOption } from "./questionnaire-model";
import { UI_TEXT } from "./questionnaire-model";

/** Editor operations the state machine needs — implemented by the TUI editor. */
export interface EditorPort {
	getText(): string;
	setText(text: string): void;
}

/** Side effects the caller must apply after a transition. */
export type QuestionnaireEffect = "render" | "advance" | "submit" | "cancel";

const NO_EFFECT: QuestionnaireEffect[] = [];
const RENDER: QuestionnaireEffect[] = ["render"];

export class QuestionnaireState {
	readonly isMulti: boolean;
	readonly totalTabs: number;

	private currentTab = 0;
	private optionIndex = 0;
	private readonly answers = new Map<string, Answer>();
	private readonly multiSelections = new Map<string, Set<number>>();
	private readonly drafts = new Map<string, string>();

	constructor(
		private readonly questions: Question[],
		private readonly editor: EditorPort,
	) {
		this.isMulti = questions.length > 1;
		this.totalTabs = questions.length + 1; // questions + Submit
		this.enterTab(0);
	}

	// --- Read-side queries (used by the renderer) ---

	get tab(): number {
		return this.currentTab;
	}

	get cursor(): number {
		return this.optionIndex;
	}

	currentQuestion(): Question | undefined {
		return this.questions[this.currentTab];
	}

	isOnSubmitTab(): boolean {
		return this.currentTab === this.questions.length;
	}

	isOpenEnded(q: Question): boolean {
		return q.options.length === 0;
	}

	currentOptions(): RenderOption[] {
		const q = this.currentQuestion();
		if (!q || this.isOnSubmitTab()) return [];
		const opts: RenderOption[] = [...q.options];
		if (q.allowOther) {
			opts.push({ value: "", label: UI_TEXT.otherOptionLabel, isOther: true });
		}
		return opts;
	}

	typedText(): string {
		return this.editor.getText().trim();
	}

	/** Compact single-line preview of the typed text, for static rows. */
	typedPreview(maxLength: number): string {
		const flat = this.editor.getText().replace(/\s+/g, " ").trim();
		if (flat.length <= maxLength) return flat;
		return `${flat.slice(0, maxLength - 1)}…`;
	}

	isChecked(q: Question, index: number, isOther: boolean): boolean {
		if (!q.multiSelect) return false;
		if (isOther) return this.typedText().length > 0;
		return this.multiSelections.get(q.id)?.has(index) ?? false;
	}

	allAnswered(): boolean {
		return this.questions.every((q) => this.answers.has(q.id));
	}

	unansweredLabels(): string[] {
		return this.questions.filter((q) => !this.answers.has(q.id)).map((q) => q.label);
	}

	answerFor(questionId: string): Answer | undefined {
		return this.answers.get(questionId);
	}

	collectedAnswers(): Answer[] {
		return Array.from(this.answers.values());
	}

	/** The editor is focused whenever the cursor sits on the "Type something."
	 * row (or always for open-ended questions) — no separate input mode. */
	editorHasFocus(): boolean {
		const q = this.currentQuestion();
		if (!q || this.isOnSubmitTab()) return false;
		if (this.isOpenEnded(q)) return true;
		return q.allowOther && this.currentOptions()[this.optionIndex]?.isOther === true;
	}

	// --- Transitions ---

	/** Switch tab: preserve the free-text draft, restore the target tab's draft,
	 * and preselect the recommended option (or the "Type something." row when a
	 * custom draft exists). */
	enterTab(index: number): void {
		const prev = this.currentQuestion();
		if (prev && this.currentTab !== index && (!this.isOpenEnded(prev) || prev.allowOther)) {
			this.saveDraft(prev.id);
		}
		this.currentTab = index;
		const q = this.currentQuestion();
		if (!q || this.isOnSubmitTab()) {
			this.editor.setText("");
			return;
		}
		this.editor.setText(this.isOpenEnded(q) || q.allowOther ? (this.drafts.get(q.id) ?? "") : "");
		this.optionIndex = this.isOpenEnded(q) ? 0 : this.initialOptionIndex(q);
	}

	moveCursor(delta: -1 | 1): QuestionnaireEffect[] {
		const opts = this.currentOptions();
		const next = Math.min(Math.max(0, this.optionIndex + delta), opts.length - 1);
		if (next === this.optionIndex) return NO_EFFECT;
		this.optionIndex = next;
		return RENDER;
	}

	/** Enter inside the free-text editor. The submitted value must be passed in:
	 * the pi-tui Editor clears its buffer BEFORE calling onSubmit, so reading
	 * getText() at this point would always return "". */
	submitEditorText(submittedValue: string): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		if (!q) return NO_EFFECT;
		const text = submittedValue.trim();

		if (this.isOpenEnded(q)) {
			const answer = text || UI_TEXT.noResponse;
			this.answers.set(q.id, { kind: "single", id: q.id, value: answer, label: answer, wasCustom: true });
			return ["advance"];
		}

		if (q.multiSelect) {
			// Save the submitted text (not typedText(): the Editor already cleared
			// its buffer before onSubmit fired).
			if (text) this.drafts.set(q.id, text);
			else this.drafts.delete(q.id);
			return this.commitMultiSelection(q);
		}

		if (!text) {
			this.drafts.delete(q.id); // nothing typed: row stays in its static form
			return RENDER;
		}
		this.drafts.set(q.id, text);
		this.answers.set(q.id, { kind: "single", id: q.id, value: text, label: text, wasCustom: true });
		return ["advance"];
	}

	/** Enter on an option row (single-select) — the "Type something." row is
	 * unreachable here: it has editor focus, its Enter goes through submitEditorText. */
	selectOption(index: number): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		const opt = this.currentOptions()[index];
		if (!q || !opt) return NO_EFFECT;
		this.optionIndex = index;
		this.answers.set(q.id, { kind: "single", id: q.id, value: opt.value, label: opt.label, wasCustom: false, index: index + 1 });
		return ["advance"];
	}

	/** Space / digit in multiSelect mode — the "Type something." row is unreachable
	 * here: it has editor focus, so Space goes to the editor as a literal space. */
	toggleMultiOption(index: number): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		if (!q) return NO_EFFECT;
		let set = this.multiSelections.get(q.id);
		if (!set) {
			set = new Set<number>();
			this.multiSelections.set(q.id, set);
		}
		if (set.has(index)) set.delete(index);
		else set.add(index);
		return RENDER;
	}

	/** Enter in multiSelect mode: confirm checked options plus the typed text. */
	commitMultiSelection(q: Question): QuestionnaireEffect[] {
		const selected = this.multiSelections.get(q.id) ?? new Set<number>();
		const draft = this.drafts.get(q.id)?.trim();
		if (selected.size === 0 && !draft) return NO_EFFECT;
		const picked = [...selected].sort((a, b) => a - b);
		const opts = this.currentOptions();
		const labels = picked.map((i) => opts[i]?.label ?? "");
		const values = picked.map((i) => opts[i]?.value ?? "");
		if (draft) {
			labels.push(draft);
			values.push(draft);
		}
		this.answers.set(q.id, {
			kind: "multi",
			id: q.id,
			value: values.join(","),
			label: labels.join(", "),
			wasCustom: picked.length === 0,
			labels,
		});
		return ["advance"];
	}

	/** Esc behavior depends on context: editor with options -> back to first
	 * option; anywhere else -> cancel the whole flow. */
	escape(): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		if (this.editorHasFocus() && q && !this.isOpenEnded(q)) {
			this.optionIndex = 0;
			return RENDER;
		}
		return ["cancel"];
	}

	/** Where to go after an answer: next question, the Submit tab, or done. */
	advanceTarget(): "submit" | number {
		if (!this.isMulti) return "submit";
		if (this.currentTab < this.questions.length - 1) return this.currentTab + 1;
		return this.questions.length; // Submit tab
	}

	private saveDraft(questionId: string): void {
		const text = this.typedText();
		if (text) this.drafts.set(questionId, text);
		else this.drafts.delete(questionId); // keeps the row static again
	}

	private initialOptionIndex(q: Question): number {
		const opts = this.currentOptions();
		if (this.drafts.has(q.id)) {
			const otherIndex = opts.findIndex((o) => o.isOther);
			if (otherIndex >= 0) return otherIndex;
		}
		const recommendedIndex = opts.findIndex((o) => o.recommended);
		return recommendedIndex >= 0 ? recommendedIndex : 0;
	}
}
