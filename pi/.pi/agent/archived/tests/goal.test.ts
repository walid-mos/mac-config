import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const typeboxStub = `data:text/javascript,${encodeURIComponent(
	"export const Type = { Object: (properties) => ({ properties }), String: (options) => options };",
)}`;
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "typebox") return { shortCircuit: true, url: typeboxStub };
		return nextResolve(specifier, context);
	},
});

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
} = await import("../extensions/goal.ts");

const activeGoal = {
	condition: "tests pass; stop after 3 turns",
	startedAt: "2026-08-21T00:00:00.000Z",
	turnsEvaluated: 2,
	noToolTurns: 0,
	maxTurns: 3,
	lastVerdict: "not_yet",
	lastReason: "One gate remains.",
	proofs: ["one gate checked"],
	status: "active",
} as const;

function testCumulativeProofsAreParsed(): void {
	const result = parseEvaluatorText(
		JSON.stringify({
			verdict: "not_yet",
			reason: "One gate remains.",
			proofs: ["make pi exited 0", "searcher.md is absent"],
			invalidatedProofs: [],
		}),
	);

	assert.deepEqual(result, {
		ok: true,
		verdict: "not_yet",
		reason: "One gate remains.",
		proofs: ["make pi exited 0", "searcher.md is absent"],
		invalidatedProofs: [],
	});
}

function testProofsAreRequired(): void {
	const result = parseEvaluatorText(
		JSON.stringify({ verdict: "met", reason: "Done without a proof ledger." }),
	);
	assert.deepEqual(result, { ok: false, reason: "Evaluator proof updates are missing or invalid." });
}

function testProofLedgerIsBoundedAndDeduplicated(): void {
	const proofs = Array.from({ length: 45 }, (_, index) => `${index}: ${"x".repeat(600)}`);
	proofs.push(proofs[0] ?? "");
	const result = parseEvaluatorText(
		JSON.stringify({ verdict: "not_yet", reason: "More", proofs, invalidatedProofs: [] }),
	);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.proofs.length, 32);
	assert.equal(new Set(result.proofs).size, 32);
	assert.equal(result.proofs.every((proof) => proof.length <= 300), true);
	assert.equal(result.proofs.some((proof) => proof.startsWith("44:")), true);
	assert.equal(result.proofs.some((proof) => proof.startsWith("1:")), false);
}

function testLedgerUpdatesAreCodeEnforced(): void {
	const current = ["old proof", "keep proof"];
	assert.deepEqual(updateProofLedger(current, [], []), current);
	const updated = updateProofLedger(current, ["new\nproof", "keep proof"], ["old proof"]);
	assert.deepEqual(updated, ["new proof", "keep proof"]);
}

function testTurnCapUsesEvaluatedCycles(): void {
	assert.equal(isTurnCapReached(29, 30), false);
	assert.equal(isTurnCapReached(30, 30), true);
	assert.equal(isTurnCapReached(536, 30), true);
}

function testEvaluatorAttemptsAreDeterministicAndDistinct(): void {
	const deepseek = { provider: "openrouter", id: "deepseek-v4-flash" };
	const kimi = { provider: "kimi-coding", id: "k3" };
	const current = { provider: "openai-codex", id: "gpt-5.6-sol" };
	assert.deepEqual(
		selectEvaluatorAttempts([current, kimi, deepseek], deepseek, current),
		[deepseek, current],
	);
	assert.deepEqual(
		selectEvaluatorAttempts([current, kimi, deepseek], undefined, current),
		[deepseek, current],
	);
	assert.deepEqual(selectEvaluatorAttempts([deepseek], deepseek, deepseek), [deepseek, deepseek]);
	assert.deepEqual(selectEvaluatorAttempts([], undefined, undefined), []);
}

async function testEvaluatorFirstAttemptSuccessAvoidsFallback(): Promise<void> {
	const models = [
		{ provider: "test", id: "primary" },
		{ provider: "test", id: "fallback" },
	];
	const attempts: string[] = [];
	const result = await evaluateWithFallback(models, async (model) => {
		attempts.push(model.id);
		return {
			ok: true,
			verdict: "met",
			reason: "Done.",
			proofs: ["tests passed"],
			invalidatedProofs: [],
		};
	});
	assert.equal(result.ok, true);
	assert.deepEqual(attempts, ["primary"]);
}

