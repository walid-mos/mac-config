import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadEvaluatorCandidates } from '../extensions/goal/config.ts'

const typeboxStub = `data:text/javascript,${encodeURIComponent(
	'export const Type = { Object: properties => ({ properties }), String: options => options }',
)}`
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'typebox') {
			return { shortCircuit: true, url: typeboxStub }
		}
		return nextResolve(specifier, context)
	},
})

const {
	decideEvaluatedGoal,
	default: goalExtension,
	evaluateWithFallback,
	goalChromeLines,
	isTurnCapReached,
	parseEvaluatorText,
	restoreGoalState,
	selectEvaluatorAttempts,
	updateProofLedger,
} = await import('../extensions/goal.ts')

const configPath = fileURLToPath(new URL('../goal.json', import.meta.url))

type GoalStatus = 'active' | 'met' | 'impossible' | 'cleared' | 'stuck'

type GoalState = {
	condition: string
	startedAt: string
	turnsEvaluated: number
	noToolTurns: number
	maxTurns: number
	lastVerdict: string | null
	lastReason: string
	proofs?: string[]
	status: GoalStatus
}

type ParsedEvaluatorReply =
	| {
			ok: true
			verdict: 'not_yet' | 'met' | 'impossible'
			reason: string
			proofs: string[]
			invalidatedProofs: string[]
	  }
	| { ok: false; reason: string }

type FakeUi = {
	notify: () => void
	setStatus: () => void
	setWidget: () => void
}

type GoalTool = {
	name: string
	execute: (
		toolCallId: string,
		params: { condition: string },
		signal: AbortSignal,
		onUpdate: () => void,
		ctx: { ui: FakeUi },
	) => Promise<unknown>
}

type EventHandler = (event: unknown, context: unknown) => Promise<void>

function activeGoal(overrides: Partial<GoalState> = {}): GoalState {
	return {
		condition: 'tests pass; stop after 3 turns',
		startedAt: '2026-08-21T00:00:00.000Z',
		turnsEvaluated: 2,
		noToolTurns: 0,
		maxTurns: 3,
		lastVerdict: 'not_yet',
		lastReason: 'One gate remains.',
		proofs: ['one gate checked'],
		status: 'active',
		...overrides,
	}
}

function validReply(
	overrides: Partial<Extract<ParsedEvaluatorReply, { ok: true }>> = {},
): Extract<ParsedEvaluatorReply, { ok: true }> {
	return {
		ok: true,
		verdict: 'not_yet',
		reason: 'Still missing proof.',
		proofs: [],
		invalidatedProofs: [],
		...overrides,
	}
}

function fakeUi(): FakeUi {
	return {
		notify() {},
		setStatus() {},
		setWidget() {},
	}
}

function assistantReply(payload: unknown): {
	role: 'assistant'
	content: Array<{ type: 'text'; text: string }>
} {
	return {
		role: 'assistant',
		content: [{ type: 'text', text: JSON.stringify(payload) }],
	}
}

function installGoal(): {
	commands: string[]
	handlers: Map<string, EventHandler[]>
	persisted: unknown[]
	sentMessages: unknown[]
	tool: GoalTool | undefined
} {
	const commands: string[] = []
	const handlers = new Map<string, EventHandler[]>()
	const persisted: unknown[] = []
	const sentMessages: unknown[] = []
	let tool: GoalTool | undefined
	goalExtension({
		appendEntry(_type: string, state: unknown) {
			persisted.push(state)
		},
		on(event: string, handler: EventHandler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler])
		},
		registerCommand(name: string) {
			commands.push(name)
		},
		registerTool(registered: GoalTool) {
			tool = registered
		},
		sendUserMessage(message: unknown) {
			sentMessages.push(message)
		},
	})
	return { commands, handlers, persisted, sentMessages, tool }
}

function evaluatorContext(
	complete: () => Promise<unknown>,
	ui: FakeUi,
	extra: { abort?: () => void } = {},
): Record<string, unknown> {
	return {
		...extra,
		modelRegistry: {
			complete,
			find(provider: string, id: string) {
				return { provider, id }
			},
			hasConfiguredAuth() {
				return true
			},
		},
		scopedModels: [],
		sessionManager: {
			getBranch: () => [],
		},
		ui,
	}
}

