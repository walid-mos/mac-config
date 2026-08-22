import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const typeboxStub = `data:text/javascript,${encodeURIComponent(
	[
		"export const Type = {",
		"  Object: (properties) => ({ properties }),",
		"  String: (options) => options,",
		"  Array: (items, options) => ({ items, ...options }),",
		"};",
	].join(""),
)}`;
const stringEnumStub = `data:text/javascript,${encodeURIComponent(
	"export const StringEnum = (values, options) => ({ values, ...options });",
)}`;
const emptyStub = `data:text/javascript,${encodeURIComponent("export {};")}`;
const textStub = `data:text/javascript,${encodeURIComponent(
	"export class Text { constructor() {} }",
)}`;

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "typebox") return { shortCircuit: true, url: typeboxStub };
		if (specifier === "@earendil-works/pi-ai") return { shortCircuit: true, url: stringEnumStub };
		if (specifier === "@earendil-works/pi-tui") return { shortCircuit: true, url: textStub };
		if (specifier === "@earendil-works/pi-agent-core") return { shortCircuit: true, url: emptyStub };
		if (specifier === "@earendil-works/pi-coding-agent") return { shortCircuit: true, url: emptyStub };
		return nextResolve(specifier, context);
	},
});

const {
	COMPACT_PHASE,
	MAX_ITEM_CHARS,
	MAX_LIST_ITEMS,
	MAX_TEXT_CHARS,
	PROJECTION_MARKER,
	WORK_LEDGER_ENTRY_TYPE,
	COMPACT_WIDGET_HIDE_MS,
	LEDGER_WIDGET_PLACEMENT,
	cancelCompactWidgetHide,
	collectLedgerHistory,
	formatLedgerProjection,
	formatStatus,
	injectLedgerProjection,
	isLedgerProjectionMessage,
	needsProjection,
	normalizeSnapshot,
	parseLedgerRecord,
	restoreLatestRecord,
	restoreLatestSnapshot,
	setLedgerWidgetScheduler,
	shouldShowLedgerWidget,
	snapshotFromCompactionSummary,
	syncLedgerWidget,
} = await import("../extensions/work-ledger.ts");

type LedgerBranchEntry = {
	type: string;
	customType?: string;
	data?: unknown;
};

type WorkSnapshot = ReturnType<typeof normalizeSnapshot>;

function sampleSnapshot(overrides: Partial<WorkSnapshot> = {}): WorkSnapshot {
	return {
		goal: "Ship work ledger",
		phase: "implement",
		status: "active",
		done: ["read contract"],
		inProgress: ["write extension"],
		blocked: [],
		decisions: [{ decision: "custom entries", rationale: "keep raw state out of context" }],
		artifacts: [{ path: "work-ledger.ts", purpose: "extension" }],
		nextSteps: ["tests"],
		evidence: ["branch order"],
		...overrides,
	};
}

function custom(data: unknown): LedgerBranchEntry {
	return { type: "custom", customType: WORK_LEDGER_ENTRY_TYPE, data };
}

function snapshotRecord(overrides: Partial<WorkSnapshot> = {}): LedgerBranchEntry {
	return custom({ kind: "snapshot", origin: "checkpoint", ...sampleSnapshot(overrides) });
}

function compactSnapshotRecord(overrides: Partial<WorkSnapshot> = {}): LedgerBranchEntry {
	return custom({
		kind: "snapshot",
		origin: "compact",
		...sampleSnapshot({ phase: COMPACT_PHASE, ...overrides }),
	});
}

function testRestoreLatestValidSnapshot(): void {
	const entries: LedgerBranchEntry[] = [
		{ type: "message" },
		snapshotRecord({ phase: "explore", goal: "old" }),
		{ type: "custom", customType: "other", data: { kind: "snapshot", ...sampleSnapshot({ phase: "noise" }) } },
		snapshotRecord({ phase: "implement", goal: "current" }),
	];
	const restored = restoreLatestSnapshot(entries);
	assert.equal(restored?.phase, "implement");
	assert.equal(restored?.goal, "current");
}

function testRestoreSkipsInvalidThenPicksLatest(): void {
	const entries: LedgerBranchEntry[] = [
		snapshotRecord({ phase: "first" }),
		custom({ kind: "snapshot", goal: 1, phase: "bad" }),
		snapshotRecord({ phase: "second" }),
	];
	assert.equal(restoreLatestSnapshot(entries)?.phase, "second");
}

