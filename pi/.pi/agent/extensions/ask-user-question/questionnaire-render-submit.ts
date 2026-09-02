import { pushWrappedWithPrefix } from './questionnaire-render-primitives.ts'

import type { Answer, Question } from './questionnaire-model.ts'
import type {
	LineSink,
	QuestionnairePalette,
} from './questionnaire-render-primitives.ts'
import type { QuestionnaireState } from './questionnaire-state.ts'

export function renderSubmitScreen(
	state: QuestionnaireState,
	questions: Question[],
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	pushWrappedWithPrefix(
		sink,
		' ',
		theme.fg('accent', theme.bold('Ready to submit')),
		width,
	)
	sink('')
	for (const question of questions) {
		const answer = state.answerFor(question.id)
		if (!answer) continue
		pushWrappedWithPrefix(
			sink,
			' ',
			answerSummaryLine(question.label, answer, theme),
			width,
		)
	}
	sink('')
	if (state.allAnswered()) {
		pushWrappedWithPrefix(
			sink,
			' ',
			theme.fg('success', 'Press Enter to submit'),
			width,
		)
		return
	}
	pushWrappedWithPrefix(
		sink,
		' ',
		theme.fg(
			'warning',
			`Unanswered: ${state.unansweredLabels().join(', ')}`,
		),
		width,
	)
}

function answerSummaryLine(
	questionLabel: string,
	answer: Answer,
	theme: QuestionnairePalette,
): string {
	const prefix = answer.wasCustom ? '(wrote) ' : ''
	return `${theme.fg('muted', `${questionLabel}: `)}${theme.fg('text', prefix + answer.label)}`
}

export function helpText(state: QuestionnaireState): string {
	const question = state.currentQuestion()
	const navigation = state.isMulti
		? state.editorHasFocus()
			? state.canNavigateTabsFromInputEdges()
				? 'Tab/Shift+Tab or ←→ at input edges navigate'
				: 'Tab/Shift+Tab navigate'
			: 'Tab/←→ navigate'
		: undefined

	let context: string
	if (!question || state.isOnSubmitTab()) {
		context = 'Enter submit • Esc cancel'
	} else if (state.isOpenEnded(question)) {
		context = 'Type your answer • Enter submit • Ctrl+G chat • Esc cancel'
	} else if (state.editorHasFocus()) {
		context = question.multiSelect
			? 'Type your answer • Enter confirm all • Ctrl+G chat • ↑↓ leave the input • Esc back to options'
			: 'Type your answer • Enter submit • Ctrl+G chat • ↑↓ leave the input • Esc back to options'
	} else if (question.multiSelect) {
		context =
			'j/k or ↑↓ move • Space toggle • 1-9 quick toggle • Enter confirm • Ctrl+G chat • Esc cancel'
	} else {
		context =
			'j/k or ↑↓ navigate • 1-9 quick select • Enter select/chat • Ctrl+G chat • Esc cancel'
	}
	return navigation ? `${navigation} • ${context}` : context
}
