/**
 * Phase-checkpoint ledger.
 *
 * `work_checkpoint` records a bounded snapshot at semantic phase boundaries
 * (never every turn). `/compact` (and auto-compact) always writes a compact-origin
 * snapshot from the native summary so the ledger is never missing after compact.
 * Snapshots persist only as custom session entries, so raw ledger state stays out
 * of LLM context. A transient `context` hook projects the latest non-cleared
 * snapshot after compaction until `/clear` or `/work-ledger clear`.
 *
 * /work-ledger [status|history|clear]
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";
import { setOrderedSurfaceWidget } from "./ui/ordered-widget-stack.ts";

export const WORK_LEDGER_ENTRY_TYPE = "work-ledger";
export const PROJECTION_MARKER = "[work-ledger]";
export const MAX_TEXT_CHARS = 400;
export const MAX_ITEM_CHARS = 200;
export const MAX_LIST_ITEMS = 12;

const STATUSES = ["active", "blocked", "complete"] as const;

export type WorkStatus = (typeof STATUSES)[number];

export type WorkDecision = {
	decision: string;
	rationale: string;
};

export type WorkArtifact = {
	path: string;
	purpose: string;
};

export type WorkSnapshot = {
	goal: string;
	phase: string;
	status: WorkStatus;
	done: string[];
	inProgress: string[];
	blocked: string[];
	decisions: WorkDecision[];
	artifacts: WorkArtifact[];
	nextSteps: string[];
	evidence: string[];
};

export type SnapshotOrigin = "checkpoint" | "compact";
export type SnapshotRecord = WorkSnapshot & { kind: "snapshot"; origin: SnapshotOrigin };
export type ClearRecord = { kind: "clear" };
export type LedgerRecord = SnapshotRecord | ClearRecord;

export const COMPACT_PHASE = "compacted";
export const LEDGER_WIDGET_PLACEMENT = "belowEditor" as const;
export const COMPACT_WIDGET_HIDE_MS = 20_000;
const DEFAULT_COMPACT_GOAL = "Continue the current session";

export type DelayHandle = {
	cancel: () => void;
};

export type ScheduleDelay = (callback: () => void, delayMs: number) => DelayHandle;

const defaultScheduleDelay: ScheduleDelay = (callback, delayMs) => {
	const timer = setTimeout(callback, delayMs);
	return { cancel: () => clearTimeout(timer) };
};

let scheduleDelay: ScheduleDelay = defaultScheduleDelay;
let compactHideHandle: DelayHandle | null = null;

export function setLedgerWidgetScheduler(next?: ScheduleDelay): void {
	cancelCompactWidgetHide();
	scheduleDelay = next ?? defaultScheduleDelay;
}

export function cancelCompactWidgetHide(): void {
	compactHideHandle?.cancel();
	compactHideHandle = null;
}

export type LedgerBranchEntry = {
	type: string;
	customType?: string;
	data?: unknown;
};

const boundedText = (description: string): ReturnType<typeof Type.String> =>
	Type.String({ minLength: 1, maxLength: MAX_TEXT_CHARS, description });

const boundedItem = (description: string): ReturnType<typeof Type.String> =>
	Type.String({ minLength: 1, maxLength: MAX_ITEM_CHARS, description });

const boundedList = (description: string) =>
	Type.Array(boundedItem("Item"), { maxItems: MAX_LIST_ITEMS, description });

export const WorkCheckpointParams = Type.Object({
	goal: boundedText("Current session goal"),
	phase: boundedText("Semantic phase name"),
	status: StringEnum(STATUSES, { description: "active, blocked, or complete" }),
	done: boundedList("Completed work"),
	inProgress: boundedList("Work currently underway"),
	blocked: boundedList("Blocked items"),
	decisions: Type.Array(
		Type.Object({
			decision: boundedItem("Decision taken"),
			rationale: boundedItem("Why it was taken"),
		}),
		{ maxItems: MAX_LIST_ITEMS, description: "Decisions and rationales" },
	),
	artifacts: Type.Array(
		Type.Object({
			path: boundedItem("Artifact path"),
			purpose: boundedItem("Why the artifact exists"),
		}),
		{ maxItems: MAX_LIST_ITEMS, description: "Produced artifacts" },
	),
	nextSteps: boundedList("Immediate next steps"),
	evidence: boundedList("Evidence for the current phase"),
});

export type WorkCheckpointInput = Static<typeof WorkCheckpointParams>;

const COMMANDS = ["status", "history", "clear"] as const;

let api: ExtensionAPI | null = null;
let current: WorkSnapshot | null = null;
let currentOrigin: SnapshotOrigin | null = null;

export default function workLedgerExtension(pi: ExtensionAPI): void {
	api = pi;

	pi.registerTool({
		name: "work_checkpoint",
		label: "Work checkpoint",
		description:
			"Record a bounded phase checkpoint. Call only at semantic phase boundaries, never every turn.",
		promptSnippet: "Save a phase checkpoint at a semantic boundary, never every turn",
		promptGuidelines: [
			"Use work_checkpoint only at semantic phase boundaries (plan done, implementation slice done, blocked, complete).",
			"Do not call work_checkpoint every turn or after routine tool use.",
		],
		parameters: WorkCheckpointParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const snapshot = normalizeSnapshot(params);
			persist({ kind: "snapshot", origin: "checkpoint", ...snapshot });
			current = snapshot;
			currentOrigin = "checkpoint";
			renderWidget(ctx, snapshot, "checkpoint");
			return {
				content: [{ type: "text", text: `Checkpoint saved: ${snapshot.phase} (${snapshot.status})` }],
			};
		},
		renderCall(args, theme) {
			const phase = typeof args.phase === "string" ? args.phase : "...";
			const status = typeof args.status === "string" ? args.status : "";
			return new Text(
				`${theme.fg("muted", "work_checkpoint ")}${theme.fg("dim", clip(phase, 40))} ${theme.fg("muted", status)}`,
				0,
				0,
			);
		},
	});

	pi.registerCommand("work-ledger", {
		description: "Show, list, or clear the phase checkpoint ledger",
		getArgumentCompletions: (prefix: string) => {
			const hits = COMMANDS.filter((item) => item.startsWith(prefix));
			if (hits.length === 0) return null;
			return hits.map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => {
			handleCommand(args.trim(), ctx);
		},
	});

	pi.registerEntryRenderer<LedgerRecord>(WORK_LEDGER_ENTRY_TYPE, (entry, _options, theme) => {
		const record = parseLedgerRecord(entry.data);
		if (!record) return new Text(theme.fg("dim", "work-ledger · invalid"), 0, 0);
		if (record.kind === "clear") return new Text(theme.fg("muted", "work-ledger · cleared"), 0, 0);
		return new Text(
			`${theme.fg("muted", "work-ledger")} ${theme.fg("dim", `· ${record.status} · ${clip(record.phase, 40)}`)}`,
			0,
			0,
		);
	});

	pi.on("session_start", async (_event, ctx) => {
		applyRestoredRecord(ctx, restoreLatestRecord(ctx.sessionManager.getBranch()));
	});

	pi.on("session_tree", async (_event, ctx) => {
		applyRestoredRecord(ctx, restoreLatestRecord(ctx.sessionManager.getBranch()));
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		cancelCompactWidgetHide();
		setOrderedSurfaceWidget(ctx.ui, "work-ledger", undefined, "belowEditor");
	});

	pi.on("session_compact", async (event, ctx) => {
		const summary = compactSummaryOf(event.compactionEntry);
		if (summary === undefined) return;
		const snapshot = snapshotFromCompactionSummary(summary, current);
		persist({ kind: "snapshot", origin: "compact", ...snapshot });
		current = snapshot;
		currentOrigin = "compact";
		renderWidget(ctx, snapshot, "compact");
	});

	pi.on("context", (event, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		if (!needsProjection(branch)) return;
		const snapshot = restoreLatestSnapshot(branch);
		if (!snapshot) return;
		return { messages: injectLedgerProjection(event.messages, snapshot, Date.now()) };
	});
}

function handleCommand(args: string, ctx: ExtensionCommandContext): void {
	const action = args.length === 0 ? "status" : args.split(/\s+/)[0];
	if (action === "clear") {
		clearLedger(ctx);
		return;
	}
	if (action === "history") {
		ctx.ui.notify(formatHistory(ctx.sessionManager.getBranch()), "info");
		return;
	}
	if (action === "status") {
		ctx.ui.notify(formatStatus(current), "info");
		return;
	}
	ctx.ui.notify("Usage: /work-ledger [status|history|clear]", "error");
}

function clearLedger(ctx: ExtensionCommandContext): void {
	if (!current) {
		ctx.ui.notify("No work ledger checkpoint", "info");
		return;
	}
	persist({ kind: "clear" });
	current = null;
	currentOrigin = null;
	renderWidget(ctx, null, null);
	ctx.ui.notify("Work ledger cleared", "info");
}

function persist(record: LedgerRecord): void {
	api?.appendEntry(WORK_LEDGER_ENTRY_TYPE, record);
}

export function shouldShowLedgerWidget(snapshot: WorkSnapshot | null): boolean {
	return snapshot !== null && snapshot.status !== "complete";
}

function applyRestoredRecord(
	ctx: ExtensionCommandContext | ExtensionContext,
	record: SnapshotRecord | null,
): void {
	current = record ? normalizeSnapshot(record) : null;
	currentOrigin = record?.origin ?? null;
	renderWidget(ctx, current, currentOrigin);
}

function renderWidget(
	ctx: ExtensionCommandContext | ExtensionContext,
	snapshot: WorkSnapshot | null,
	origin: SnapshotOrigin | null,
): void {
	const setSurfaceWidget = (
		id: string,
		value: string[] | undefined,
		_options?: { placement: "belowEditor" },
	): void => {
		if (value === undefined) {
			setOrderedSurfaceWidget(ctx.ui, id, undefined, "belowEditor");
			return;
		}
		setOrderedSurfaceWidget(
			ctx.ui,
			id,
			{
				priority: 100,
				active: snapshot?.status === "active",
				render: () => value,
			},
			"belowEditor",
		);
	};
	syncLedgerWidget(setSurfaceWidget, snapshot, origin);
}

export function syncLedgerWidget(
	setWidget: (id: string, value: string[] | undefined, options?: { placement: "belowEditor" }) => void,
	snapshot: WorkSnapshot | null,
	origin: SnapshotOrigin | null,
): void {
	if (!shouldShowLedgerWidget(snapshot)) {
		cancelCompactWidgetHide();
		setWidget("work-ledger", undefined);
		return;
	}
	setWidget(
		"work-ledger",
		[
			`work-ledger · ${snapshot.status} · ${clip(snapshot.phase, 40)}`,
			clip(snapshot.goal, 80),
			`${snapshot.done.length} done · ${snapshot.inProgress.length} in progress · ${snapshot.blocked.length} blocked`,
		],
		{ placement: LEDGER_WIDGET_PLACEMENT },
	);
	if (origin === "compact") {
		scheduleCompactWidgetHide(setWidget);
		return;
	}
	cancelCompactWidgetHide();
}

function scheduleCompactWidgetHide(
	setWidget: (id: string, value: string[] | undefined, options?: { placement: "belowEditor" }) => void,
): void {
	cancelCompactWidgetHide();
	compactHideHandle = scheduleDelay(() => {
		compactHideHandle = null;
		setWidget("work-ledger", undefined);
	}, COMPACT_WIDGET_HIDE_MS);
}

export function normalizeSnapshot(input: WorkCheckpointInput): WorkSnapshot {
	return {
		goal: clip(input.goal, MAX_TEXT_CHARS),
		phase: clip(input.phase, MAX_TEXT_CHARS),
		status: input.status,
		done: normalizeStringList(input.done),
		inProgress: normalizeStringList(input.inProgress),
		blocked: normalizeStringList(input.blocked),
		decisions: normalizeDecisions(input.decisions),
		artifacts: normalizeArtifacts(input.artifacts),
		nextSteps: normalizeStringList(input.nextSteps),
		evidence: normalizeStringList(input.evidence),
	};
}

type ParsedCompact = {
	goal: string;
	done: string[];
	inProgress: string[];
	blocked: string[];
	decisions: WorkDecision[];
	artifacts: WorkArtifact[];
	nextSteps: string[];
	evidence: string[];
};

export function snapshotFromCompactionSummary(
	summary: string,
	fallback: WorkSnapshot | null,
): WorkSnapshot {
	const parsed = parseCompactMarkdown(summary);
	const blocked = parsed.blocked.length > 0 ? parsed.blocked : (fallback?.blocked ?? []);
	return normalizeSnapshot({
		goal: usableText(parsed.goal) ?? fallback?.goal ?? DEFAULT_COMPACT_GOAL,
		phase: COMPACT_PHASE,
		status: blocked.length > 0 ? "blocked" : "active",
		done: firstNonEmpty(parsed.done, fallback?.done),
		inProgress: firstNonEmpty(parsed.inProgress, fallback?.inProgress),
		blocked,
		decisions: firstNonEmpty(parsed.decisions, fallback?.decisions),
		artifacts: firstNonEmpty(parsed.artifacts, fallback?.artifacts),
		nextSteps: firstNonEmpty(parsed.nextSteps, fallback?.nextSteps),
		evidence: firstNonEmpty(parsed.evidence, fallback?.evidence),
	});
}

export function parseCompactMarkdown(summary: string): ParsedCompact {
	const progress = markdownSection(summary, "##", "Progress");
	return {
		goal: firstContentLine(markdownSection(summary, "##", "Goal")),
		done: markdownBullets(markdownSection(progress, "###", "Done")),
		inProgress: markdownBullets(markdownSection(progress, "###", "In Progress")),
		blocked: markdownBullets(markdownSection(progress, "###", "Blocked")),
		decisions: markdownDecisions(markdownSection(summary, "##", "Key Decisions")),
		artifacts: [
			...pathsToArtifacts(xmlTag(summary, "modified-files"), "modified"),
			...pathsToArtifacts(xmlTag(summary, "read-files"), "read"),
		],
		nextSteps: markdownBullets(markdownSection(summary, "##", "Next Steps")),
		evidence: markdownBullets(markdownSection(summary, "##", "Critical Context")),
	};
}

export function parseLedgerRecord(data: unknown): LedgerRecord | null {
	if (!isRecord(data) || typeof data.kind !== "string") return null;
	if (data.kind === "clear") return { kind: "clear" };
	if (data.kind !== "snapshot") return null;
	const snapshot = parseSnapshot(data);
	if (!snapshot) return null;
	return { kind: "snapshot", origin: parseOrigin(data.origin), ...snapshot };
}

export function restoreLatestRecord(entries: readonly LedgerBranchEntry[]): SnapshotRecord | null {
	let found: SnapshotRecord | null = null;
	for (const entry of entries) {
		if (!isLedgerCustomEntry(entry)) continue;
		const record = parseLedgerRecord(entry.data);
		if (!record) continue;
		found = record.kind === "clear" ? null : { kind: "snapshot", origin: record.origin, ...normalizeSnapshot(record) };
	}
	return found;
}

export function restoreLatestSnapshot(entries: readonly LedgerBranchEntry[]): WorkSnapshot | null {
	const record = restoreLatestRecord(entries);
	return record ? normalizeSnapshot(record) : null;
}

export function collectLedgerHistory(entries: readonly LedgerBranchEntry[]): WorkSnapshot[] {
	const history: WorkSnapshot[] = [];
	for (const entry of entries) {
		if (!isLedgerCustomEntry(entry)) continue;
		const record = parseLedgerRecord(entry.data);
		if (!record || record.kind === "clear") continue;
		history.push(normalizeSnapshot(record));
	}
	return history;
}

export function needsProjection(entries: readonly LedgerBranchEntry[]): boolean {
	let lastSnapshot = -1;
	let lastClear = -1;
	let lastCompaction = -1;
	let latestOrigin: SnapshotOrigin = "checkpoint";
	for (const [index, entry] of entries.entries()) {
		if (entry.type === "compaction") {
			lastCompaction = index;
			continue;
		}
		if (!isLedgerCustomEntry(entry)) continue;
		const record = parseLedgerRecord(entry.data);
		if (!record) continue;
		if (record.kind === "clear") {
			lastClear = index;
			continue;
		}
		lastSnapshot = index;
		latestOrigin = record.origin;
	}
	if (lastSnapshot < 0) return false;
	if (lastClear > lastSnapshot) return false;
	if (lastCompaction < 0) return false;
	if (lastCompaction > lastSnapshot) return true;
	return latestOrigin === "compact";
}

export function formatLedgerProjection(snapshot: WorkSnapshot): string {
	const lines = [
		PROJECTION_MARKER,
		`goal: ${snapshot.goal}`,
		`phase: ${snapshot.phase}`,
		`status: ${snapshot.status}`,
		...section("done", snapshot.done),
		...section("inProgress", snapshot.inProgress),
		...section("blocked", snapshot.blocked),
		...section(
			"decisions",
			snapshot.decisions.map((item) => `${item.decision} — ${item.rationale}`),
		),
		...section(
			"artifacts",
			snapshot.artifacts.map((item) => `${item.path} — ${item.purpose}`),
		),
		...section("nextSteps", snapshot.nextSteps),
		...section("evidence", snapshot.evidence),
	];
	return lines.join("\n");
}

const PROJECTION_MESSAGE_TYPE = "work-ledger-projection";

export function isLedgerProjectionMessage(message: unknown): boolean {
	return (
		isRecord(message) &&
		message.role === "custom" &&
		message.customType === PROJECTION_MESSAGE_TYPE
	);
}

export function injectLedgerProjection(
	messages: readonly AgentMessage[],
	snapshot: WorkSnapshot,
	timestamp: number,
): AgentMessage[] {
	if (messages.some((message) => isLedgerProjectionMessage(message))) {
		return [...messages];
	}
	const injected = {
		role: "custom",
		customType: PROJECTION_MESSAGE_TYPE,
		content: formatLedgerProjection(snapshot),
		display: false,
		details: undefined,
		timestamp,
	} satisfies AgentMessage;
	const insertAt = latestUserMessageIndex(messages);
	if (insertAt < 0) {
		return [...messages, injected];
	}
	return [...messages.slice(0, insertAt), injected, ...messages.slice(insertAt)];
}

function latestUserMessageIndex(messages: readonly AgentMessage[]): number {
	for (let index = messages.length - 1; index >= 0; index--) {
		if (messages[index]?.role === "user") return index;
	}
	return -1;
}

export function formatStatus(snapshot: WorkSnapshot | null): string {
	if (!snapshot) return "No work ledger checkpoint";
	const blockedOn = snapshot.blocked[0] ? `\nBlocked on: ${snapshot.blocked[0]}` : "";
	const next = snapshot.nextSteps[0] ? `\nNext: ${snapshot.nextSteps[0]}` : "";
	return [
		`Work ledger (${snapshot.status})`,
		`Goal: ${snapshot.goal}`,
		`Phase: ${snapshot.phase}`,
		`Done: ${snapshot.done.length} · In progress: ${snapshot.inProgress.length} · Blocked: ${snapshot.blocked.length}`,
		blockedOn,
		next,
	]
		.filter(Boolean)
		.join("\n");
}

function formatHistory(entries: readonly SessionEntry[]): string {
	const history = collectLedgerHistory(entries);
	if (history.length === 0) return "No work ledger history";
	const cleared = restoreLatestSnapshot(entries) === null;
	const header = cleared ? "Ledger cleared. Previous checkpoints:" : "Work ledger history:";
	const lines = history.map(
		(snapshot, index) => `${index + 1}. ${snapshot.status} · ${snapshot.phase} — ${snapshot.goal}`,
	);
	return [header, ...lines].join("\n");
}

function parseSnapshot(data: Record<string, unknown>): WorkSnapshot | null {
	if (!isWorkStatus(data.status)) return null;
	if (typeof data.goal !== "string" || typeof data.phase !== "string") return null;
	if (
		!isStringArray(data.done) ||
		!isStringArray(data.inProgress) ||
		!isStringArray(data.blocked) ||
		!isStringArray(data.nextSteps) ||
		!isStringArray(data.evidence)
	) {
		return null;
	}
	if (!isDecisionArray(data.decisions) || !isArtifactArray(data.artifacts)) return null;
	return {
		goal: data.goal,
		phase: data.phase,
		status: data.status,
		done: data.done,
		inProgress: data.inProgress,
		blocked: data.blocked,
		decisions: data.decisions,
		artifacts: data.artifacts,
		nextSteps: data.nextSteps,
		evidence: data.evidence,
	};
}

function isLedgerCustomEntry(entry: LedgerBranchEntry): boolean {
	return entry.type === "custom" && entry.customType === WORK_LEDGER_ENTRY_TYPE;
}

function section(title: string, items: readonly string[]): string[] {
	if (items.length === 0) return [`${title}:`];
	return [`${title}:`, ...items.map((item) => `- ${item}`)];
}

function normalizeStringList(items: readonly string[]): string[] {
	const out: string[] = [];
	for (const item of items) {
		const next = clip(item, MAX_ITEM_CHARS);
		if (!next || out.length >= MAX_LIST_ITEMS) continue;
		out.push(next);
	}
	return out;
}

function normalizeDecisions(items: readonly WorkDecision[]): WorkDecision[] {
	const out: WorkDecision[] = [];
	for (const item of items) {
		const decision = clip(item.decision, MAX_ITEM_CHARS);
		const rationale = clip(item.rationale, MAX_ITEM_CHARS);
		if (!decision || !rationale || out.length >= MAX_LIST_ITEMS) continue;
		out.push({ decision, rationale });
	}
	return out;
}

function normalizeArtifacts(items: readonly WorkArtifact[]): WorkArtifact[] {
	const out: WorkArtifact[] = [];
	for (const item of items) {
		const path = clip(item.path, MAX_ITEM_CHARS);
		const purpose = clip(item.purpose, MAX_ITEM_CHARS);
		if (!path || !purpose || out.length >= MAX_LIST_ITEMS) continue;
		out.push({ path, purpose });
	}
	return out;
}

function clip(value: string, max: number): string {
	const trimmed = value.replace(/\s+/g, " ").trim();
	if (trimmed.length <= max) return trimmed;
	return trimmed.slice(0, max);
}

function parseOrigin(value: unknown): SnapshotOrigin {
	return value === "compact" ? "compact" : "checkpoint";
}

function compactSummaryOf(entry: unknown): string | undefined {
	if (!isRecord(entry) || typeof entry.summary !== "string") return undefined;
	const summary = entry.summary.trim();
	return summary.length > 0 ? summary : undefined;
}

function usableText(value: string): string | undefined {
	const trimmed = value.replace(/\s+/g, " ").trim();
	if (trimmed.length === 0) return undefined;
	if (/no prior history/i.test(trimmed)) return undefined;
	return trimmed;
}

function firstNonEmpty<T>(primary: readonly T[], fallback: readonly T[] | undefined): T[] {
	return primary.length > 0 ? [...primary] : [...(fallback ?? [])];
}

function markdownSection(text: string, mark: "##" | "###", heading: string): string {
	const re = new RegExp(`^${mark}\\s+${heading}\\s*$`, "im");
	const match = re.exec(text);
	if (!match) return "";
	const rest = text.slice(match.index + match[0].length);
	const next = new RegExp(`^${mark}\\s+`, "m").exec(rest);
	return (next ? rest.slice(0, next.index) : rest).trim();
}

function firstContentLine(text: string): string {
	for (const raw of text.split("\n")) {
		const line = raw.replace(/^[-*]\s+/, "").trim();
		if (line.length === 0 || line.startsWith("#") || line.startsWith("<")) continue;
		return line;
	}
	return "";
}

function markdownBullets(text: string): string[] {
	const items: string[] = [];
	for (const raw of text.split("\n")) {
		if (!/^\s*(?:[-*]|\d+[.)])\s+/.test(raw)) continue;
		const item = raw.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").replace(/^\[[^\]]*\]\s*/, "").trim();
		if (item.length > 0) items.push(item);
	}
	return items;
}

