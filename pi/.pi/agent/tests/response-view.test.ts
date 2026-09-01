import assert from 'node:assert/strict'
import test from 'node:test'

import {
	RESPONSE_RIGHT_MARGIN,
	frameAssistantMarkdown,
	responseTopRule,
	type ResponseTheme,
} from '../extensions/response-view/frame.ts'
import { softenThinkingMarkdown } from '../extensions/response-view/thinking.ts'

const theme: ResponseTheme = {
	fg: (_role, text) => text,
	bold: text => text,
	getFgAnsi: role =>
		role === 'accent'
			? '\x1b[38;2;136;57;239m'
			: role === 'dim'
				? '\x1b[38;2;156;160;176m'
				: '\x1b[38;2;140;143;161m',
	getBgAnsi: () => '\x1b[48;2;230;233;239m',
	getColorMode: () => 'truecolor',
}

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[\d;]*m/gu, '')
}

test('compose une réponse éditoriale sans cadre rectangulaire', () => {
	const framed = frameAssistantMarkdown('**Fait.**', {
		width: 40,
		theme,
	})
	const lines = framed.split('\n')
	assert.equal(stripAnsi(lines[0]!), `◇  RÉPONSE  ╶${'─'.repeat(16)}┈┈ `)
	assert.equal(lines[1], '')
	assert.equal(lines[2], '**Fait.**')
	assert.equal(lines.length, 3)
})

test('préserve exactement le Markdown encadré', () => {
	const markdown = '    bloc indenté  \n\ntexte final  '
	const framed = frameAssistantMarkdown(markdown, { width: 40, theme })
	assert.ok(framed.endsWith(markdown))
})

test("utilise un unique filigrane d'ouverture", () => {
	const framed = frameAssistantMarkdown('Réponse en cours', {
		width: 32,
		theme,
	})
	assert.ok(stripAnsi(framed).startsWith('◇  RÉPONSE  ╶'))
	assert.ok(framed.endsWith('Réponse en cours'))
	assert.equal(stripAnsi(framed).match(/◇/gu)?.length, 1)
})

test("étend les traits jusqu'à la gouttière edit/write avec un fade proportionnel", () => {
	const top = responseTopRule(240, theme)
	assert.equal([...stripAnsi(top)].length, 240 - RESPONSE_RIGHT_MARGIN)
	const topColors = [...top.matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+)m/gu)].map(
		match => match.slice(1).map(Number),
	)
	assert.notDeepEqual(topColors.at(-60), [140, 143, 161])
})

test('garde le label simple et reste sûr sur les largeurs étroites', () => {
	const roles: string[] = []
	const themed: ResponseTheme = {
		fg: (role, text) => {
			roles.push(role)
			return text
		},
		bold: text => text,
		getFgAnsi: theme.getFgAnsi,
		getBgAnsi: theme.getBgAnsi,
		getColorMode: theme.getColorMode,
	}
	assert.equal(responseTopRule(4, themed), '◇')
	roles.length = 0
	responseTopRule(40, themed)
	assert.deepEqual(roles, ['accent', 'text'])
	assert.equal(frameAssistantMarkdown('   ', { width: 80, theme }), '   ')
})

test('fond la couleur vers muted puis efface la matière du trait', () => {
	const gradientTheme: ResponseTheme = {
		fg: (_role, text) => text,
		bold: text => text,
		getFgAnsi: role =>
			role === 'accent'
				? '\x1b[38;2;136;57;239m'
				: role === 'dim'
					? '\x1b[38;2;156;160;176m'
					: '\x1b[38;2;140;143;161m',
		getBgAnsi: () => '\x1b[48;2;230;233;239m',
		getColorMode: () => 'truecolor',
	}
	const line = responseTopRule(40, gradientTheme)
	const colors = [...line.matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+)m/gu)].map(
		match => match.slice(1).map(Number),
	)
	assert.deepEqual(colors[0], [136, 57, 239])
	assert.deepEqual(colors.at(-1), [230, 233, 239])
	assert.ok(new Set(colors.map(color => color.join(','))).size > 15)
	assert.ok(stripAnsi(line).endsWith('┈┈ '))
	assert.equal(
		[...line.replace(/\x1b\[[\d;]*m/gu, '')].length,
		40 - RESPONSE_RIGHT_MARGIN,
	)
})

test('adapte le dégradé aux terminaux ANSI 256', () => {
	const gradientTheme: ResponseTheme = {
		fg: (_role, text) => text,
		bold: text => text,
		getFgAnsi: role =>
			role === 'accent'
				? '\x1b[38;5;135m'
				: role === 'dim'
					? '\x1b[38;5;145m'
					: '\x1b[38;5;102m',
		getBgAnsi: () => '\x1b[48;5;255m',
		getColorMode: () => '256color',
	}
	const line = responseTopRule(40, gradientTheme)
	assert.match(line, /\x1b\[38;5;\d+m/u)
	assert.equal(
		[...line.replace(/\x1b\[[\d;]*m/gu, '')].length,
		40 - RESPONSE_RIGHT_MARGIN,
	)
})

test('ne dépasse jamais la largeur disponible dans toutes les variantes', () => {
	for (const width of [1, 2, 4, 13, 14, 15, 16, 17, 40, 88, 240]) {
		const available = Math.max(1, width - RESPONSE_RIGHT_MARGIN)
		assert.ok(
			[...stripAnsi(responseTopRule(width, theme))].length <= available,
		)
	}
})

test('regroupe les summaries Codex par trois sans reformater la prose', () => {
	assert.equal(
		softenThinkingMarkdown(
			'**Planning configuration**\n\n**Assessing tests**\n\n**Checking output**\n\n**Reviewing diff**\n\n**Finishing scripts**',
		),
		'Planning configuration\nAssessing tests\nChecking output\n\nReviewing diff\nFinishing scripts',
	)

	assert.equal(
		softenThinkingMarkdown(
			'Inspecting **important code**.\n\n- Keeping the original structure.',
		),
		'Inspecting important code.\n\n- Keeping the original structure.',
	)
})