function testClearTombstoneHidesEarlierSnapshot(): void {
	const entries: LedgerBranchEntry[] = [snapshotRecord(), custom({ kind: "clear" })];
	assert.equal(restoreLatestSnapshot(entries), null);
	assert.equal(collectLedgerHistory(entries).length, 1);
}

function testSnapshotAfterClearRestores(): void {
	const entries: LedgerBranchEntry[] = [
		snapshotRecord({ phase: "old" }),
		custom({ kind: "clear" }),
		snapshotRecord({ phase: "new" }),
	];
	assert.equal(restoreLatestSnapshot(entries)?.phase, "new");
}

function testProjectionNeededAfterCompaction(): void {
	const entries: LedgerBranchEntry[] = [snapshotRecord(), { type: "compaction" }];
	assert.equal(needsProjection(entries), true);
}

function testNoProjectionAfterNewerCheckpoint(): void {
	const entries: LedgerBranchEntry[] = [
		snapshotRecord({ phase: "old" }),
		{ type: "compaction" },
		snapshotRecord({ phase: "new" }),
	];
	assert.equal(needsProjection(entries), false);
}

function testNoProjectionAfterClear(): void {
	const entries: LedgerBranchEntry[] = [snapshotRecord(), { type: "compaction" }, custom({ kind: "clear" })];
	assert.equal(needsProjection(entries), false);
	assert.equal(needsProjection([snapshotRecord(), custom({ kind: "clear" }), { type: "compaction" }]), false);
}

function testNoProjectionWithoutCompaction(): void {
	assert.equal(needsProjection([snapshotRecord()]), false);
	assert.equal(needsProjection([{ type: "compaction" }]), false);
}

function testInvalidCustomEntriesAreRejected(): void {
	assert.equal(parseLedgerRecord(undefined), null);
	assert.equal(parseLedgerRecord({}), null);
	assert.equal(parseLedgerRecord({ kind: "snapshot" }), null);
	assert.equal(parseLedgerRecord({ kind: "nope" }), null);
	assert.equal(parseLedgerRecord({ kind: "snapshot", ...sampleSnapshot(), status: "cleared" }), null);
	assert.equal(parseLedgerRecord({ kind: "snapshot", ...sampleSnapshot(), goal: 12 }), null);
	assert.equal(parseLedgerRecord({ kind: "snapshot", ...sampleSnapshot(), done: ["ok", 2] }), null);
	assert.equal(parseLedgerRecord({ kind: "snapshot", ...sampleSnapshot(), decisions: [{ decision: "x" }] }), null);
	assert.equal(parseLedgerRecord({ ...sampleSnapshot() }), null);
	assert.deepEqual(parseLedgerRecord({ kind: "clear", extra: true }), { kind: "clear" });
}

function testNormalizeBoundsAndEmptyItems(): void {
	const oversized = "x".repeat(MAX_TEXT_CHARS + 40);
	const items = Array.from({ length: MAX_LIST_ITEMS + 5 }, (_, index) => ` item-${index}  `);
	const normalized = normalizeSnapshot(
		sampleSnapshot({
			goal: `  ${oversized}  `,
			phase: oversized,
			done: ["", "  keep  ", ...items],
			inProgress: items,
			blocked: ["", "   "],
			decisions: [
				{ decision: "", rationale: "skip" },
				{ decision: "  choose  ", rationale: `  ${"y".repeat(MAX_ITEM_CHARS + 8)}  ` },
			],
			artifacts: [
				{ path: "", purpose: "skip" },
				{ path: "  a.ts  ", purpose: "  keep  " },
			],
			nextSteps: items,
			evidence: items,
		}),
	);
	assert.equal(normalized.goal.length, MAX_TEXT_CHARS);
	assert.equal(normalized.phase.length, MAX_TEXT_CHARS);
	assert.equal(normalized.done.length, MAX_LIST_ITEMS);
	assert.equal(normalized.done[0], "keep");
	assert.equal(normalized.inProgress.length, MAX_LIST_ITEMS);
	assert.deepEqual(normalized.blocked, []);
	assert.equal(normalized.decisions.length, 1);
	assert.equal(normalized.decisions[0]?.decision, "choose");
	assert.equal(normalized.decisions[0]?.rationale.length, MAX_ITEM_CHARS);
	assert.deepEqual(normalized.artifacts, [{ path: "a.ts", purpose: "keep" }]);
	assert.equal(normalized.nextSteps.length, MAX_LIST_ITEMS);
	assert.equal(normalized.evidence.length, MAX_LIST_ITEMS);
}