test('parseEvaluatorText accepts proofs and invalidatedProofs', () => {
	const result = parseEvaluatorText(
		JSON.stringify({
			verdict: 'not_yet',
			reason: 'One gate remains.',
			proofs: ['make pi exited 0', 'searcher.md is absent'],
			invalidatedProofs: ['stale green output'],
		}),
	)
	assert.deepEqual(result, {
		ok: true,
		verdict: 'not_yet',
		reason: 'One gate remains.',
		proofs: ['make pi exited 0', 'searcher.md is absent'],
		invalidatedProofs: ['stale green output'],
	})
})

test('parseEvaluatorText requires proofs and invalidatedProofs', () => {
	assert.deepEqual(
		parseEvaluatorText(
			JSON.stringify({
				verdict: 'met',
				reason: 'Done without a proof ledger.',
			}),
		),
		{
			ok: false,
			reason: 'Evaluator proof updates are missing or invalid.',
		},
	)
	assert.deepEqual(
		parseEvaluatorText(
			JSON.stringify({
				verdict: 'met',
				reason: 'Missing invalidatedProofs.',
				proofs: ['command exited 0'],
			}),
		),
		{
			ok: false,
			reason: 'Evaluator proof updates are missing or invalid.',
		},
	)
})

test('parseEvaluatorText bounds and deduplicates the proof ledger', () => {
	const proofs = Array.from(
		{ length: 45 },
		(_, index) => `${index}: ${'x'.repeat(600)}`,
	)
	proofs.push(proofs[0] ?? '')
	const result = parseEvaluatorText(
		JSON.stringify({
			verdict: 'not_yet',
			reason: 'More',
			proofs,
			invalidatedProofs: [],
		}),
	)
	assert.equal(result.ok, true)
	if (!result.ok) return
	assert.equal(result.proofs.length, 32)
	assert.equal(new Set(result.proofs).size, 32)
	assert.equal(
		result.proofs.every(proof => proof.length <= 300),
		true,
	)
	assert.equal(
		result.proofs.some(proof => proof.startsWith('44:')),
		true,
	)
	assert.equal(
		result.proofs.some(proof => proof.startsWith('1:')),
		false,
	)
})

test('parseEvaluatorText failures: no JSON, bad JSON, unknown verdict, non-object', () => {
	assert.deepEqual(parseEvaluatorText('no json here'), {
		ok: false,
		reason: 'Evaluator returned no JSON.',
	})
	assert.deepEqual(parseEvaluatorText('{not json}'), {
		ok: false,
		reason: 'Evaluator JSON parse failed.',
	})
	assert.deepEqual(
		parseEvaluatorText(
			JSON.stringify({
				verdict: 'maybe',
				proofs: [],
				invalidatedProofs: [],
			}),
		),
		{ ok: false, reason: 'Unknown evaluator verdict.' },
	)
	assert.deepEqual(parseEvaluatorText('[]'), {
		ok: false,
		reason: 'Evaluator returned no JSON.',
	})
	assert.deepEqual(parseEvaluatorText('null'), {
		ok: false,
		reason: 'Evaluator returned no JSON.',
	})
})

test('updateProofLedger removes invalidated proofs, appends, and normalizes whitespace', () => {
	const current = ['old proof', 'keep proof']
	assert.deepEqual(updateProofLedger(current, [], []), current)
	assert.deepEqual(
		updateProofLedger(current, ['new\nproof', 'keep proof'], ['old proof']),
		['new proof', 'keep proof'],
	)
})

test('isTurnCapReached uses evaluated cycles', () => {
	assert.equal(isTurnCapReached(29, 30), false)
	assert.equal(isTurnCapReached(30, 30), true)
	assert.equal(isTurnCapReached(536, 30), true)
})

