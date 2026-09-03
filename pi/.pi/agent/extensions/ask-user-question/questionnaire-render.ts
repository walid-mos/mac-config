/** Pure questionnaire renderer: state + width in, ANSI lines out.
 * Geometry comes from the shared frame primitives (questionnaire-frame.ts,
 * itself built on ui/frame.ts) and every color from the house Catppuccin
 * tokens (questionnaire-theme.ts). */

import { foregroundHex as fgHex } from '../ui/design-system/terminal-color.ts'

import { blockTitle, framedBlock, innerWidth } from './questionnaire-frame.ts'
import {
	renderQuestionBody,
	renderTabBar,
} from './questionnaire-render-options.ts'
import { helpText, renderSubmitBody } from './questionnaire-render-submit.ts'
import { GLYPH, Q_COLOR } from './questionnaire-theme.ts'

import type { Question } from './questionnaire-model.ts'
import type { QuestionnairePalette } from './questionnaire-render-primitives.ts'
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
	const inner: string[] = []
	if (state.isMulti) {
		renderTabBar(state, questions, theme, innerWidth(width), line =>
			inner.push(line),
		)
	}
	if (state.isOnSubmitTab()) {
		renderSubmitBody(state, questions, theme, innerWidth(width), line =>
			inner.push(line),
		)
	} else {
		renderQuestionBody(state, editor, theme, innerWidth(width), line =>
			inner.push(line),
		)
	}
	return framedBlock(
		width,
		blockTitle(
			'ask',
			state.isMulti
				? `${Math.min(state.tab + 1, state.totalTabs)}/${state.totalTabs}`
				: undefined,
		),
		inner,
		footerLabel(state),
	)
}

function footerLabel(state: QuestionnaireState): string {
	if (state.isOnSubmitTab() && state.allAnswered()) {
		return (
			fgHex(Q_COLOR.SUCCESS, `${GLYPH.enter} submit`) +
			fgHex(Q_COLOR.DIM, '  ·  esc cancel')
		)
	}
	return fgHex(Q_COLOR.DIM, helpText(state))
}