function testProjectionTextAndDedup(): void {
	const snapshot = sampleSnapshot();
	const text = formatLedgerProjection(snapshot);
	assert.equal(text.startsWith(PROJECTION_MARKER), true);
	assert.match(text, /^\[work-ledger\]$/m);
	assert.match(text, /^goal: Ship work ledger$/m);
	assert.match(text, /^phase: implement$/m);
	assert.match(text, /^status: active$/m);
	assert.match(text, /^- custom entries — keep raw state out of context$/m);
	const first = injectLedgerProjection([], snapshot, 7);
	assert.equal(first.length, 1);
	assert.equal(isLedgerProjectionMessage(first[0]), true);
	const second = injectLedgerProjection(first, snapshot, 8);
	assert.equal(second.length, 1);
	assert.equal(isLedgerProjectionMessage({ role: "user", content: text }), false);
	assert.equal(isLedgerProjectionMessage({ role: "assistant", content: text }), false);
}

function testRestoreDoesNotCoerceArbitraryData(): void {
	const entries: LedgerBranchEntry[] = [
		custom({ goal: "no-kind", phase: "x", status: "active" }),
		custom({ kind: "snapshot", goal: "partial" }),
		{ type: "custom", customType: WORK_LEDGER_ENTRY_TYPE, data: "not-an-object" },
	];
	assert.equal(restoreLatestSnapshot(entries), null);
	assert.equal(needsProjection([...entries, { type: "compaction" }]), false);
}

function testProjectionInsertsBeforeLatestUserAndDedups(): void {
	const snapshot = sampleSnapshot();
	const earlier = { role: "user" as const, content: "earlier prompt", timestamp: 1 };
	const latest = { role: "user" as const, content: "[work-ledger] do the next slice", timestamp: 3 };
	const injected = injectLedgerProjection([earlier, latest], snapshot, 10);
	assert.equal(injected.length, 3);
	assert.equal(injected[0], earlier);
	assert.equal(isLedgerProjectionMessage(injected[0]), false);
	assert.equal(isLedgerProjectionMessage(injected[1]), true);
	assert.equal(injected[2], latest);
	assert.equal(isLedgerProjectionMessage(injected[2]), false);
	const again = injectLedgerProjection(injected, snapshot, 11);
	assert.equal(again.length, 3);
	assert.equal(again[0], earlier);
	assert.equal(isLedgerProjectionMessage(again[1]), true);
	assert.equal(again[2], latest);
}

test("restores latest valid snapshot and ignores other custom types", testRestoreLatestValidSnapshot);
test("skips invalid records while restoring later valid snapshot", testRestoreSkipsInvalidThenPicksLatest);
test("clear tombstone hides earlier snapshot but keeps history", testClearTombstoneHidesEarlierSnapshot);
test("snapshot after clear restores", testSnapshotAfterClearRestores);
test("projects after compaction of a checkpoint", testProjectionNeededAfterCompaction);
test("does not project after a newer checkpoint", testNoProjectionAfterNewerCheckpoint);
test("does not project after clear", testNoProjectionAfterClear);
test("does not project without compaction", testNoProjectionWithoutCompaction);
test("rejects invalid custom entries instead of coercing", testInvalidCustomEntriesAreRejected);
test("normalizes bounds and drops empty items", testNormalizeBoundsAndEmptyItems);
test("projects bounded text once", testProjectionTextAndDedup);
test("restore rejects arbitrary persisted data", testRestoreDoesNotCoerceArbitraryData);
test("inserts projection before latest user prompt and dedups", testProjectionInsertsBeforeLatestUserAndDedups);
test("projects compact-origin snapshot after compaction", testProjectionNeededForCompactOriginAfterCompaction);
test("does not project after a newer agent checkpoint", testNoProjectionAfterNewerCheckpointOverCompact);
test("parses compact summary into a snapshot", testSnapshotFromCompactionSummary);
test("falls back when compact summary is empty", testCompactSummaryFallback);
test("defaults missing origin to checkpoint", testMissingOriginDefaultsToCheckpoint);
test("shows widget only for active or blocked snapshots", testWidgetHiddenWhenComplete);
test("places ledger widget below the editor", testLedgerWidgetPlacement);
test("hides compact widget after scheduled delay", testCompactWidgetHideAfterDelay);
test("keeps checkpoint widget and cancels compact hide", testCheckpointCancelsCompactHide);
test("clear and scheduler reset cancel compact hide", testClearAndResetCancelCompactHide);
test("restores compact origin on latest record", testRestoreLatestRecordOrigin);

