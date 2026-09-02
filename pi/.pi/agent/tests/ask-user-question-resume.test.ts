import assert from 'node:assert/strict'
import test from 'node:test'

import { restoreResponses } from '../extensions/ask-user-question/questionnaire-resume.ts'

import type {
	Question,
	QuestionnaireInitialState,
} from '../extensions/ask-user-question/questionnaire-model.ts'

function question(overrides: Partial<Question> = {}): Question {
	return {
		id: 'scope',
		label: 'Scope',
		prompt: 'Choose scope',
		options: [
			{ value: 'focused', label: 'Focused' },
			{ value: 'complete', label: 'Complete' },
		],
		allowOther: true,
		multiSelect: false,
		...overrides,
	}
}

test('single option resumes by stable value after labels and positions change', () => {
	const updated = question({
		options: [
			{ value: 'complete', label: 'Everything' },
			{ value: 'focused', label: 'Targeted' },
		],
	})
	const initial: QuestionnaireInitialState = {
		answers: [
			{
				kind: 'single',
				id: 'scope',
				value: 'focused',
				label: 'Old label',
				wasCustom: false,
				index: 1,
			},
		],
	}

	assert.deepEqual(
		restoreResponses([updated], initial).answers.get('scope'),
		{
			...initial.answers[0],
			label: 'Targeted',
			index: 2,
		},
	)
})

test('multi-select resume rebuilds selections and current labels', () => {
	const multi = question({ multiSelect: true })
	const initial: QuestionnaireInitialState = {
		answers: [
			{
				kind: 'multi',
				id: 'scope',
				value: 'stale',
				label: 'stale',
				wasCustom: false,
				labels: ['stale'],
				optionValues: ['complete'],
				customText: 'Other detail',
			},
		],
	}
	const restored = restoreResponses([multi], initial)

	assert.deepEqual(restored.multiSelections.get('scope'), new Set([1]))
	assert.equal(restored.drafts.get('scope'), 'Other detail')
	assert.deepEqual(restored.answers.get('scope'), {
		...initial.answers[0],
		value: 'complete,Other detail',
		label: 'Complete, Other detail',
		labels: ['Complete', 'Other detail'],
	})
})

test('incompatible persisted answers are ignored', () => {
	const initial: QuestionnaireInitialState = {
		answers: [
			{
				kind: 'single',
				id: 'scope',
				value: 'removed',
				label: 'Removed',
				wasCustom: false,
			},
		],
	}

	assert.equal(restoreResponses([question()], initial).answers.size, 0)
})
