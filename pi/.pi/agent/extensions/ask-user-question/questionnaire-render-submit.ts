import { pushWrappedWithPrefix } from './questionnaire-render-primitives.ts'
import { GLYPH } from './questionnaire-theme.ts'

import type { Answer } from './questionnaire-model.ts'
import type {
	LineSink,
	QuestionnairePalette,
} from './questionnaire-render-primitives.ts'
import type { QuestionnaireState } from './questionnaire-state.ts'

export function renderSubmitBody(
	state: QuestionnaireState,
	questions: Question[],
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	sink('')
	questions.forEach((question, index) => {
		if (index > 0) sink('')
		pushWrappedWithPrefix(
			sink,
			' ',
			`${theme.fg('dim', `[${question.label}]`)} ${theme.fg('text', theme.bold(question.prompt))}`,
			width,
		)
		const answer = state.answerFor(question.id)
		if (!answer) {
			sink(`   ${theme.fg('warning', `${GLYPH.radioOff} unanswered`)}`)
			return
		}
		renderAnswerRows(answer, theme, width, sink)
	})
	if (!state.allAnswered()) {
		sink('')
		pushWrappedWithPrefix(
			sink,
			' ',
			theme.fg(
				'warning',
				`${GLYPH.cancel} unanswered: ${state.unansweredLabels().join(', ')}`,
			),
			width,
		)
	}
}

function renderAnswerRows(
	answer: Answer,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	if (answer.wasCustom) {
		pushWrappedWithPrefix(
			sink,
			`   ${theme.fg('success', GLYPH.pen)} `,
			theme.fg('text', answer.label),
			width,
		)
		return
	}
	if (answer.kind === 'multi') {
		for (const label of answer.labels) {
			pushWrappedWithPrefix(
				sink,
				`   ${theme.fg('success', theme.bold(GLYPH.checkOn))} `,
				theme.fg('text', label),
				width,
			)
		}
		return
	}
	pushWrappedWithPrefix(
		sink,
		`   ${theme.fg('success', theme.bold(GLYPH.radioOn))} `,
		theme.fg('text', answer.label),
		width,
	)
}

export function helpText(state: QuestionnaireState): string {
	const question = state.currentQuestion()
	const navigation = state.isMulti
		? state.editorHasFocus()
			? state.canNavigateTabsFromInputEdges()
				? 'tab or ←→ at input edges'
				: 'tab navigate'
			: '←→ navigate'
		: undefined

	let context: string
	if (!question || state.isOnSubmitTab()) {
		context = 'enter submit · esc cancel'
	} else if (state.isOpenEnded(question)) {
		context = 'type · enter submit · ctrl+g chat · esc cancel'
	} else if (state.editorHasFocus()) {
		context = question.multiSelect
			? 'type · enter confirm all · ctrl+g chat · esc back'
			: 'type · enter submit · ctrl+g chat · esc back'
	} else if (question.multiSelect) {
		context =
			'↑↓ move · space toggle · 1-9 toggle · enter confirm · ctrl+g chat · esc cancel'
	} else {
		context =
			'↑↓ move · 1-9 select · enter select · ctrl+g chat · esc cancel'
	}
	return navigation ? `${navigation} · ${context}` : context
}