function testProjectionNeededForCompactOriginAfterCompaction(): void {
	assert.equal(needsProjection([{ type: "compaction" }, compactSnapshotRecord()]), true);
	assert.equal(needsProjection([snapshotRecord(), { type: "compaction" }, compactSnapshotRecord()]), true);
}

function testNoProjectionAfterNewerCheckpointOverCompact(): void {
	const entries: LedgerBranchEntry[] = [
		{ type: "compaction" },
		compactSnapshotRecord(),
		snapshotRecord({ phase: "next slice" }),
	];
	assert.equal(needsProjection(entries), false);
}

const SAMPLE_COMPACT_SUMMARY = `## Goal
Ship the work ledger compact hook

## Constraints & Preferences
- Keep snapshots out of LLM context

## Progress
### Done
- [x] parse compact markdown
### In Progress
- [ ] wire session_compact
### Blocked
- missing tests

## Key Decisions
- **custom entries**: keep raw state out of context

## Next Steps
1. restow pi

## Critical Context
- compact origin must project

<modified-files>
work-ledger.ts
</modified-files>
<read-files>
compaction.md
</read-files>
`;

function testSnapshotFromCompactionSummary(): void {
	const snapshot = snapshotFromCompactionSummary(SAMPLE_COMPACT_SUMMARY, null);
	assert.equal(snapshot.goal, "Ship the work ledger compact hook");
	assert.equal(snapshot.phase, COMPACT_PHASE);
	assert.equal(snapshot.status, "blocked");
	assert.deepEqual(snapshot.done, ["parse compact markdown"]);
	assert.deepEqual(snapshot.inProgress, ["wire session_compact"]);
	assert.deepEqual(snapshot.blocked, ["missing tests"]);
	assert.deepEqual(snapshot.decisions, [
		{ decision: "custom entries", rationale: "keep raw state out of context" },
	]);
	assert.deepEqual(snapshot.nextSteps, ["restow pi"]);
	assert.deepEqual(snapshot.evidence, ["compact origin must project"]);
	assert.deepEqual(snapshot.artifacts, [
		{ path: "work-ledger.ts", purpose: "modified" },
		{ path: "compaction.md", purpose: "read" },
	]);
}

function testCompactSummaryFallback(): void {
	const fallback = sampleSnapshot({ goal: "Keep going", blocked: [] });
	const snapshot = snapshotFromCompactionSummary("No prior history. Split-turn compaction.", fallback);
	assert.equal(snapshot.goal, "Keep going");
	assert.equal(snapshot.phase, COMPACT_PHASE);
	assert.equal(snapshot.status, "active");
	assert.deepEqual(snapshot.done, fallback.done);
	assert.deepEqual(snapshot.nextSteps, fallback.nextSteps);
	const empty = snapshotFromCompactionSummary("", null);
	assert.equal(empty.goal, "Continue the current session");
	assert.equal(empty.phase, COMPACT_PHASE);
}

function testMissingOriginDefaultsToCheckpoint(): void {
	const parsed = parseLedgerRecord({ kind: "snapshot", ...sampleSnapshot() });
	assert.equal(parsed?.kind, "snapshot");
	if (parsed?.kind !== "snapshot") return;
	assert.equal(parsed.origin, "checkpoint");
}

function testWidgetHiddenWhenComplete(): void {
	assert.equal(shouldShowLedgerWidget(null), false);
	assert.equal(shouldShowLedgerWidget(sampleSnapshot({ status: "active" })), true);
	assert.equal(shouldShowLedgerWidget(sampleSnapshot({ status: "blocked" })), true);
	assert.equal(shouldShowLedgerWidget(sampleSnapshot({ status: "complete" })), false);
	const restored = restoreLatestSnapshot([snapshotRecord({ status: "complete", phase: "shipped" })]);
	assert.equal(restored?.status, "complete");
	assert.equal(shouldShowLedgerWidget(restored), false);
	assert.equal(formatStatus(restored).startsWith("Work ledger (complete)"), true);
	assert.equal(collectLedgerHistory([snapshotRecord({ status: "complete" })]).length, 1);
}

