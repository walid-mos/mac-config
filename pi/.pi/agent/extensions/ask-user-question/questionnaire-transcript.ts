/**
 * Transcript renderers for the ask_user_question tool: the framed call
 * preview (options laid out OMP-style) and the verbose answer replay that
 * re-renders every question with its markers filled in, so each answer keeps
 * the full context it was asked in.
 *
 * Call args arrive raw — possibly streamed or model-mangled — and coercion
 * must never throw: a throw here takes down the whole TUI render loop.
 * Result details, by contrast, come from this extension's own execute() and
 * are trusted domain objects.
 *
 * No pi-tui dependency: `node --test` exercises this module directly.
 */

import { foregroundHex as fgHex } from '../ui/design-system/terminal-color.ts'
import {
	blockTitle,
	framedBlock,
	innerWidth,
	pushWrapped,
} from './questionnaire-frame.ts'
import { boldAnsi, GLYPH, Q_COLOR } from './questionnaire-theme.ts'

import type {
	AskResult,
	Question,
	QuestionOption,
} from './questionnaire-model.ts'

interface OptionView {
	label: string
	description?: string
	recommended?: boolean
}

interface QuestionView {
	label: string
	prompt: string
	options: OptionView[]
	multiSelect: boolean
	allowOther: boolean
}

function optionalText(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function coerceOptions(raw: unknown): OptionView[] {
	if (!Array.isArray(raw)) return []
	const options: OptionView[] = []
	for (const entry of raw) {
		if (typeof entry === 'string') {
			options.push({ label: entry })
			continue
		}
		if (!entry || typeof entry !== 'object') continue
		const record = entry as Record<string, unknown>
		const label = optionalText(record.label)
		if (!label) continue
		options.push({
			label,
			description: optionalText(record.description),
			recommended: record.recommended === true,
		})
	}
	return options
}

function coerceQuestions(raw: unknown): QuestionView[] {
	if (!Array.isArray(raw)) return []
	const questions: QuestionView[] = []
	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue
		const record = entry as Record<string, unknown>
		const id = optionalText(record.id) ?? '?'
		questions.push({
			label: optionalText(record.label) ?? id,
			prompt: optionalText(record.prompt) ?? '',
			options: coerceOptions(record.options),
			multiSelect: record.multiSelect === true,
			allowOther: record.allowOther !== false,
		})
	}
	return questions
}

const dim = (line: string) => fgHex(Q_COLOR.DIM, line)
const body = (line: string) => fgHex(Q_COLOR.TEXT, line)
const strong = (line: string) => fgHex(Q_COLOR.TEXT, boldAnsi(line))
const success = (line: string) => fgHex(Q_COLOR.SUCCESS, line)

function marker(multiSelect: boolean, checked: boolean): string {
	const glyph = multiSelect
		? checked
			? GLYPH.checkOn
			: GLYPH.checkOff
		: checked
			? GLYPH.radioOn
			: GLYPH.radioOff
	return checked ? success(glyph) : dim(glyph)
}

function sectionHead(
	question: { label: string; prompt: string },
	width: number,
	sink: (line: string) => void,
): void {
	pushWrapped(
		sink,
		' ',
		`${dim(`[${question.label}]`)} ${strong(question.prompt)}`,
		width,
	)
}

/** Compact pending preview: one line of question labels — the option
 * details live in the interactive dialog, not in the transcript. */
export function renderCallLines(args: unknown, width: number): string[] {
	const questions = coerceQuestions(
		(args as { questions?: unknown } | null | undefined)?.questions,
	)
	const inner: string[] = []
	if (questions.length === 0) {
		inner.push(dim('waiting for questions…'))
		return framedBlock(
			width,
			blockTitle('ask'),
			inner,
			dim('awaiting answer'),
		)
	}
	pushWrapped(
		line => inner.push(line),
		' ',
		body(questions.map(question => question.label).join('  ·  ')),
		innerWidth(width),
	)
	return framedBlock(
		width,
		blockTitle(
			'ask',
			`${questions.length} question${questions.length === 1 ? '' : 's'}`,
		),
		inner,
		dim('awaiting answer'),
	)
}

function questionToView(question: Question): QuestionView {
	return {
		label: question.label,
		prompt: question.prompt,
		options: question.options.map((option: QuestionOption) => ({
			label: option.label,
			description: option.description,
			recommended: option.recommended,
		})),
		multiSelect: question.multiSelect,
		allowOther: question.allowOther,
	}
}

/** Framed answer replay: every question with its option markers filled in. */
export function renderResultLines(
	details: AskResult,
	width: number,
): string[] {
	const innerWidth_ = innerWidth(width)
	const sink = (line: string) => inner.push(line)
	const inner: string[] = []

	if (details.chat) {
		inner.push('')
		for (const question of details.questions) {
			sectionHead(question, innerWidth_, sink)
			inner.push(`   ${dim('· continuing in chat')}`)
		}
		inner.push('')
		return framedBlock(
			width,
			`${fgHex(Q_COLOR.ACCENT, GLYPH.chat)} ${blockTitle('ask', 'chat')}`,
			inner,
			dim('chat redirect'),
		)
	}

	if (details.cancelled) {
		inner.push('')
		for (const question of details.questions) {
			sectionHead(question, innerWidth_, sink)
			inner.push(`   ${dim('· no answer')}`)
		}
		inner.push('')
		return framedBlock(
			width,
			`${fgHex(Q_COLOR.DANGER, GLYPH.cancel)} ${blockTitle('ask', 'cancelled')}`,
			inner,
			dim('cancelled'),
		)
	}

	inner.push('')
	for (const question of details.questions) {
		const answer = details.answers.find(entry => entry.id === question.id)
		sectionHead(question, innerWidth_, sink)
		if (!answer) {
			inner.push(`   ${dim('· no answer')}`)
			continue
		}
		if (answer.wasCustom) {
			pushWrapped(
				sink,
				`   ${success(GLYPH.pen)} `,
				body(answer.label),
				innerWidth_,
			)
			continue
		}
		if (answer.kind === 'multi') {
			for (const option of question.options) {
				const checked = answer.optionValues.includes(option.value)
				pushWrapped(
					sink,
					'   ',
					`${marker(true, checked)} ${checked ? body(option.label) : dim(option.label)}`,
					innerWidth_,
				)
			}
			if (answer.customText) {
				pushWrapped(
					sink,
					`   ${success(GLYPH.pen)} `,
					body(answer.customText),
					innerWidth_,
				)
			}
			continue
		}
		question.options.forEach((option, index) => {
			const checked =
				option.value === answer.value || answer.index === index + 1
			pushWrapped(
				sink,
				'   ',
				`${marker(false, checked)} ${checked ? body(option.label) : dim(option.label)}`,
				innerWidth_,
			)
		})
	}
	inner.push('')
	return framedBlock(
		width,
		`${success(GLYPH.done)} ${blockTitle(
			'ask',
			`${details.answers.length} answer${details.answers.length === 1 ? '' : 's'}`,
		)}`,
		inner,
		dim('answered'),
	)
}