async function testInvalidEvaluatorUsesFallback(): Promise<void> {
	const models = [
		{ provider: "test", id: "primary" },
		{ provider: "test", id: "fallback" },
	];
	const result = await evaluateWithFallback(models, async (model) => {
		if (model.id === "primary") {
			return { ok: false, reason: "Evaluator returned no JSON. content=thinking, stop=stop" };
		}
		return {
			ok: true,
			verdict: "met",
			reason: "Fallback verified the goal.",
			proofs: ["command exited 0"],
			invalidatedProofs: [],
		};
	});
	assert.deepEqual(result, {
		ok: true,
		verdict: "met",
		reason: "Fallback verified the goal.",
		proofs: ["command exited 0"],
		invalidatedProofs: [],
	});
}

async function testThrownEvaluatorUsesFallback(): Promise<void> {
	const models = [
		{ provider: "test", id: "primary" },
		{ provider: "test", id: "fallback" },
	];
	const result = await evaluateWithFallback(models, async (model) => {
		if (model.id === "primary") throw new Error("provider unavailable");
		return {
			ok: true,
			verdict: "not_yet",
			reason: "One proof remains.",
			proofs: [],
			invalidatedProofs: [],
		};
	});
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.verdict, "not_yet");
}

async function testSameEvaluatorIsRetriedWithoutAlternative(): Promise<void> {
	const primary = { provider: "test", id: "primary" };
	let attempts = 0;
	const result = await evaluateWithFallback([primary, primary], async () => {
		attempts += 1;
		if (attempts === 1) return { ok: false, reason: "empty response" };
		return {
			ok: true,
			verdict: "met",
			reason: "Retry succeeded.",
			proofs: ["verified"],
			invalidatedProofs: [],
		};
	});
	assert.equal(result.ok, true);
	assert.equal(attempts, 2);
}