test('decideEvaluatedGoal continues not_yet below the cap with merged proofs', () => {
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal(),
			{ turnsEvaluated: 2, noToolTurns: 0 },
			validReply(),
		),
		{
			action: 'continue',
			reason: 'Still missing proof.',
			proofs: ['one gate checked'],
		},
	)
})

test('decideEvaluatedGoal marks not_yet at the cap as stuck', () => {
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal(),
			{ turnsEvaluated: 3, noToolTurns: 0 },
			validReply({ proofs: ['latest check ran'] }),
		),
		{
			action: 'stop',
			verdict: 'stuck',
			reason: 'Turn cap reached (3).',
			proofs: ['one gate checked', 'latest check ran'],
		},
	)
})

test('decideEvaluatedGoal lets met and impossible win over the cap', () => {
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal(),
			{ turnsEvaluated: 3, noToolTurns: 0 },
			validReply({
				verdict: 'met',
				reason: 'All gates pass.',
				proofs: ['test command exited 0'],
			}),
		),
		{
			action: 'stop',
			verdict: 'met',
			reason: 'All gates pass.',
			proofs: ['one gate checked', 'test command exited 0'],
		},
	)
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal(),
			{ turnsEvaluated: 3, noToolTurns: 0 },
			validReply({
				verdict: 'impossible',
				reason: 'Required access is unavailable.',
			}),
		),
		{
			action: 'stop',
			verdict: 'impossible',
			reason: 'Required access is unavailable.',
			proofs: ['one gate checked'],
		},
	)
})

test('decideEvaluatedGoal pauses on evaluator failure', () => {
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal(),
			{ turnsEvaluated: 3, noToolTurns: 0 },
			{ ok: false, reason: 'Evaluator returned no JSON.' },
		),
		{ action: 'pause', reason: 'Evaluator returned no JSON.' },
	)
})

test('decideEvaluatedGoal pauses met without verified proofs', () => {
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal({ proofs: [] }),
			{ turnsEvaluated: 1, noToolTurns: 0 },
			validReply({
				verdict: 'met',
				reason: 'Done.',
			}),
		),
		{
			action: 'pause',
			reason: 'Evaluator returned met without verified proofs.',
		},
	)
})

test('evaluateWithFallback returns the first success without a fallback', async () => {
	const attempts: string[] = []
	const result = await evaluateWithFallback(
		[
			{ provider: 'test', id: 'primary' },
			{ provider: 'test', id: 'fallback' },
		],
		async model => {
			attempts.push(model.id)
			return validReply({
				verdict: 'met',
				reason: 'Done.',
				proofs: ['tests passed'],
			})
		},
	)
	assert.equal(result.ok, true)
	assert.deepEqual(attempts, ['primary'])
})

test('evaluateWithFallback falls through an invalid first attempt', async () => {
	const result = await evaluateWithFallback(
		[
			{ provider: 'test', id: 'primary' },
			{ provider: 'test', id: 'fallback' },
		],
		async model => {
			if (model.id === 'primary') {
				return {
					ok: false,
					reason: 'Evaluator returned no JSON. content=thinking, stop=stop',
				}
			}
			return validReply({
				verdict: 'met',
				reason: 'Fallback verified the goal.',
				proofs: ['command exited 0'],
			})
		},
	)
	assert.deepEqual(
		result,
		validReply({
			verdict: 'met',
			reason: 'Fallback verified the goal.',
			proofs: ['command exited 0'],
		}),
	)
})

test('evaluateWithFallback falls through a thrown first attempt', async () => {
	const result = await evaluateWithFallback(
		[
			{ provider: 'test', id: 'primary' },
			{ provider: 'test', id: 'fallback' },
		],
		async model => {
			if (model.id === 'primary') throw new Error('provider unavailable')
			return validReply({ reason: 'One proof remains.' })
		},
	)
	assert.equal(result.ok, true)
	if (!result.ok) return
	assert.equal(result.verdict, 'not_yet')
})

