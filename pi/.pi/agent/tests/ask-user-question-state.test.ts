import assert from 'node:assert/strict'
import test from 'node:test'

import { QuestionnaireState } from '../extensions/ask-user-question/questionnaire-state.ts'

import type {
	Question,
	QuestionnaireInitialState,
} from '../extensions/ask-user-question/questionnaire-model.ts'

class MemoryEditor {
	text = ''

	getText(): string {
		return this.text
	}

	setText(text: string): void {
		this.text = text
	}
}

function question(id: string, overrides: Partial<Question> = {}): Question {
	return {
		id,
		label: id.toUpperCase(),
		prompt: `Choose ${id}`,
		options: [
			{ value: `${id}-a`, label: 'A' },
			{ value: `${id}-b`, label: 'B' },
		],
		allowOther: true,
		multiSelect: false,
		...overrides,
	}
}

function stateFor(
	questions: Question[],
	initialState?: QuestionnaireInitialState,
): { state: QuestionnaireState; editor: MemoryEditor } {
	const editor = new MemoryEditor()
	return {
		state: new QuestionnaireState(questions, editor, initialState),
		editor,
	}
}

test('single-select digit targeting the custom row focuses the editor', () => {
	const q = question('q1')
	const { state } = stateFor([q])

	assert.deepEqual(state.selectOption(q.options.length), ['render'])
	assert.equal(state.editorHasFocus(), true)
	assert.deepEqual(state.collectedAnswers(), [])
})

test('multi-select digit targeting the custom row focuses the editor', () => {
	const q = question('q1', { multiSelect: true })
	const { state } = stateFor([q])

	assert.deepEqual(state.toggleMultiOption(q.options.length), ['render'])
	assert.equal(state.editorHasFocus(), true)
	assert.deepEqual(state.collectedAnswers(), [])
})

test('multi-select commit includes live custom text after leaving the editor', () => {
	const q = question('q1', { multiSelect: true })
	const { state, editor } = stateFor([q])
	state.toggleMultiOption(q.options.length)
	state.toggleMultiOption(0)
	editor.text = 'custom answer'
	state.moveCursor(-1)

	assert.deepEqual(state.commitMultiSelection(q), ['advance'])
	assert.deepEqual(state.collectedAnswers(), [
		{
			kind: 'multi',
			id: 'q1',
			value: 'q1-a,custom answer',
			label: 'A, custom answer',
			wasCustom: false,
			labels: ['A', 'custom answer'],
			optionValues: ['q1-a'],
			customText: 'custom answer',
		},
	])
})

test('collected answers follow questionnaire order after tab navigation', () => {
	const first = question('q1')
	const second = question('q2')
	const { state } = stateFor([first, second])
	state.enterTab(1)
	state.selectOption(0)
	state.enterTab(0)
	state.selectOption(1)

	assert.deepEqual(
		state.collectedAnswers().map(answer => answer.id),
		['q1', 'q2'],
	)
})