async function testInvalidEvaluatorsReturnBoundedDiagnostic(): Promise<void> {
	const longReason = "x".repeat(400);
	const longIdentity = "model".repeat(100);
	const result = await evaluateWithFallback(
		[
			{ provider: longIdentity, id: longIdentity },
			{ provider: longIdentity, id: longIdentity },
		],
		async (model) => ({ ok: false, reason: `${model.id}: ${longReason}` }),
	);
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.match(result.reason, /#1 modelmodel/);
	assert.match(result.reason, /#2 modelmodel/);
	assert.equal(result.reason.length <= 500, true);
	assert.deepEqual(
		decideEvaluatedGoal(activeGoal, { turnsEvaluated: 3, noToolTurns: 0 }, result),
		{ action: "pause", reason: result.reason },
	);
}

async function testStaleEvaluationDoesNotOverwriteReplacement(): Promise<void> {
	type FakeEventHandler = (event: unknown, context: unknown) => Promise<void>;
	type FakeGoalTool = { execute(...args: unknown[]): Promise<unknown> };
	const eventHandlers = new Map<string, FakeEventHandler[]>();
	const persistedStates: unknown[] = [];
	let goalTool: FakeGoalTool | undefined;
	let evaluatorStarted = false;
	let releaseEvaluator: (value: unknown) => void = () => {};
	const evaluatorResult = new Promise<unknown>((resolve) => {
		releaseEvaluator = resolve;
	});
	const ui = {
		notify() {},
		setStatus() {},
		setWidget() {},
	};
	const evaluatorModel = { id: "goal-evaluator", provider: "test" };
	const fakeApi = {
		appendEntry(_type: string, state: unknown) {
			persistedStates.push(state);
		},
		on(event: string, handler: FakeEventHandler) {
			eventHandlers.set(event, [...(eventHandlers.get(event) ?? []), handler]);
		},
		registerCommand() {},
		registerTool(tool: FakeGoalTool) {
			goalTool = tool;
		},
		sendUserMessage() {},
	};
	goalExtension(fakeApi);
	assert.ok(goalTool);
	const toolContext = { isIdle: () => true, sessionManager: {}, ui };
	await goalTool.execute(
		"goal-set-old",
		{ condition: "obsolete goal" },
		new AbortController().signal,
		() => {},
		toolContext,
	);

	const eventContext = {
		model: evaluatorModel,
		modelRegistry: {
			complete: async () => {
				evaluatorStarted = true;
				return evaluatorResult;
			},
			getAvailable: () => [evaluatorModel],
		},
		sessionManager: { getBranch: () => [] },
		ui,
	};
	const settled = eventHandlers.get("agent_settled")?.[0];
	assert.ok(settled);
	const settling = settled({}, eventContext);
	assert.equal(evaluatorStarted, true);

	await goalTool.execute(
		"goal-set-new",
		{ condition: "replacement goal" },
		new AbortController().signal,
		() => {},
		toolContext,
	);
	releaseEvaluator({
		role: "assistant",
		content: [{
			type: "text",
			text: JSON.stringify({
				verdict: "met",
				reason: "Obsolete goal met.",
				proofs: ["obsolete proof"],
				invalidatedProofs: [],
			}),
		}],
	});
	await settling;

	assert.equal(persistedStates.length, 2);
	assert.match(JSON.stringify(persistedStates[0]), /obsolete goal/);
	assert.match(JSON.stringify(persistedStates[1]), /replacement goal/);
}

async function testInternalTurnStartsDoNotConsumeCapOrAbort(): Promise<void> {
	type FakeEventHandler = (event: unknown, context: unknown) => Promise<void>;
	type FakeGoalTool = { execute(...args: unknown[]): Promise<unknown> };
	const eventHandlers = new Map<string, FakeEventHandler[]>();
	const persistedStates: unknown[] = [];
	const sentMessages: unknown[] = [];
	let goalTool: FakeGoalTool | undefined;
	let aborts = 0;
	const ui = {
		notify() {},
		setStatus() {},
		setWidget() {},
	};
	const evaluatorReply = {
		role: "assistant",
		content: [{ type: "text", text: JSON.stringify({
			verdict: "not_yet",
			reason: "Still missing proof.",
			proofs: [],
			invalidatedProofs: [],
		}) }],
	};
	const evaluatorModel = { id: "goal-evaluator", provider: "test" };
	const fakeApi = {
		appendEntry(_type: string, state: unknown) {
			persistedStates.push(state);
		},
		on(event: string, handler: FakeEventHandler) {
			eventHandlers.set(event, [...(eventHandlers.get(event) ?? []), handler]);
		},
		registerCommand() {},
		registerTool(tool: FakeGoalTool) {
			goalTool = tool;
		},
		sendUserMessage(message: unknown) {
			sentMessages.push(message);
		},
	};
	goalExtension(fakeApi);
	assert.ok(goalTool);
	await goalTool.execute(
		"goal-set",
		{ condition: "finish the work; stop after 1 turns" },
		new AbortController().signal,
		() => {},
		{ isIdle: () => false, sessionManager: {}, ui },
	);

	const eventContext = {
		abort() {
			aborts += 1;
		},
		model: evaluatorModel,
		modelRegistry: {
			complete: async () => evaluatorReply,
			getAvailable: () => [evaluatorModel],
		},
		sessionManager: {
			getBranch: () => [],
		},
		ui,
	};
	for (let round = 0; round < 25; round += 1) {
		for (const handler of eventHandlers.get("turn_start") ?? []) {
			await handler({}, eventContext);
		}
	}
	for (const handler of eventHandlers.get("agent_settled") ?? []) {
		await handler({}, eventContext);
	}

	const settledState = persistedStates.at(-1);
	assert.ok(settledState && typeof settledState === "object");
	assert.equal("turnsEvaluated" in settledState ? settledState.turnsEvaluated : undefined, 1);
	assert.equal("status" in settledState ? settledState.status : undefined, "stuck");
	assert.equal(eventHandlers.get("turn_start")?.length ?? 0, 0);
	assert.equal(sentMessages.length, 0);
	assert.equal(aborts, 0);
}

function testNotYetBelowCapContinues(): void {
	const decision = decideEvaluatedGoal(
		activeGoal,
		{ turnsEvaluated: 2, noToolTurns: 0 },
		{
			ok: true,
			verdict: "not_yet",
			reason: "Still missing proof.",
			proofs: [],
			invalidatedProofs: [],
		},
	);

	assert.deepEqual(decision, {
		action: "continue",
		reason: "Still missing proof.",
		proofs: ["one gate checked"],
	});
}

function testNotYetAtCapBecomesStuck(): void {
	const decision = decideEvaluatedGoal(
		activeGoal,
		{ turnsEvaluated: 3, noToolTurns: 0 },
		{
			ok: true,
			verdict: "not_yet",
			reason: "Still missing proof.",
			proofs: ["latest check ran"],
			invalidatedProofs: [],
		},
	);

	assert.deepEqual(decision, {
		action: "stop",
		verdict: "stuck",
		reason: "Turn cap reached (3).",
		proofs: ["one gate checked", "latest check ran"],
	});
}

function testMetAtCapWins(): void {
	const decision = decideEvaluatedGoal(
		activeGoal,
		{ turnsEvaluated: 3, noToolTurns: 0 },
		{
			ok: true,
			verdict: "met",
			reason: "All gates pass.",
			proofs: ["test command exited 0"],
			invalidatedProofs: [],
		},
	);

	assert.deepEqual(decision, {
		action: "stop",
		verdict: "met",
		reason: "All gates pass.",
		proofs: ["one gate checked", "test command exited 0"],
	});
}

function testImpossibleAtCapWins(): void {
	const decision = decideEvaluatedGoal(
		activeGoal,
		{ turnsEvaluated: 3, noToolTurns: 0 },
		{
			ok: true,
			verdict: "impossible",
			reason: "Required access is unavailable.",
			proofs: [],
			invalidatedProofs: [],
		},
	);

	assert.deepEqual(decision, {
		action: "stop",
		verdict: "impossible",
		reason: "Required access is unavailable.",
		proofs: ["one gate checked"],
	});
}

function testInflatedStartedTurnsAreIgnoredOnRestore(): void {
	const legacyState = {
		...activeGoal,
		turnsEvaluated: 2,
		turnsStarted: 25,
		lastVerdict: "stuck",
		lastReason: "Turn cap reached (25).",
		status: "stuck",
	} as const;
	const restored = restoreGoalState(legacyState);
	assert.ok(restored);
	assert.equal(restored.turnsEvaluated, 2);
	assert.equal(restored.status, "active");
	assert.equal(restored.lastVerdict, "not_yet");
	assert.equal("turnsStarted" in restored, false);

	assert.equal(
		restoreGoalState({ ...legacyState, lastReason: "No tool use for 2 turns — loop stopped, goal still set." }),
		null,
	);
	assert.equal(restoreGoalState({ ...legacyState, turnsStarted: 2 }), null);
}

function testGoalChromeLinesRespectTerminalWidth(): void {
	const lines = goalChromeLines(
		{
			...activeGoal,
			condition: "a condition that is much wider than a narrow terminal",
			lastReason: "a reason that is also much wider than the terminal",
		},
		24,
	);
	assert.equal(lines.length, 3);
	assert.equal(lines.every((line) => line.length <= 24), true);
}

const tests: Array<[string, () => void | Promise<void>]> = [
	["cumulative proofs are parsed", testCumulativeProofsAreParsed],
	["proofs are required", testProofsAreRequired],
	["proof ledger is bounded and deduplicated", testProofLedgerIsBoundedAndDeduplicated],
	["ledger updates are code-enforced", testLedgerUpdatesAreCodeEnforced],
	["turn cap uses evaluated cycles", testTurnCapUsesEvaluatedCycles],
	["evaluator attempts are deterministic and distinct", testEvaluatorAttemptsAreDeterministicAndDistinct],
	["first evaluator success avoids fallback", testEvaluatorFirstAttemptSuccessAvoidsFallback],
	["invalid evaluator uses fallback", testInvalidEvaluatorUsesFallback],
	["thrown evaluator uses fallback", testThrownEvaluatorUsesFallback],
	["same evaluator is retried without an alternative", testSameEvaluatorIsRetriedWithoutAlternative],
	["invalid evaluators return bounded diagnostic", testInvalidEvaluatorsReturnBoundedDiagnostic],
	["stale evaluation does not overwrite replacement", testStaleEvaluationDoesNotOverwriteReplacement],
	["internal turn_start rounds do not consume cap or abort", testInternalTurnStartsDoNotConsumeCapOrAbort],
	["not_yet below cap continues", testNotYetBelowCapContinues],
	["not_yet at cap becomes stuck", testNotYetAtCapBecomesStuck],
	["met at cap wins", testMetAtCapWins],
	["impossible at cap wins", testImpossibleAtCapWins],
	["inflated started turns are ignored on restore", testInflatedStartedTurnsAreIgnoredOnRestore],
	["goal chrome lines respect terminal width", testGoalChromeLinesRespectTerminalWidth],
];

for (const [name, test] of tests) {
	await test();
	console.log(`ok  ${name}`);
}
console.log(`${tests.length} passed`);
