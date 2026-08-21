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
	isTurnCapReached,
	parseEvaluatorText,
	restoreGoalState,
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

const tests: Array<[string, () => void | Promise<void>]> = [
	["cumulative proofs are parsed", testCumulativeProofsAreParsed],
	["proofs are required", testProofsAreRequired],
	["proof ledger is bounded and deduplicated", testProofLedgerIsBoundedAndDeduplicated],
	["ledger updates are code-enforced", testLedgerUpdatesAreCodeEnforced],
	["turn cap uses evaluated cycles", testTurnCapUsesEvaluatedCycles],
	["internal turn_start rounds do not consume cap or abort", testInternalTurnStartsDoNotConsumeCapOrAbort],
	["not_yet below cap continues", testNotYetBelowCapContinues],
	["not_yet at cap becomes stuck", testNotYetAtCapBecomesStuck],
	["met at cap wins", testMetAtCapWins],
	["impossible at cap wins", testImpossibleAtCapWins],
	["inflated started turns are ignored on restore", testInflatedStartedTurnsAreIgnoredOnRestore],
];

for (const [name, test] of tests) {
	await test();
	console.log(`ok  ${name}`);
}
console.log(`${tests.length} passed`);
