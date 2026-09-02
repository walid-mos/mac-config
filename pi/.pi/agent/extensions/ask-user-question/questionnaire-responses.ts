import { restoreResponses } from './questionnaire-resume.ts'

import type {
	Answer,
	Question,
	QuestionnaireInitialState,
	QuestionOption,
	RenderOption,
} from './questionnaire-model.ts'

/** Own questionnaire answers, drafts and multi-selection persistence. */
export class QuestionnaireResponses {
	private readonly questions: Question[]
	private readonly answers: Map<string, Answer>
	private readonly multiSelections: Map<string, Set<number>>
	private readonly drafts: Map<string, string>

	constructor(
		questions: Question[],
		initialState?: QuestionnaireInitialState,
	) {
		this.questions = questions
		const restored = restoreResponses(questions, initialState)
		this.answers = restored.answers
		this.multiSelections = restored.multiSelections
		this.drafts = restored.drafts
	}

	answerFor(questionId: string): Answer | undefined {
		return this.answers.get(questionId)
	}

	collectedAnswers(): Answer[] {
		return this.questions.flatMap(question => {
			const answer = this.answers.get(question.id)
			return answer ? [answer] : []
		})
	}

	allAnswered(): boolean {
		return this.questions.every(question => this.answers.has(question.id))
	}

	unansweredLabels(): string[] {
		return this.questions
			.filter(question => !this.answers.has(question.id))
			.map(question => question.label)
	}

	initialState(): QuestionnaireInitialState {
		return {
			answers: this.collectedAnswers(),
			drafts: Object.fromEntries(this.drafts),
		}
	}

	draftFor(questionId: string): string {
		return this.drafts.get(questionId) ?? ''
	}

	hasDraft(questionId: string): boolean {
		return this.drafts.has(questionId)
	}

	saveDraft(questionId: string, text: string): void {
		if (text) this.drafts.set(questionId, text)
		else this.drafts.delete(questionId)
	}

	clearDraft(questionId: string): void {
		this.drafts.delete(questionId)
	}

	isChecked(
		question: Question,
		index: number,
		isOther: boolean,
		typedText: string,
	): boolean {
		if (!question.multiSelect) return false
		if (isOther) return typedText.length > 0
		return this.multiSelections.get(question.id)?.has(index) ?? false
	}

	recordCustomAnswer(question: Question, text: string): void {
		this.answers.set(question.id, {
			kind: 'single',
			id: question.id,
			value: text,
			label: text,
			wasCustom: true,
		})
	}

	recordOptionAnswer(
		question: Question,
		option: QuestionOption,
		index: number,
	): void {
		this.answers.set(question.id, {
			kind: 'single',
			id: question.id,
			value: option.value,
			label: option.label,
			wasCustom: false,
			index: index + 1,
		})
	}

	toggleOption(questionId: string, index: number): void {
		let selection = this.multiSelections.get(questionId)
		if (!selection) {
			selection = new Set<number>()
			this.multiSelections.set(questionId, selection)
		}
		if (selection.has(index)) selection.delete(index)
		else selection.add(index)
	}

	commitMultiAnswer(
		question: Question,
		options: RenderOption[],
		draft: string,
	): boolean {
		this.saveDraft(question.id, draft)
		const selection = this.multiSelections.get(question.id) ?? new Set()
		if (selection.size === 0 && !draft) return false
		const picked = [...selection].toSorted((a, b) => a - b)
		const labels = picked.map(index => options[index]?.label ?? '')
		const values = picked.map(index => options[index]?.value ?? '')
		if (draft) {
			labels.push(draft)
			values.push(draft)
		}
		this.answers.set(question.id, {
			kind: 'multi',
			id: question.id,
			value: values.join(','),
			label: labels.join(', '),
			wasCustom: picked.length === 0,
			labels,
			optionValues: picked.map(
				index => question.options[index]?.value ?? '',
			),
			...(draft ? { customText: draft } : {}),
		})
		return true
	}

	initialOptionIndex(question: Question, options: RenderOption[]): number {
		const answer = this.answers.get(question.id)
		if (answer?.kind === 'single' && !answer.wasCustom) {
			const savedIndex =
				answer.index === undefined ? -1 : answer.index - 1
			if (
				savedIndex >= 0 &&
				options[savedIndex]?.value === answer.value
			) {
				return savedIndex
			}
			const selectedIndex = options.findIndex(
				option => option.value === answer.value,
			)
			if (selectedIndex >= 0) return selectedIndex
		}
		if (this.drafts.has(question.id)) {
			const otherIndex = options.findIndex(option => option.isOther)
			if (otherIndex >= 0) return otherIndex
		}
		const recommendedIndex = options.findIndex(option => option.recommended)
		return recommendedIndex >= 0 ? recommendedIndex : 0
	}
}