type WidgetCall = {
	id: string;
	value: string[] | undefined;
	placement?: string;
};

function createFakeClock(): {
	pending: Array<{ callback: () => void; delayMs: number }>;
	flush: () => void;
} {
	const pending: Array<{ callback: () => void; delayMs: number }> = [];
	setLedgerWidgetScheduler((callback, delayMs) => {
		const item = { callback, delayMs };
		pending.push(item);
		return {
			cancel: () => {
				const index = pending.indexOf(item);
				if (index >= 0) pending.splice(index, 1);
			},
		};
	});
	return {
		pending,
		flush: () => {
			const due = pending.splice(0, pending.length);
			for (const item of due) item.callback();
		},
	};
}

function captureWidgets(): { calls: WidgetCall[]; setWidget: typeof syncLedgerWidget extends never ? never : Parameters<typeof syncLedgerWidget>[0] } {
	const calls: WidgetCall[] = [];
	return {
		calls,
		setWidget: (id, value, options) => {
			calls.push({ id, value, placement: options?.placement });
		},
	};
}

function testLedgerWidgetPlacement(): void {
	const clock = createFakeClock();
	const ui = captureWidgets();
	syncLedgerWidget(ui.setWidget, sampleSnapshot(), "checkpoint");
	assert.equal(ui.calls.at(-1)?.placement, LEDGER_WIDGET_PLACEMENT);
	assert.equal(LEDGER_WIDGET_PLACEMENT, "belowEditor");
	assert.equal(clock.pending.length, 0);
	setLedgerWidgetScheduler();
}

function testCompactWidgetHideAfterDelay(): void {
	const clock = createFakeClock();
	const ui = captureWidgets();
	syncLedgerWidget(ui.setWidget, sampleSnapshot({ phase: COMPACT_PHASE }), "compact");
	assert.equal(ui.calls.at(-1)?.value?.[0]?.includes("work-ledger"), true);
	assert.equal(clock.pending.length, 1);
	assert.equal(clock.pending[0]?.delayMs, COMPACT_WIDGET_HIDE_MS);
	syncLedgerWidget(ui.setWidget, sampleSnapshot({ phase: COMPACT_PHASE }), "compact");
	assert.equal(clock.pending.length, 1);
	clock.flush();
	assert.equal(ui.calls.at(-1)?.value, undefined);
	assert.equal(clock.pending.length, 0);
	setLedgerWidgetScheduler();
}

function testCheckpointCancelsCompactHide(): void {
	const clock = createFakeClock();
	const ui = captureWidgets();
	syncLedgerWidget(ui.setWidget, sampleSnapshot({ phase: COMPACT_PHASE }), "compact");
	syncLedgerWidget(ui.setWidget, sampleSnapshot({ phase: "next" }), "checkpoint");
	assert.equal(clock.pending.length, 0);
	assert.equal(ui.calls.at(-1)?.value?.[0]?.includes("next"), true);
	clock.flush();
	assert.equal(ui.calls.at(-1)?.value?.[0]?.includes("next"), true);
	setLedgerWidgetScheduler();
}

function testClearAndResetCancelCompactHide(): void {
	const clock = createFakeClock();
	const ui = captureWidgets();
	syncLedgerWidget(ui.setWidget, sampleSnapshot(), "compact");
	syncLedgerWidget(ui.setWidget, null, null);
	assert.equal(clock.pending.length, 0);
	assert.equal(ui.calls.at(-1)?.value, undefined);
	syncLedgerWidget(ui.setWidget, sampleSnapshot(), "compact");
	setLedgerWidgetScheduler();
	assert.equal(clock.pending.length, 0);
	cancelCompactWidgetHide();
}

function testRestoreLatestRecordOrigin(): void {
	assert.equal(restoreLatestRecord([compactSnapshotRecord()])?.origin, "compact");
	assert.equal(restoreLatestRecord([compactSnapshotRecord(), snapshotRecord()])?.origin, "checkpoint");
}
