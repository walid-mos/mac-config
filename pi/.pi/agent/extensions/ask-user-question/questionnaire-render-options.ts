import { visibleWidth } from '@earendil-works/pi-tui'

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

export function renderOptions(
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
	const prefix = isCursor ? theme.fg('accent', '> ') : '  '
	const checkbox = question.multiSelect ? (isChecked ? '[x] ' : '[ ] ') : ''
	const rowLabel = `${index + 1}. ${checkbox}`
	const color = isCursor ? 'accent' : 'text'

	if (isOther) {
		renderOtherRow(
			state,
			editor,
			prefix,
			rowLabel,
			color,
			theme,
			width,
			sink,
		)
	} else {
		const badge = option.recommended
			? theme.fg('success', ' (recommended)')
			: ''
		pushWrappedWithPrefix(
			sink,
			prefix,
			theme.fg(color, rowLabel + option.label) + badge,
			width,
		)
	}
	if (!isOther && option.description) {
		const descriptionIndent = question.multiSelect ? '         ' : '     '
		pushWrappedWithPrefix(
			sink,
			descriptionIndent,
			theme.fg('muted', option.description),
			width,
		)
	}
}

function renderOtherRow(
	state: QuestionnaireState,
	editor: Editor,
	prefix: string,
	rowLabel: string,
	color: 'accent' | 'text',
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	if (
		state.cursor !== state.currentOptions().length - 1 ||
		!state.editorHasFocus()
	) {
		const preview = state.typedPreview(ANSWER_PREVIEW_MAX_LENGTH)
		const shown = preview
			? theme.fg('muted', preview)
			: theme.fg(color, UI_TEXT.otherOptionLabel)
		pushWrappedWithPrefix(
			sink,
			prefix,
			theme.fg(color, rowLabel) + shown,
			width,
		)
		return
	}
	const rowPrefix = `${prefix}${theme.fg(color, rowLabel)}`
	const editorLines = editorBody(editor, width - visibleWidth(rowPrefix))
	if (editor.getText().length === 0) {
		sink(
			`${rowPrefix}${theme.fg('dim', UI_TEXT.otherPlaceholder)}${editorLines[0] ?? ''}`,
		)
		return
	}
	pushEditorLines(sink, rowPrefix, editorLines)
}

export function renderOpenEndedEditor(
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	sink('')
	pushWrappedWithPrefix(sink, ' ', theme.fg('accent', 'Your answer:'), width)
	const prefix = theme.fg('accent', '> ')
	const editorLines = editorBody(editor, width - visibleWidth(prefix))
	if (editor.getText().length === 0) {
		sink(
			`${prefix}${theme.fg('dim', UI_TEXT.otherPlaceholder)}${editorLines[0] ?? ''}`,
		)
		return
	}
	pushEditorLines(sink, prefix, editorLines)
}

function editorBody(editor: Editor, width: number): string[] {
	return editor
		.render(Math.max(1, width))
		.slice(1, -1)
		.map(line => line.replace(/ +$/, ''))
}

function pushEditorLines(
	sink: LineSink,
	prefix: string,
	lines: string[],
): void {
	const continuation = ' '.repeat(visibleWidth(prefix))
	for (let index = 0; index < lines.length; index++) {
		sink(`${index === 0 ? prefix : continuation}${lines[index]}`)
	}
}

export function renderChatAction(
	state: QuestionnaireState,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	sink('')
	sink(theme.fg('dim', '─'.repeat(width)))
	const isCursor = state.isChatAction()
	const prefix = isCursor ? theme.fg('accent', '> ') : '  '
	const color = isCursor ? 'accent' : 'muted'
	pushWrappedWithPrefix(
		sink,
		prefix,
		theme.fg(color, 'Chat about this (Ctrl+G)'),
		width,
	)
}
