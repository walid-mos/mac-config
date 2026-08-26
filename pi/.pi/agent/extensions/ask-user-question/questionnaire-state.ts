/**
 * Pure navigation/selection state machine for the questionnaire.
 *
 * No TUI dependency: the editor text is mirrored via a small adapter, and
 * transitions that end the flow surface as QuestionnaireEffect for the
 * caller (the component) to apply. This keeps the logic unit-testable.
 */

import type {
	Answer,
	Question,
	QuestionnaireChatRequest,
	QuestionnaireInitialState,
	RenderOption,
} from "./questionnaire-model";
import { UI_TEXT } from "./questionnaire-model";

/** Editor operations the state machine needs — implemented by the TUI editor. */
export interface EditorPort {
	getText(): string;
	setText(text: string): void;
}

/** Side effects the caller must apply after a transition. */
export type QuestionnaireEffect = "render" | "advance" | "submit" | "cancel" | "chat";

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
	/** Set by submitEditorText: the TUI Editor clears its buffer BEFORE calling
	 * onSubmit, so the empty buffer seen by the auto-advance's saveDraft must not
	 * be treated as "the user erased the draft". Consumed once. */
	private skipNextDraftSave = false;

	constructor(
		private readonly questions: Question[],
		private readonly editor: EditorPort,
		initialState?: QuestionnaireInitialState,
	) {
		this.isMulti = questions.length > 1;
		this.totalTabs = questions.length + 1; // questions + Submit
		this.restoreInitialState(initialState);
		const initialTab = this.firstUnansweredTab();
		this.currentTab = initialTab;
		this.enterTab(initialTab);
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

	/** The synthetic row immediately below the answer options. */
	chatActionIndex(): number {
		const q = this.currentQuestion();
		return q && this.isOpenEnded(q) ? 0 : this.currentOptions().length;
	}

	isChatAction(): boolean {
		const q = this.currentQuestion();
		return Boolean(q && this.optionIndex === this.chatActionIndex());
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

	initialState(): QuestionnaireInitialState {
		const currentQuestion = this.currentQuestion();
		if (currentQuestion) this.saveDraft(currentQuestion.id);
		return {
			answers: this.collectedAnswers(),
			drafts: Object.fromEntries(this.drafts),
		};
	}

	chatRequest(): QuestionnaireChatRequest | undefined {
		const question = this.currentQuestion();
		if (!question || this.isOnSubmitTab()) return undefined;
		return { question, initialState: this.initialState() };
	}

	/** The editor is focused whenever the cursor sits on the "Type something."
	 * row (or always for open-ended questions) — no separate input mode. */
	editorHasFocus(): boolean {
		const q = this.currentQuestion();
		if (!q || this.isOnSubmitTab() || this.isChatAction()) return false;
		if (this.isOpenEnded(q)) return true;
		return q.allowOther && this.currentOptions()[this.optionIndex]?.isOther === true;
	}

	// --- Transitions ---

	/** Switch tab: preserve the free-text draft, restore the target tab's draft,
	 * and preselect the recommended option (or the "Type something." row when a
	 * custom draft exists). */
	enterTab(index: number): void {
		const prev = this.currentQuestion();
		if (prev && this.currentTab !== index) {
			this.saveDraft(prev.id);
		}
		this.currentTab = index;
		const q = this.currentQuestion();
		if (!q || this.isOnSubmitTab()) {
			this.editor.setText("");
			return;
		}
		this.editor.setText(this.isOpenEnded(q) || q.allowOther ? (this.drafts.get(q.id) ?? "") : "");
		this.optionIndex = this.isOpenEnded(q) ? -1 : this.initialOptionIndex(q);
	}

	moveCursor(delta: -1 | 1): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		const opts = this.currentOptions();
		const minIndex = q && this.isOpenEnded(q) ? -1 : 0;
		const maxIndex = q ? this.chatActionIndex() : Math.max(0, opts.length - 1);
		const next = Math.min(Math.max(minIndex, this.optionIndex + delta), maxIndex);
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
			if (text) this.drafts.set(q.id, text);
			this.answers.set(q.id, { kind: "single", id: q.id, value: answer, label: answer, wasCustom: true });
			// The Editor already cleared its buffer: the next saveDraft (auto-advance)
			// would otherwise wipe the draft we just recorded.
			this.skipNextDraftSave = true;
			return ["advance"];
		}

		if (q.multiSelect) {
			// Save the submitted text (not typedText(): the Editor already cleared
			// its buffer before onSubmit fired).
			if (text) this.drafts.set(q.id, text);
			else this.drafts.delete(q.id);
			const effects = this.commitMultiSelection(q);
			if (effects.includes("advance")) this.skipNextDraftSave = true;
			return effects;
		}

		if (!text) {
			this.drafts.delete(q.id); // nothing typed: row stays in its static form
			return RENDER;
		}
		this.drafts.set(q.id, text);
		this.answers.set(q.id, { kind: "single", id: q.id, value: text, label: text, wasCustom: true });
		// The Editor already cleared its buffer before onSubmit; preserve the
		// submitted draft when the component immediately advances tabs.
		this.skipNextDraftSave = true;
		return ["advance"];
	}

	/** Enter on an option row (single-select) — the "Type something." row is
	 * unreachable here: it has editor focus, its Enter goes through submitEditorText. */
	selectOption(index: number): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		if (!q) return NO_EFFECT;
		if (!this.isOpenEnded(q) && index === this.chatActionIndex()) return this.requestChat();
		const opt = this.currentOptions()[index];
		if (!opt) return NO_EFFECT;
		this.editor.setText("");
		this.drafts.delete(q.id);
		this.optionIndex = index;
		this.answers.set(q.id, { kind: "single", id: q.id, value: opt.value, label: opt.label, wasCustom: false, index: index + 1 });
		return ["advance"];
	}

	/** Space / digit in multiSelect mode — the "Type something." row is unreachable
	 * here: it has editor focus, so Space goes to the editor as a literal space. */
	toggleMultiOption(index: number): QuestionnaireEffect[] {
		const q = this.currentQuestion();
		if (!q || index >= this.currentOptions().length) return NO_EFFECT;
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
			optionValues: picked.map((index) => q.options[index]?.value ?? ""),
			...(draft ? { customText: draft } : {}),
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

	/** Pause the questionnaire so the caller can open a chat for this question. */
	requestChat(): QuestionnaireEffect[] {
		return this.chatRequest() ? ["chat"] : NO_EFFECT;
	}

	/** Where to go after an answer: next question, the Submit tab, or done. */
	advanceTarget(): "submit" | number {
		if (!this.isMulti) return "submit";
		if (this.currentTab < this.questions.length - 1) return this.currentTab + 1;
		return this.questions.length; // Submit tab
	}

	private restoreInitialState(initialState: QuestionnaireInitialState | undefined): void {
		if (!initialState) return;
		for (const [questionId, draft] of Object.entries(initialState.drafts ?? {})) {
			const question = this.questions.find((candidate) => candidate.id === questionId);
			if (draft.trim() && question && (this.isOpenEnded(question) || question.allowOther)) {
				this.drafts.set(questionId, draft);
			}
		}
		for (const answer of initialState.answers) {
			const question = this.questions.find((candidate) => candidate.id === answer.id);
			if (!question || !this.isAnswerCompatible(question, answer)) continue;
			this.answers.set(question.id, this.restoreAnswerState(question, answer));
		}
	}

	private isAnswerCompatible(question: Question, answer: Answer): boolean {
		if (question.multiSelect !== (answer.kind === "multi")) return false;
		if (answer.kind === "single") {
			if (!answer.wasCustom) return question.options.some((option) => option.value === answer.value);
			if (answer.value === UI_TEXT.noResponse) return this.isOpenEnded(question);
			return this.isOpenEnded(question) || question.allowOther;
		}
		const hasValidCustomText = answer.customText === undefined || (question.allowOther && answer.customText.trim().length > 0);
		return (
			hasValidCustomText &&
			(answer.optionValues.length > 0 || answer.customText !== undefined) &&
			new Set(answer.optionValues).size === answer.optionValues.length &&
			answer.optionValues.every((value) => question.options.some((option) => option.value === value))
		);
	}

	private restoreAnswerState(question: Question, answer: Answer): Answer {
		if (answer.kind === "single") {
			if (answer.wasCustom) {
				if (!(this.isOpenEnded(question) && answer.value === UI_TEXT.noResponse) && !this.drafts.has(question.id)) {
					this.drafts.set(question.id, answer.value);
				}
				return answer;
			}
			const option = question.options.find((candidate) => candidate.value === answer.value);
			if (!option) return answer;
			return { ...answer, label: option.label, index: question.options.indexOf(option) + 1 };
		}
		const selected = answer.optionValues.map((value) => question.options.findIndex((option) => option.value === value));
		this.multiSelections.set(question.id, new Set(selected));
		if (answer.customText && !this.drafts.has(question.id)) this.drafts.set(question.id, answer.customText);
		const labels = selected.map((index) => question.options[index]?.label ?? "");
		if (answer.customText) labels.push(answer.customText);
		const values = [...answer.optionValues, ...(answer.customText ? [answer.customText] : [])];
		return {
			...answer,
			value: values.join(","),
			label: labels.join(", "),
			wasCustom: answer.optionValues.length === 0,
			labels,
		};
	}

	private firstUnansweredTab(): number {
		const index = this.questions.findIndex((question) => !this.answers.has(question.id));
		return index >= 0 ? index : this.questions.length;
	}

	private saveDraft(questionId: string): void {
		if (this.skipNextDraftSave) {
			this.skipNextDraftSave = false;
			return;
		}
		const text = this.typedText();
		if (text) this.drafts.set(questionId, text);
		else this.drafts.delete(questionId); // keeps the row static again
	}

	private initialOptionIndex(q: Question): number {
		const opts = this.currentOptions();
		const answer = this.answers.get(q.id);
		if (answer?.kind === "single" && !answer.wasCustom) {
			const selectedIndex = opts.findIndex((option) => option.value === answer.value);
			if (selectedIndex >= 0) return selectedIndex;
		}
		if (this.drafts.has(q.id)) {
			const otherIndex = opts.findIndex((o) => o.isOther);
			if (otherIndex >= 0) return otherIndex;
		}
		const recommendedIndex = opts.findIndex((o) => o.recommended);
		return recommendedIndex >= 0 ? recommendedIndex : 0;
	}
}
