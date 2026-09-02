/** Answer-selection transitions layered on questionnaire navigation state. */

import { UI_TEXT } from './questionnaire-model.ts'
import {
	NO_EFFECT,
	QuestionnaireNavigationState,
	RENDER,
} from './questionnaire-navigation-state.ts'

import type { Question } from './questionnaire-model.ts'
import type { QuestionnaireEffect } from './questionnaire-navigation-state.ts'

export type {
	EditorPort,
	QuestionnaireEffect,
} from './questionnaire-navigation-state.ts'

export class QuestionnaireState extends QuestionnaireNavigationState {
	submitEditorText(submittedValue: string): QuestionnaireEffect[] {
		const question = this.currentQuestion()
		if (!question) return NO_EFFECT
		const text = submittedValue.trim()
		if (this.isOpenEnded(question)) {
			const answer = text || UI_TEXT.noResponse
			this.responses.saveDraft(question.id, text)
			this.responses.recordCustomAnswer(question, answer)
			return this.advanceAfterEditorSubmit()
		}
		if (question.multiSelect) {
			const effects = this.commitMultiSelection(question, text)
			if (effects.includes('advance')) this.markEditorSubmission()
			return effects
		}
		if (!text) {
			this.responses.clearDraft(question.id)
			return RENDER
		}
		this.responses.saveDraft(question.id, text)
		this.responses.recordCustomAnswer(question, text)
		return this.advanceAfterEditorSubmit()
	}

	selectOption(index: number): QuestionnaireEffect[] {
		const question = this.currentQuestion()
		if (!question) return NO_EFFECT
		if (!this.isOpenEnded(question) && index === this.chatActionIndex()) {
			return this.requestChat()
		}
		const option = this.currentOptions()[index]
		if (!option) return NO_EFFECT
		if (option.isOther) {
			this.optionIndex = index
			return RENDER
		}
		this.editor.setText('')
		this.responses.clearDraft(question.id)
		this.optionIndex = index
		this.responses.recordOptionAnswer(question, option, index)
		return ['advance']
	}

	toggleMultiOption(index: number): QuestionnaireEffect[] {
		const question = this.currentQuestion()
		const option = this.currentOptions()[index]
		if (!question || !option) return NO_EFFECT
		if (option.isOther) {
			this.optionIndex = index
			return RENDER
		}
		this.responses.toggleOption(question.id, index)
		return RENDER
	}

	commitMultiSelection(
		question: Question,
		draftText = this.typedText(),
	): QuestionnaireEffect[] {
		const committed = this.responses.commitMultiAnswer(
			question,
			this.currentOptions(),
			draftText.trim(),
		)
		return committed ? ['advance'] : NO_EFFECT
	}

	escape(): QuestionnaireEffect[] {
		const question = this.currentQuestion()
		if (this.editorHasFocus() && question && !this.isOpenEnded(question)) {
			this.optionIndex = 0
			return RENDER
		}
		return ['cancel']
	}

	requestChat(): QuestionnaireEffect[] {
		return this.chatRequest() ? ['chat'] : NO_EFFECT
	}
}
