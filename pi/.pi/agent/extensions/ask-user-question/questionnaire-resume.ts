import { UI_TEXT } from './questionnaire-model.ts'

import type {
	Answer,
	Question,
	QuestionnaireInitialState,
} from './questionnaire-model.ts'

export interface RestoredResponses {
	answers: Map<string, Answer>
	drafts: Map<string, string>
	multiSelections: Map<string, Set<number>>
}

function isOpenEnded(question: Question): boolean {
	return question.options.length === 0
}

function isAnswerCompatible(question: Question, answer: Answer): boolean {
	if (question.multiSelect !== (answer.kind === 'multi')) return false
	if (answer.kind === 'single') {
		if (!answer.wasCustom) {
			return question.options.some(
				option => option.value === answer.value,
			)
		}
		if (answer.value === UI_TEXT.noResponse) return isOpenEnded(question)
		return isOpenEnded(question) || question.allowOther
	}
	const hasValidCustomText =
		answer.customText === undefined ||
		(question.allowOther && answer.customText.trim().length > 0)
	return (
		hasValidCustomText &&
		(answer.optionValues.length > 0 || answer.customText !== undefined) &&
		new Set(answer.optionValues).size === answer.optionValues.length &&
		answer.optionValues.every(value =>
			question.options.some(option => option.value === value),
		)
	)
}

function restoreAnswer(
	question: Question,
	answer: Answer,
	drafts: Map<string, string>,
	multiSelections: Map<string, Set<number>>,
): Answer {
	if (answer.kind === 'single') {
		if (answer.wasCustom) {
			if (
				!(
					isOpenEnded(question) && answer.value === UI_TEXT.noResponse
				) &&
				!drafts.has(question.id)
			) {
				drafts.set(question.id, answer.value)
			}
			return answer
		}
		const option = question.options.find(
			candidate => candidate.value === answer.value,
		)
		if (!option) return answer
		return {
			...answer,
			label: option.label,
			index: question.options.indexOf(option) + 1,
		}
	}
	const selected = answer.optionValues.map(value =>
		question.options.findIndex(option => option.value === value),
	)
	multiSelections.set(question.id, new Set(selected))
	if (answer.customText && !drafts.has(question.id)) {
		drafts.set(question.id, answer.customText)
	}
	const labels = selected.map(index => question.options[index]?.label ?? '')
	if (answer.customText) labels.push(answer.customText)
	const values = [
		...answer.optionValues,
		...(answer.customText ? [answer.customText] : []),
	]
	return {
		...answer,
		value: values.join(','),
		label: labels.join(', '),
		wasCustom: answer.optionValues.length === 0,
		labels,
	}
}

export function restoreResponses(
	questions: Question[],
	initialState?: QuestionnaireInitialState,
): RestoredResponses {
	const answers = new Map<string, Answer>()
	const drafts = new Map<string, string>()
	const multiSelections = new Map<string, Set<number>>()
	if (!initialState) return { answers, drafts, multiSelections }

	for (const [questionId, draft] of Object.entries(
		initialState.drafts ?? {},
	)) {
		const question = questions.find(
			candidate => candidate.id === questionId,
		)
		if (
			draft.trim() &&
			question &&
			(isOpenEnded(question) || question.allowOther)
		) {
			drafts.set(questionId, draft)
		}
	}
	for (const answer of initialState.answers) {
		const question = questions.find(candidate => candidate.id === answer.id)
		if (!question || !isAnswerCompatible(question, answer)) continue
		answers.set(
			question.id,
			restoreAnswer(question, answer, drafts, multiSelections),
		)
	}
	return { answers, drafts, multiSelections }
}
