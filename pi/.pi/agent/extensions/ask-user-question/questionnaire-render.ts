/**
 * Pure renderer for the questionnaire: state + width in, ANSI lines out.
 * No TUI handle, no mutation — the component owns caching and re-renders.
 */

import {
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from '@earendil-works/pi-tui'

import {
	ANSWER_PREVIEW_MAX_LENGTH,
	type Answer,
	type Question,
	UI_TEXT,
} from './questionnaire-model.ts'

import type { QuestionnaireState } from './questionnaire-state.ts'
import type { Editor } from '@earendil-works/pi-tui'

/** Minimal color surface this renderer needs — structurally compatible with
 * the TUI theme, which has more colors than we use. */
export interface QuestionnairePalette {
	fg(
		color: 'accent' | 'muted' | 'dim' | 'warning' | 'success' | 'text',
		text: string,
	): string
	bg(color: 'selectedBg', text: string): string
	bold(text: string): string
}

type LineSink = (line: string) => void

/** Wrap text and push each visual line, hanging-indenting under `prefix`. */
function pushWrappedWithPrefix(
	sink: LineSink,
	prefix: string,
	text: string,
	width: number,
): void {
	const prefixWidth = visibleWidth(prefix)
	if (prefixWidth >= width) {
		for (const line of wrapTextWithAnsi(prefix + text, width)) sink(line)
		return
	}
	const wrapped = wrapTextWithAnsi(text, width - prefixWidth)
	const continuation = ' '.repeat(prefixWidth)
	for (let i = 0; i < wrapped.length; i++) {
		sink(`${i === 0 ? prefix : continuation}${wrapped[i]}`)
	}
}

export function renderQuestionnaire(
	state: QuestionnaireState,
	questions: Question[],
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
): string[] {
	const lines: string[] = []
	const renderWidth = Math.max(1, width)
	// A custom component must never return a line wider than the current terminal.
	// Keep this final boundary even when an embedded Editor changes its padding.
	const sink: LineSink = line =>
		lines.push(
			visibleWidth(line) <= renderWidth
				? line
				: truncateToWidth(line, renderWidth),
		)

	lines.push(theme.fg('accent', '─'.repeat(renderWidth)))
	if (state.isMulti) renderTabBar(state, questions, theme, renderWidth, sink)
	renderContent(state, questions, editor, theme, renderWidth, sink)
	lines.push('')
	pushWrappedWithPrefix(
		sink,
		' ',
		theme.fg('dim', helpText(state)),
		renderWidth,
	)
	lines.push(theme.fg('accent', '─'.repeat(renderWidth)))
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
	for (let i = 0; i < questions.length; i++) {
		const question = questions[i]
		if (!question) continue
		const isActive = i === state.tab
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
	const isSubmitTab = state.isOnSubmitTab()
	const submitText = ' ✓ Submit '
	const submitStyled = isSubmitTab
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
	const q = state.currentQuestion()
	if (q && !state.isOnSubmitTab()) {
		const modeHint = q.multiSelect
			? theme.fg('muted', ' (multiple choice)')
			: ''
		pushWrappedWithPrefix(
			sink,
			' ',
			theme.fg('text', q.prompt) + modeHint,
			width,
		)
		sink('')
		if (state.isOpenEnded(q))
			renderOpenEndedEditor(editor, theme, width, sink)
		else renderOptions(state, q, editor, theme, width, sink)
		renderChatAction(state, theme, width, sink)
		return
	}
	if (state.isOnSubmitTab())
		renderSubmitScreen(state, questions, theme, width, sink)
}

/** The option list. The "Type something." row becomes the inline text editor
 * itself when the cursor is on it (Claude Code style); otherwise it stays a
 * static row, showing the typed text if any. */
function renderOptions(
	state: QuestionnaireState,
	q: Question,
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	const opts = state.currentOptions()
	for (let i = 0; i < opts.length; i++) {
		const opt = opts[i]
		if (!opt) continue
		renderOptionRow(state, q, opt, i, editor, theme, width, sink)
	}
}

function renderOptionRow(
	state: QuestionnaireState,
	q: Question,
	opt: {
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
	const isOther = opt.isOther === true
	const isChecked = state.isChecked(q, index, isOther)
	const prefix = isCursor ? theme.fg('accent', '> ') : '  '
	const checkbox = q.multiSelect ? (isChecked ? '[x] ' : '[ ] ') : ''
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
		const badge = opt.recommended
			? theme.fg('success', ' (recommended)')
			: ''
		pushWrappedWithPrefix(
			sink,
			prefix,
			theme.fg(color, rowLabel + opt.label) + badge,
			width,
		)
	}
	if (!isOther && opt.description) {
		const descIndent = q.multiSelect ? '         ' : '     '
		pushWrappedWithPrefix(
			sink,
			descIndent,
			theme.fg('muted', opt.description),
			width,
		)
	}
}

/** The "Type something." row: focused = the inline editor (keeping the
 * option's "N. [ ]" label as visual prefix so the row keeps the exact same
 * indentation as the others); unfocused = a static row with the typed text. */
function renderChatAction(
	state: QuestionnaireState,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	// Keep this affordance visually separate with a single blank line before
	// the rule; the chat row follows immediately (double gap felt bloated).
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
	const contentWidth = Math.max(1, width - visibleWidth(rowPrefix) - 1)
	const editorLines = editor
		.render(contentWidth)
		.slice(1, -1) // strip the editor's horizontal border lines
		.map(l => l.replace(/ +$/, '')) // trim right padding
	if (editor.getText().length === 0) {
		// Empty editor renders only its cursor: placeholder first
		sink(
			`${rowPrefix}${theme.fg('dim', UI_TEXT.otherPlaceholder)}${editorLines[0] ?? ''}`,
		)
		return
	}
	const continuation = ' '.repeat(visibleWidth(rowPrefix))
	for (let j = 0; j < editorLines.length; j++) {
		sink(`${j === 0 ? rowPrefix : continuation}${editorLines[j]}`)
	}
}

function renderOpenEndedEditor(
	editor: Editor,
	theme: QuestionnairePalette,
	width: number,
	sink: LineSink,
): void {
	sink('')
	pushWrappedWithPrefix(sink, ' ', theme.fg('accent', 'Your answer:'), width)
	const prefix = theme.fg('accent', '> ')
	const contentWidth = Math.max(1, width - visibleWidth(prefix))
	const editorLines = editor
		.render(contentWidth)
		.slice(1, -1)
		.map(line => line.replace(/ +$/, ''))
	if (editor.getText().length === 0) {
		sink(
			`${prefix}${theme.fg('dim', UI_TEXT.otherPlaceholder)}${editorLines[0] ?? ''}`,
		)
		return
	}
	const continuation = ' '.repeat(visibleWidth(prefix))
	for (let index = 0; index < editorLines.length; index++) {
		sink(`${index === 0 ? prefix : continuation}${editorLines[index]}`)
	}
}

function renderSubmitScreen(
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

function helpText(state: QuestionnaireState): string {
	const q = state.currentQuestion()
	const navigation = state.isMulti
		? state.editorHasFocus()
			? state.canNavigateTabsFromInputEdges()
				? 'Tab/Shift+Tab or ←→ at input edges navigate'
				: 'Tab/Shift+Tab navigate'
			: 'Tab/←→ navigate'
		: undefined

	let context: string
	if (!q || state.isOnSubmitTab()) {
		context = 'Enter submit • Esc cancel'
	} else if (state.isOpenEnded(q)) {
		context = 'Type your answer • Enter submit • Ctrl+G chat • Esc cancel'
	} else if (state.editorHasFocus()) {
		context = q.multiSelect
			? 'Type your answer • Enter confirm all • Ctrl+G chat • ↑↓ leave the input • Esc back to options'
			: 'Type your answer • Enter submit • Ctrl+G chat • ↑↓ leave the input • Esc back to options'
	} else if (q.multiSelect) {
		context =
			'j/k or ↑↓ move • Space toggle • 1-9 quick toggle • Enter confirm • Ctrl+G chat • Esc cancel'
	} else {
		context =
			'j/k or ↑↓ navigate • 1-9 quick select • Enter select/chat • Ctrl+G chat • Esc cancel'
	}
	return navigation ? `${navigation} • ${context}` : context
}