function markdownDecisions(text: string): WorkDecision[] {
	const decisions: WorkDecision[] = [];
	for (const item of markdownBullets(text)) {
		const bold = /^\*\*(.+?)\*\*\s*:?\s*(.*)$/.exec(item);
		const decision = (bold ? bold[1] : item.split(/\s*[—:]\s*/)[0])?.trim() ?? "";
		const rationale =
			(bold ? bold[2] : item.split(/\s*[—:]\s*/).slice(1).join(": ")).trim() || "compact summary";
		if (decision.length === 0) continue;
		decisions.push({ decision, rationale });
	}
	return decisions;
}

function xmlTag(text: string, tag: string): string {
	const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(text);
	return match?.[1]?.trim() ?? "";
}

function pathsToArtifacts(body: string, purpose: string): WorkArtifact[] {
	const artifacts: WorkArtifact[] = [];
	for (const raw of body.split("\n")) {
		const path = raw.trim();
		if (path.length > 0) artifacts.push({ path, purpose });
	}
	return artifacts;
}

function isWorkStatus(value: unknown): value is WorkStatus {
	return value === "active" || value === "blocked" || value === "complete";
}

function isDecisionArray(value: unknown): value is WorkDecision[] {
	return Array.isArray(value) && value.every(isDecision);
}

function isArtifactArray(value: unknown): value is WorkArtifact[] {
	return Array.isArray(value) && value.every(isArtifact);
}

function isDecision(value: unknown): value is WorkDecision {
	return isRecord(value) && typeof value.decision === "string" && typeof value.rationale === "string";
}

function isArtifact(value: unknown): value is WorkArtifact {
	return isRecord(value) && typeof value.path === "string" && typeof value.purpose === "string";
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
