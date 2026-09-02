import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeQuestions } from '../extensions/ask-user-question/questionnaire-normalization.ts'

test('normalization trims text and applies questionnaire defaults', () => {
	assert.deepEqual(
		normalizeQuestions([
			{
				id: ' scope ',
				prompt: ' Choose a scope ',
				options: [
					{ label: ' Focused ', description: ' Small change ' },
				],
			},
		]),
		[
			{
				id: 'scope',
				label: 'Q1',
				prompt: 'Choose a scope',
				options: [
					{
						value: 'Focused',
						label: 'Focused',
						description: 'Small change',
						recommended: undefined,
					},
				],
				allowOther: true,
				multiSelect: false,
			},
		],
	)
})

test('open-ended questions cannot remain multi-select', () => {
	const [question] = normalizeQuestions([
		{ id: 'details', prompt: 'Explain', multiSelect: true },
	])
	assert.equal(question?.multiSelect, false)
})

test('duplicate normalized question ids are rejected', () => {
	assert.throws(
		() =>
			normalizeQuestions([
				{ id: 'scope', prompt: 'First' },
				{ id: ' scope ', prompt: 'Second' },
			]),
		/Duplicate question id "scope"/,
	)
})

test('duplicate normalized option values are rejected', () => {
	assert.throws(
		() =>
			normalizeQuestions([
				{
					id: 'scope',
					prompt: 'Choose',
					options: [
						{ label: 'First', value: 'same' },
						{ label: 'Second', value: ' same ' },
					],
				},
			]),
		/duplicate option value "same"/,
	)
})

test('blank semantic fields are rejected after trimming', () => {
	assert.throws(
		() => normalizeQuestions([{ id: ' ', prompt: 'Choose' }]),
		/Question 1 id must not be blank/,
	)
	assert.throws(
		() => normalizeQuestions([{ id: 'scope', prompt: ' ' }]),
		/Question "scope" prompt must not be blank/,
	)
})
