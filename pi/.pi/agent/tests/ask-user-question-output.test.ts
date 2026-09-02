import assert from 'node:assert/strict'
import test from 'node:test'

import {
	formatAnswerLines,
	questionnaireKey,
} from '../extensions/ask-user-question/questionnaire-output.ts'

import type {
	Answer,
	Question,
} from '../extensions/ask-user-question/questionnaire-model.ts'

const questions: Question[] = [
	{
		id: 'scope',
		label: 'Scope',
		prompt: 'Choose scope',
		options: [{ value: 'focused', label: 'Focused' }],
		allowOther: true,
		multiSelect: false,
	},
	{
		id: 'checks',
		label: 'Checks',
		prompt: 'Choose checks',
		options: [],
		allowOther: true,
		multiSelect: false,
	},
]

test('answer output uses questionnaire order labels and answer semantics', () => {
	const answers: Answer[] = [
		{
			kind: 'single',
			id: 'scope',
			value: 'focused',
			label: 'Focused',
			wasCustom: false,
			index: 1,
		},
		{
			kind: 'single',
			id: 'checks',
			value: 'Run all',
			label: 'Run all',
			wasCustom: true,
		},
	]

	assert.equal(
		formatAnswerLines(questions, answers),
		'Scope: user selected: 1. Focused\nChecks: user wrote: Run all',
	)
})

test('questionnaire key includes every normalized domain field', () => {
	const changed = structuredClone(questions)
	changed[0]!.options[0]!.recommended = true

	assert.notEqual(questionnaireKey(questions), questionnaireKey(changed))
	assert.equal(questionnaireKey(questions), questionnaireKey(questions))
})
