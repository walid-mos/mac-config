/** Pure questionnaire renderer: state + width in, ANSI lines out. */

import {
	renderChatAction,
	renderOpenEndedEditor,
	renderOptions,
} from './questionnaire-render-options.ts'
import {
	clippedLineSink,
	pushWrappedWithPrefix,
} from './questionnaire-render-primitives.ts'
import { helpText, renderSubmitScreen } from './questionnaire-render-submit.ts'

import type { Question } from './questionnaire-model.ts'
import type {
	LineSink,
	QuestionnairePalette,
} from './questionnaire-render-primitives.ts'
import type { QuestionnaireState } from './questionnaire-state.ts'
import type { Editor } from '@earendil-works/pi-tui'

export type { QuestionnairePalette } from './questionnaire-render-primitives.ts'

export function renderQuestionnaire(
	state: QuestionnaireState,
	questions: Question[],
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
): string[] {
	const lines: string[] = []
	const renderWidth = Math.max(1, width)
	const sink = clippedLineSink(lines, renderWidth)

	sink(theme.fg('accent', '─'.repeat(renderWidth)))
	if (state.isMulti) renderTabBar(state, questions, theme, renderWidth, sink)
	renderContent(state, questions, editor, theme, renderWidth, sink)
	sink('')
	pushWrappedWithPrefix(
		sink,
		' ',
		theme.fg('dim', helpText(state)),
		renderWidth,
	)
	sink(theme.fg('accent', '─'.repeat(renderWidth)))
	return lines
}

function renderTabBar(
	state: QuestionnaireState,
	questions: Question[],
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const tabs: string[] = ['← ']
	for (let index = 0; index < questions.length; index++) {
		const question = questions[index]
		if (!question) continue
		const isActive = index === state.tab
		const isAnswered = state.answerFor(question.id) !== undefined
		const box = isAnswered ? '■' : '□'
		const color = isAnswered ? 'success' : 'muted'
		const text = ` ${box} ${question.label} `
		const styled = isActive
			? theme.bg('selectedBg', theme.fg('text', text))
			: theme.fg(color, text)
		tabs.push(`${styled} `)
	}
	const canSubmit = state.allAnswered()
	const submitText = ' ✓ Submit '
	const submitStyled = state.isOnSubmitTab()
		? theme.bg('selectedBg', theme.fg('text', submitText))
		: theme.fg(canSubmit ? 'success' : 'dim', submitText)
	tabs.push(`${submitStyled} →`)
	const progress = theme.fg(
		'dim',
		`  ${Math.min(state.tab + 1, state.totalTabs)}/${state.totalTabs}`,
	)
	pushWrappedWithPrefix(sink, ' ', tabs.join('') + progress, width)
	sink('')
}

function renderContent(
	state: QuestionnaireState,
	questions: Question[],
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const question = state.currentQuestion()
	if (question && !state.isOnSubmitTab()) {
		const modeHint = question.multiSelect
			? theme.fg('muted', ' (multiple choice)')
			: ''
		pushWrappedWithPrefix(
			sink,
			' ',
			theme.fg('text', question.prompt) + modeHint,
			width,
		)
		sink('')
		if (state.isOpenEnded(question)) {
			renderOpenEndedEditor(editor, theme, width, sink)
		} else {
			renderOptions(state, question, editor, theme, width, sink)
		}
		renderChatAction(state, theme, width, sink)
		return
	}
	if (state.isOnSubmitTab()) {
		renderSubmitScreen(state, questions, theme, width, sink)
	}
}
