import { UI_TEXT } from './questionnaire-model.ts'
import { QuestionnaireResponses } from './questionnaire-responses.ts'

import type {
	Answer,
	Question,
	QuestionnaireChatRequest,
	QuestionnaireInitialState,
	RenderOption,
} from './questionnaire-model.ts'

export interface EditorPort {
	getText(): string
	setText(text: string): void
}

export type QuestionnaireEffect =
	| 'render'
	| 'advance'
	| 'submit'
	| 'cancel'
	| 'chat'

export const NO_EFFECT: QuestionnaireEffect[] = []
export const RENDER: QuestionnaireEffect[] = ['render']

/** Own read-side state, cursor movement and tab navigation. */
export class QuestionnaireNavigationState {
	readonly isMulti: boolean
	readonly totalTabs: number

	protected optionIndex = 0
	protected readonly questions: Question[]
	protected readonly editor: EditorPort
	protected readonly responses: QuestionnaireResponses
	private currentTab = 0
	private skipNextDraftSave = false

	constructor(
		questions: Question[],
		editor: EditorPort,
		initialState?: QuestionnaireInitialState,
	) {
		this.questions = questions
		this.editor = editor
		this.responses = new QuestionnaireResponses(questions, initialState)
		this.isMulti = questions.length > 1
		this.totalTabs = questions.length + 1
		const initialTab = this.firstUnansweredTab()
		this.currentTab = initialTab
		this.enterTab(initialTab)
	}

	get tab(): number {
		return this.currentTab
	}

	get cursor(): number {
		return this.optionIndex
	}

	currentQuestion(): Question | undefined {
		return this.questions[this.currentTab]
	}

	isOnSubmitTab(): boolean {
		return this.currentTab === this.questions.length
	}

	isOpenEnded(question: Question): boolean {
		return question.options.length === 0
	}

	canNavigateTabsFromInputEdges(): boolean {
		const question = this.currentQuestion()
		return Boolean(this.isMulti && question && !this.isOpenEnded(question))
	}

	chatActionIndex(): number {
		const question = this.currentQuestion()
		return question && this.isOpenEnded(question)
			? 0
			: this.currentOptions().length
	}

	isChatAction(): boolean {
		return Boolean(
			this.currentQuestion() &&
			this.optionIndex === this.chatActionIndex(),
		)
	}

	currentOptions(): RenderOption[] {
		const question = this.currentQuestion()
		if (!question || this.isOnSubmitTab()) return []
		const options: RenderOption[] = [...question.options]
		if (question.allowOther) {
			options.push({
				value: '',
				label: UI_TEXT.otherOptionLabel,
				isOther: true,
			})
		}
		return options
	}

	typedText(): string {
		return this.editor.getText().trim()
	}

	typedPreview(maxLength: number): string {
		const flat = this.editor.getText().replace(/\s+/g, ' ').trim()
		if (flat.length <= maxLength) return flat
		return `${flat.slice(0, maxLength - 1)}…`
	}

	isChecked(question: Question, index: number, isOther: boolean): boolean {
		return this.responses.isChecked(
			question,
			index,
			isOther,
			this.typedText(),
		)
	}

	allAnswered(): boolean {
		return this.responses.allAnswered()
	}

	unansweredLabels(): string[] {
		return this.responses.unansweredLabels()
	}

	answerFor(questionId: string): Answer | undefined {
		return this.responses.answerFor(questionId)
	}

	collectedAnswers(): Answer[] {
		return this.responses.collectedAnswers()
	}

	initialState(): QuestionnaireInitialState {
		const question = this.currentQuestion()
		if (question) this.saveDraft(question.id)
		return this.responses.initialState()
	}

	chatRequest(): QuestionnaireChatRequest | undefined {
		const question = this.currentQuestion()
		if (!question || this.isOnSubmitTab()) return undefined
		return { question, initialState: this.initialState() }
	}

	editorHasFocus(): boolean {
		const question = this.currentQuestion()
		if (!question || this.isOnSubmitTab() || this.isChatAction())
			return false
		if (this.isOpenEnded(question)) return true
		return Boolean(
			question.allowOther &&
			this.currentOptions()[this.optionIndex]?.isOther,
		)
	}

	enterTab(index: number): void {
		const previous = this.currentQuestion()
		if (previous && this.currentTab !== index) this.saveDraft(previous.id)
		this.currentTab = index
		const question = this.currentQuestion()
		if (!question || this.isOnSubmitTab()) {
			this.editor.setText('')
			return
		}
		this.editor.setText(
			this.isOpenEnded(question) || question.allowOther
				? this.responses.draftFor(question.id)
				: '',
		)
		this.optionIndex = this.isOpenEnded(question)
			? -1
			: this.responses.initialOptionIndex(question, this.currentOptions())
	}

	moveCursor(delta: -1 | 1): QuestionnaireEffect[] {
		const question = this.currentQuestion()
		const minIndex = question && this.isOpenEnded(question) ? -1 : 0
		const maxIndex = question
			? this.chatActionIndex()
			: Math.max(0, this.currentOptions().length - 1)
		const next = Math.min(
			Math.max(minIndex, this.optionIndex + delta),
			maxIndex,
		)
		if (next === this.optionIndex) return NO_EFFECT
		this.optionIndex = next
		return RENDER
	}

	advanceTarget(): 'submit' | number {
		if (!this.isMulti) return 'submit'
		return this.currentTab < this.questions.length - 1
			? this.currentTab + 1
			: this.questions.length
	}

	protected advanceAfterEditorSubmit(): QuestionnaireEffect[] {
		this.skipNextDraftSave = true
		return ['advance']
	}

	protected markEditorSubmission(): void {
		this.skipNextDraftSave = true
	}

	private firstUnansweredTab(): number {
		const index = this.questions.findIndex(
			question => !this.responses.answerFor(question.id),
		)
		return index >= 0 ? index : this.questions.length
	}

	private saveDraft(questionId: string): void {
		if (this.skipNextDraftSave) {
			this.skipNextDraftSave = false
			return
		}
		this.responses.saveDraft(questionId, this.typedText())
	}
}
