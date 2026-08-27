/**
 * Domain model for the ask_user_question tool.
 *
 * Two layers, mapped at the boundary by normalizeQuestions():
 * - Raw*: what the LLM sends, validated by schema.ts (infrastructure).
 * - Question/Answer/AskResult: the normalized domain the UI works with.
 */

// Domain vocabulary shared by the UI modules (state, render, component).
export const UI_TEXT = {
	otherOptionLabel: "Type something.",
	otherPlaceholder: "Type something...",
	noResponse: "(no response)",
} as const;

/** Max characters of a typed answer shown on the static "Type something." row. */
export const ANSWER_PREVIEW_MAX_LENGTH = 50;

export interface QuestionOption {
	value: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

/** An option row as rendered: a real option, or the synthetic "Type something." row. */
export type RenderOption = QuestionOption & { isOther?: boolean };

export interface Question {
	id: string;
	label: string;
	prompt: string;
	options: QuestionOption[];
	allowOther: boolean;
	multiSelect: boolean;
}

export interface AnswerBase {
	id: string;
	label: string;
	value: string;
	wasCustom: boolean;
}

/** Answer to a single-select question; `index` is the 1-based option number for non-custom picks. */
export interface SingleAnswer extends AnswerBase {
	kind: "single";
	index?: number;
}

/** Answer to a multiSelect question: every picked label, including typed text when present. */
export interface MultiAnswer extends AnswerBase {
	kind: "multi";
	labels: string[];
	/** Stable values of the selected options, in display order. */
	optionValues: string[];
	/** The committed free-text selection, when present. */
	customText?: string;
}

export type Answer = SingleAnswer | MultiAnswer;

/** Serializable questionnaire state used when returning from a chat pause. */
export interface QuestionnaireInitialState {
	answers: Answer[];
	drafts?: Record<string, string>;
}

/** The current question and state needed to resume after chatting with the agent. */
export interface QuestionnaireChatRequest {
	question: Question;
	initialState: QuestionnaireInitialState;
}

export interface AskResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
	chat?: QuestionnaireChatRequest;
}
