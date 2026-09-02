import type { Question, QuestionOption } from './questionnaire-model.ts'

export interface RawQuestionOption {
	value?: string
	label: string
	description?: string
	recommended?: boolean
}

export interface RawQuestion {
	id: string
	label?: string
	prompt: string
	options?: RawQuestionOption[]
	multiSelect?: boolean
	allowOther?: boolean
}

function requiredText(value: string, field: string): string {
	const normalized = value.trim()
	if (!normalized) throw new Error(`${field} must not be blank`)
	return normalized
}

function normalizeOptions(
	questionId: string,
	rawOptions: RawQuestionOption[],
): QuestionOption[] {
	const values = new Set<string>()
	return rawOptions.map((option, index) => {
		const label = requiredText(
			option.label,
			`Question "${questionId}" option ${index + 1} label`,
		)
		const value = requiredText(
			option.value ?? label,
			`Question "${questionId}" option ${index + 1} value`,
		)
		if (values.has(value)) {
			throw new Error(
				`Question "${questionId}" has duplicate option value "${value}"`,
			)
		}
		values.add(value)
		return {
			value,
			label,
			description: option.description?.trim() || undefined,
			recommended: option.recommended,
		}
	})
}

/** Map validated tool arguments into the stricter questionnaire domain. */
export function normalizeQuestions(raw: RawQuestion[]): Question[] {
	const ids = new Set<string>()
	return raw.map((question, index) => {
		const id = requiredText(question.id, `Question ${index + 1} id`)
		if (ids.has(id)) throw new Error(`Duplicate question id "${id}"`)
		ids.add(id)
		const options = normalizeOptions(id, question.options ?? [])
		return {
			id,
			label: requiredText(
				question.label ?? `Q${index + 1}`,
				'Question label',
			),
			prompt: requiredText(question.prompt, `Question "${id}" prompt`),
			options,
			allowOther: question.allowOther !== false,
			multiSelect: options.length > 0 && question.multiSelect === true,
		}
	})
}
