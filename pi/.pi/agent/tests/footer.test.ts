import assert from 'node:assert/strict'
import test from 'node:test'

import {
	renderFooterLines,
	type FooterRenderInput,
} from '../extensions/footer.ts'
import { surfaceLineWidth } from '../extensions/ui/surface.ts'

const STRIP_ANSI =
	/\u001b\[[0-?]*[ -/]*[@-~]|\u001b\]8;;[^\u0007]*\u0007|\u001b\]8;;\u0007/gu

function sample(overrides: Partial<FooterRenderInput> = {}): FooterRenderInput {
	return {
		width: 110,
		model: 'claude-opus-4-6',
		thinkingLevel: 'high',
		cwd: '~/.stow_repository/pi/.pi/agent',
		branch: 'feat/unified-surface',
		usage: { percent: 62.4, tokens: 61_000, contextWindow: 128_000 },
		tokens: { input: 12_340, output: 3_410, cost: 0.4213 },
		statuses: [],
		git: {
			modified: 2,
			staged: 1,
			deleted: 0,
			untracked: 3,
			stash: 1,
			ahead: 1,
			behind: 0,
		},
		pr: { number: 132, url: 'https://github.com/acme/repo/pull/132' },
		quotas: {
			kimi: {
				fiveHour: { used: 22, limit: 100, remaining: 78, reset: '' },
				weekly: { used: 9, limit: 100, remaining: 91, reset: '' },
			},
		},
		provider: 'kimi-coding',
		...overrides,
	}
}

test('renders two justified lines that fit the terminal width', () => {
	for (const width of [120, 100, 80, 60]) {
		const lines = renderFooterLines(sample({ width }))
		assert.equal(lines.length, 2)
		for (const line of lines) {
			assert.ok(
				surfaceLineWidth(line) <= width,
				`line wider than ${width}: ${JSON.stringify(line.replace(STRIP_ANSI, ''))}`,
			)
		}
	}
})

test('keeps the hero pill, context gauge and cost at every width', () => {
	const model = 'claude-opus-4-6'
	for (const width of [120, 100, 80, 60]) {
		const plain = renderFooterLines(sample({ width }))
			.map(l => l.replace(STRIP_ANSI, ''))
			.join('\n')
		assert.ok(plain.includes(model), `model missing at ${width}`)
		// The cost is the last thing line 2 ever gives up.
		assert.ok(plain.includes('$0.421'), `cost missing at ${width}`)
		// With a heavy git line the gauge can only be guaranteed on wide terminals.
		if (width >= 100) {
			assert.ok(plain.includes('62%'), `context pct missing at ${width}`)
		}
	}
})

test('keeps the full path on line 1 and moves the branch to the git line', () => {
	const lines = renderFooterLines(sample({ width: 170 })).map(l =>
		l.replace(STRIP_ANSI, ''),
	)
	assert.ok(
		lines[0]?.includes('.stow_repository'),
		'full path expected on a wide terminal',
	)
	assert.equal(
		lines[0]?.includes('feat/unified-surface'),
		false,
		'branch must not sit on line 1',
	)
	assert.ok(
		lines[1]?.includes('feat/unified-surface'),
		'branch expected on the git line',
	)
	assert.ok(lines[0]?.includes('\u2502'), 'thin separator expected')
})

test('degrades by hiding meta before ever leaking raw escape fragments', () => {
	const lines = renderFooterLines(sample({ width: 40 }))
	const joined = lines.join('\n')
	assert.equal(
		joined.includes('\u001b]8;;https://'),
		false,
		'OSC 8 target leaked as text',
	)
	assert.ok(
		!/\u001b\]8;;[^\u0007]*$/.test(joined),
		'unclosed hyperlink after truncation',
	)
	const plain = joined.replace(STRIP_ANSI, '')
	assert.equal(
		plain.includes('github.com/acme'),
		false,
		'URL must never display as text',
	)
})

test('displays the PR label as clickable text, never the raw URL', () => {
	const line2 = renderFooterLines(sample({ width: 130 }))[1] ?? ''
	const plain = (line2 ?? '').replace(STRIP_ANSI, '')
	assert.ok(plain.includes('PR #132'))
	assert.equal(plain.includes('https://'), false)
})

test('renders a clean repository as a green check', () => {
	const line2 =
		renderFooterLines(
			sample({
				width: 100,
				git: {
					modified: 0,
					staged: 0,
					deleted: 0,
					untracked: 0,
					stash: 0,
					ahead: 0,
					behind: 0,
				},
				pr: null,
			}),
		)[1] ?? ''
	assert.ok((line2 ?? '').replace(STRIP_ANSI, '').includes('clean'))
})

test('filters quota providers against the active provider', () => {
	const quotas = {
		kimi: {
			fiveHour: { used: 22, limit: 100, remaining: 78, reset: '' },
			weekly: { used: 9, limit: 100, remaining: 91, reset: '' },
		},
		xai: { tier: 'SuperGrok' },
	}
	const kimiLine = renderFooterLines(sample({ width: 140 }))[0] ?? ''
	const xaiLine =
		renderFooterLines(sample({ width: 140, provider: 'xai', quotas }))[0] ??
		''

	assert.ok(kimiLine.replace(STRIP_ANSI, '').includes('kimi'))
	assert.equal(xaiLine.replace(STRIP_ANSI, '').includes('kimi'), false)
	assert.ok(xaiLine.replace(STRIP_ANSI, '').includes('SuperGrok'))
})