test('evaluateWithFallback retries the same model when no alternative is given', async () => {
	const primary = { provider: 'test', id: 'primary' }
	let attempts = 0
	const result = await evaluateWithFallback([primary, primary], async () => {
		attempts += 1
		if (attempts === 1) return { ok: false, reason: 'empty response' }
		return validReply({
			verdict: 'met',
			reason: 'Retry succeeded.',
			proofs: ['verified'],
		})
	})
	assert.equal(result.ok, true)
	assert.equal(attempts, 2)
})

test('evaluateWithFallback returns a bounded diagnostic naming both attempts', async () => {
	const longReason = 'x'.repeat(400)
	const longIdentity = 'model'.repeat(100)
	const result = await evaluateWithFallback(
		[
			{ provider: longIdentity, id: longIdentity },
			{ provider: longIdentity, id: longIdentity },
		],
		async model => ({ ok: false, reason: `${model.id}: ${longReason}` }),
	)
	assert.equal(result.ok, false)
	if (result.ok) return
	assert.match(result.reason, /#1 modelmodel/)
	assert.match(result.reason, /#2 modelmodel/)
	assert.equal(result.reason.length <= 500, true)
	assert.deepEqual(
		decideEvaluatedGoal(
			activeGoal(),
			{ turnsEvaluated: 3, noToolTurns: 0 },
			result,
		),
		{ action: 'pause', reason: result.reason },
	)
})

test('selectEvaluatorAttempts keeps up to two unique candidates in order', () => {
	const luna = { provider: 'openai-codex', id: 'gpt-5.6-luna' }
	const glm = { provider: 'openrouter', id: 'z-ai/glm-5.3-flash' }
	const grok = { provider: 'xai', id: 'grok-4.6' }
	assert.deepEqual(selectEvaluatorAttempts([luna, glm, grok]), [luna, glm])
	assert.deepEqual(selectEvaluatorAttempts([luna, luna, glm]), [luna, glm])
	assert.deepEqual(selectEvaluatorAttempts([luna, glm, luna]), [luna, glm])
	assert.deepEqual(selectEvaluatorAttempts([luna]), [luna])
	assert.deepEqual(selectEvaluatorAttempts([]), [])
})

test('restoreGoalState restores a valid active goal and normalizes proofs', () => {
	const restored = restoreGoalState(
		activeGoal({
			proofs: ['  keep   me  ', 'keep me', `${'x'.repeat(400)}`],
		}),
	)
	assert.ok(restored)
	assert.equal(restored.condition, 'tests pass; stop after 3 turns')
	assert.equal(restored.startedAt, '2026-08-21T00:00:00.000Z')
	assert.equal(restored.turnsEvaluated, 2)
	assert.equal(restored.noToolTurns, 0)
	assert.equal(restored.maxTurns, 3)
	assert.equal(restored.lastReason, 'One gate remains.')
	assert.equal(restored.lastVerdict, 'not_yet')
	assert.equal(restored.status, 'active')
	assert.equal(restored.proofs?.length, 2)
	assert.equal(restored.proofs?.[0], 'keep me')
	assert.equal(restored.proofs?.[1]?.length, 300)
})

test('restoreGoalState returns null for non-active statuses and malformed shapes', () => {
	assert.equal(restoreGoalState(null), null)
	assert.equal(restoreGoalState('active'), null)
	assert.equal(restoreGoalState({}), null)
	assert.equal(restoreGoalState(activeGoal({ status: 'met' })), null)
	assert.equal(restoreGoalState(activeGoal({ status: 'impossible' })), null)
	assert.equal(restoreGoalState(activeGoal({ status: 'cleared' })), null)
	assert.equal(restoreGoalState(activeGoal({ status: 'stuck' })), null)
	assert.equal(
		restoreGoalState({
			...activeGoal(),
			turnsEvaluated: '2',
		}),
		null,
	)
})

test('restoreGoalState normalizes unknown lastVerdict to null', () => {
	const restored = restoreGoalState(
		activeGoal({ lastVerdict: 'not-a-verdict' }),
	)
	assert.ok(restored)
	assert.equal(restored.lastVerdict, null)
	assert.equal(restored.status, 'active')
	assert.equal(restored.lastReason, 'One gate remains.')
})

test('goalChromeLines returns three lines truncated to width', () => {
	const lines = goalChromeLines(
		activeGoal({
			condition: 'a condition that is much wider than a narrow terminal',
			lastReason: 'a reason that is also much wider than the terminal',
		}),
		24,
	)
	assert.equal(lines.length, 3)
	assert.equal(
		lines.every(line => line.length <= 24),
		true,
	)
})

test('goal.json configures the evaluator independently', () => {
	const config = loadEvaluatorCandidates(configPath)
	const [first] = config
	assert.ok(first)
	assert.equal(first.provider, 'openai-codex')
	assert.equal(first.id, 'gpt-5.6-luna')
	assert.deepEqual(
		config.map(candidate => `${candidate.provider}/${candidate.id}`),
		['openai-codex/gpt-5.6-luna', 'openrouter/z-ai/glm-5.3-flash'],
	)
})

test('goal extension registers goal_set and goal, without turn_start', async t => {
	const ui = fakeUi()
	const installed = installGoal()
	assert.ok(installed.tool)
	assert.equal(installed.tool.name, 'goal_set')
	assert.deepEqual(installed.commands, ['goal'])
	assert.equal(installed.handlers.has('turn_start'), false)
	assert.ok(installed.handlers.get('agent_settled')?.[0])

	await t.test(
		'stale evaluation does not overwrite a replacement goal',
		async () => {
			const { handlers, persisted, tool } = installGoal()
			assert.ok(tool)
			let evaluatorStarted = false
			const gate: { release: (value: unknown) => void } = {
				release: () => {},
			}
			const evaluatorResult = new Promise(resolve => {
				gate.release = resolve
			})
			await tool.execute(
				'goal-set-old',
				{ condition: 'obsolete goal' },
				new AbortController().signal,
				() => {},
				{ ui },
			)

			const settled = handlers.get('agent_settled')?.[0]
			assert.ok(settled)
			const settling = settled(
				{},
				evaluatorContext(async () => {
					evaluatorStarted = true
					return evaluatorResult
				}, ui),
			)
			assert.equal(evaluatorStarted, true)

			await tool.execute(
				'goal-set-new',
				{ condition: 'replacement goal' },
				new AbortController().signal,
				() => {},
				{ ui },
			)
			gate.release(
				assistantReply({
					verdict: 'met',
					reason: 'Obsolete goal met.',
					proofs: ['obsolete proof'],
					invalidatedProofs: [],
				}),
			)
			await settling

			assert.equal(persisted.length, 2)
			assert.match(JSON.stringify(persisted[0]), /obsolete goal/)
			assert.match(JSON.stringify(persisted[1]), /replacement goal/)
		},
	)

	await t.test('internal turns do not consume the cap or abort', async () => {
		const { handlers, persisted, sentMessages, tool } = installGoal()
		assert.ok(tool)
		let aborts = 0
		await tool.execute(
			'goal-set',
			{ condition: 'finish the work; stop after 1 turns' },
			new AbortController().signal,
			() => {},
			{ ui },
		)

		const eventContext = evaluatorContext(
			async () =>
				assistantReply({
					verdict: 'not_yet',
					reason: 'Still missing proof.',
					proofs: [],
					invalidatedProofs: [],
				}),
			ui,
			{
				abort() {
					aborts += 1
				},
			},
		)
		for (let round = 0; round < 25; round += 1) {
			for (const handler of handlers.get('turn_start') ?? []) {
				await handler({}, eventContext)
			}
		}
		for (const handler of handlers.get('agent_settled') ?? []) {
			await handler({}, eventContext)
		}

		const settledState = persisted.at(-1)
		assert.ok(settledState && typeof settledState === 'object')
		assert.equal(
			'turnsEvaluated' in settledState
				? settledState.turnsEvaluated
				: undefined,
			1,
		)
		assert.equal(
			'status' in settledState ? settledState.status : undefined,
			'stuck',
		)
		assert.equal(handlers.get('turn_start')?.length ?? 0, 0)
		assert.equal(sentMessages.length, 0)
		assert.equal(aborts, 0)
	})
})
