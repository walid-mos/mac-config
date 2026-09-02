import type { Answer, Question } from './questionnaire-model.ts'

function formatAnswerLine(questionLabel: string, answer: Answer): string {
	if (answer.wasCustom) return `${questionLabel}: user wrote: ${answer.label}`
	if (answer.kind === 'multi' && answer.labels.length > 1) {
		return `${questionLabel}: user selected multiple: ${answer.labels.join(', ')}`
	}
	const prefix =
		answer.kind === 'single' && answer.index !== undefined
			? `${answer.index}. `
			: ''
	return `${questionLabel}: user selected: ${prefix}${answer.label}`
}

export function formatAnswerLines(
	questions: Question[],
	answers: Answer[],
): string {
	const labels = new Map(
		questions.map(question => [question.id, question.label]),
	)
	return answers
		.map(answer =>
			formatAnswerLine(labels.get(answer.id) ?? answer.id, answer),
		)
		.join('\n')
}

export function questionnaireKey(questions: Question[]): string {
	return JSON.stringify(questions)
}

export function chatFollowUp(question: Question): string {
	return [
		`The user wants to chat about the question "${question.label}": ${question.prompt}`,
		'Discuss it with the user. When they are ready to answer, call ask_user_question again with the same questionnaire to resume their saved responses.',
	].join('\n')
}
