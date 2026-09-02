import { visibleWidth } from '@earendil-works/pi-tui'

import { innerBand } from './questionnaire-frame.ts'
import { GLYPH } from './questionnaire-theme.ts'
import {
	ANSWER_PREVIEW_MAX_LENGTH,
	type Question,
	UI_TEXT,
} from './questionnaire-model.ts'
import { pushWrappedWithPrefix } from './questionnaire-render-primitives.ts'

import type {
	LineSink,
	QuestionnairePalette,
} from './questionnaire-render-primitives.ts'
import type { QuestionnaireState } from './questionnaire-state.ts'
import type { Editor } from '@earendil-works/pi-tui'

export function renderTabBar(
	state: QuestionnaireState,
	questions: Question[],
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const chips = questions.map((question, index) => {
		const answered = state.answerFor(question.id) !== undefined
		const active = index === state.tab
		const status = answered
			? theme.fg('success', GLYPH.done)
			: theme.fg('dim', GLYPH.radioOff)
		const label = ` ${status} ${question.label} `
		if (active) {
			return theme.bg('selectedBg', theme.fg('text', theme.bold(label)))
		}
		return theme.fg(answered ? 'muted' : 'dim', label)
	})
	const canSubmit = state.allAnswered()
	const submitActive = state.isOnSubmitTab()
	const submitLabel = ` ${theme.fg(canSubmit ? 'success' : 'dim', GLYPH.done)} submit `
	const submitChip = submitActive
		? theme.bg('selectedBg', theme.fg('text', theme.bold(submitLabel)))
		: theme.fg(canSubmit ? 'muted' : 'dim', submitLabel)
	pushWrappedWithPrefix(
		sink,
		' ',
		[...chips, submitChip].join(theme.fg('dim', ' ')),
		width,
	)
}

export function renderQuestionBody(
	state: QuestionnaireState,
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const question = state.currentQuestion()
	if (!question) return
	sink('')
	pushWrappedWithPrefix(
		sink,
		' ',
		theme.fg('text', theme.bold(question.prompt)) +
			(question.multiSelect ? theme.fg('dim', '  ·  pick many') : ''),
		width,
	)
	sink('')
	if (state.isOpenEnded(question)) {
		renderOpenEndedEditor(editor, theme, width, sink)
	} else {
		renderOptions(state, question, editor, theme, width, sink)
	}
	renderChatAction(state, theme, width, sink)
}

function renderOptions(
	state: QuestionnaireState,
	question: Question,
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const options = state.currentOptions()
	for (let index = 0; index < options.length; index++) {
		const option = options[index]
		if (!option) continue
		renderOptionRow(
			state,
			question,
			option,
			index,
			editor,
			theme,
			width,
			sink,
		)
	}
}

function optionMarker(
	theme: QuestionnairePalette,
	multiSelect: boolean,
	checked: boolean,
): string {
	if (multiSelect) {
		return theme.fg(
			checked ? 'success' : 'dim',
			checked ? GLYPH.checkOn : GLYPH.checkOff,
		)
	}
	return theme.fg(
		checked ? 'success' : 'dim',
		checked ? GLYPH.radioOn : GLYPH.radioOff,
	)
}

function renderOptionRow(
	state: QuestionnaireState,
	question: Question,
	option: {
		value: string
		label: string
		description?: string
		recommended?: boolean
		isOther?: boolean
	},
	index: number,
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const isCursor = index === state.cursor
	const isOther = option.isOther === true
	const isChecked = state.isChecked(question, index, isOther)
	const marker = optionMarker(theme, question.multiSelect, isChecked)
	const number = theme.fg('dim', `${index + 1}.`)
	const rowPrefix = `${marker} ${number} `

	if (isOther) {
		renderOtherRow(state, editor, rowPrefix, isCursor, theme, width, sink)
		return
	}

	const label = theme.fg(
		'text',
		isCursor ? theme.bold(option.label) : option.label,
	)
	const badge = option.recommended
		? theme.fg('success', ` ${GLYPH.star} recommended`)
		: ''
	const row = `${rowPrefix}${label}${badge}`
	sink(isCursor ? innerBand(row, width) : row)
	if (option.description) {
		pushWrappedWithPrefix(
			sink,
			`   ${theme.fg('dim', GLYPH.desc)} `,
			theme.fg('dim', option.description),
			width,
		)
	}
}

function renderOtherRow(
	state: QuestionnaireState,
	editor: Editor,
	rowPrefix: string,
	isCursor: boolean,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	if (!state.editorHasFocus()) {
		const preview = state.typedPreview(ANSWER_PREVIEW_MAX_LENGTH)
		const body = preview
			? theme.fg('muted', preview)
			: theme.fg(
					isCursor ? 'text' : 'muted',
					isCursor
						? theme.bold(UI_TEXT.otherOptionLabel)
						: UI_TEXT.otherOptionLabel,
				)
		const row = `${rowPrefix}${body}`
		sink(isCursor ? innerBand(row, width) : row)
		return
	}
	const editorLines = editorBody(editor, width - visibleWidth(rowPrefix))
	if (editor.getText().length === 0) {
		sink(
			innerBand(
				`${rowPrefix}${theme.fg('dim', UI_TEXT.otherPlaceholder)}`,
				width,
			),
		)
		return
	}
	const continuation = ' '.repeat(visibleWidth(rowPrefix))
	for (let index = 0; index < editorLines.length; index++) {
		const line = `${index === 0 ? rowPrefix : continuation}${editorLines[index] ?? ''}`
		sink(index === 0 ? innerBand(line, width) : line)
	}
}

export function renderOpenEndedEditor(
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	if (editor.getText().length === 0) {
		sink(theme.fg('dim', UI_TEXT.otherPlaceholder))
		return
	}
	for (const line of editorBody(editor, width)) sink(line)
}

function renderChatAction(
	state: QuestionnaireState,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	sink('')
	const isCursor = state.isChatAction()
	const marker = theme.fg(
		isCursor ? 'accent' : 'dim',
		isCursor ? GLYPH.radioOn : GLYPH.radioOff,
	)
	const row =
		`${marker} ` +
		theme.fg(isCursor ? 'accent' : 'muted', 'Chat about this') +
		theme.fg('dim', '  ·  ctrl+g')
	sink(isCursor ? innerBand(row, width) : row)
}

function editorBody(editor: Editor, width: number): string[] {
	return editor
		.render(Math.max(1, width))
		.slice(1, -1)
		.map(line => line.replace(/ +$/, ''))
}
