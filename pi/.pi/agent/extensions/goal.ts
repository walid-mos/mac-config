/**
 * /goal — session-scoped completion loop (Claude-compatible).
 *
 * /goal <condition>  set (replaces) and start working
 * /goal              status
 * /goal clear        clear (aliases: stop, off, reset, none, cancel)
 *
 * After each settled turn a small independent model judges the condition
 * against the transcript. Valid not_yet → auto-continue. met / impossible /
 * stuck → stop (stuck stays terminal). Evaluator failure retries once with
 * a fallback; two invalid replies → pause without auto-continuing.
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
	Api,
	AssistantMessage,
	Model,
	TextContent,
	ToolResultMessage,
	UserMessage,
} from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	ExtensionUIContext,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ABOVE_EDITOR_PRIORITY, setOrderedAboveEditorWidget } from "./ui/ordered-widget-stack.ts";
function pickPreferredModel<T extends { id: string }>(
    available: readonly T[], preferredIds: readonly string[],
): T | undefined {
    for (const needle of preferredIds) {
        const hit = available.find(model => model.id.includes(needle));
        if (hit) return hit;
    }
    return undefined;
}

const ENTRY_TYPE = "goal-state";
const MAX_CONDITION_CHARS = 4000;
const DEFAULT_MAX_TURNS = 25;
const STUCK_NO_TOOL_TURNS = 2;
const TRANSCRIPT_CHAR_BUDGET = 20_000;
const TOOL_RESULT_CHAR_BUDGET = 4_000;
const MAX_PROOF_ITEMS = 32;
const MAX_PROOF_ITEM_CHARS = 300;
const MAX_EVALUATOR_DIAGNOSTIC_CHARS = 500;
const MAX_EVALUATOR_MODEL_CHARS = 100;
const MAX_EVALUATOR_REASON_CHARS = 120;
const CHROME_TICK_MS = 1_000;
export const GOAL_WIDGET_PLACEMENT = "aboveEditor" as const;

const PREFERRED_EVALUATOR_IDS = ["deepseek-v4-flash", "grok-build", "k3"] as const;

const CLEAR_ALIASES = new Set(["clear", "stop", "off", "reset", "none", "cancel"]);

type GoalVerdict = "not_yet" | "met" | "impossible" | "stuck";

type EvaluatorVerdict = Exclude<GoalVerdict, "stuck">;

type GoalStatus = "active" | "met" | "impossible" | "cleared" | "stuck";

type ParsedEvaluatorReply =
	| {
			ok: true;
			verdict: EvaluatorVerdict;
			reason: string;
			proofs: string[];
			invalidatedProofs: string[];
	  }
	| { ok: false; reason: string };

type EvaluatorModelIdentity = {
	provider: string;
	id: string;
};

type GoalTurnCounters = {
	turnsEvaluated: number;
	noToolTurns: number;
};

type GoalLoopDecision =
	| { action: "continue"; reason: string; proofs: string[] }
	| { action: "pause"; reason: string }
	| { action: "stop"; verdict: Exclude<GoalVerdict, "not_yet">; reason: string; proofs?: string[] };

type GoalState = {
	condition: string;
	startedAt: string;
	/** Completed /goal cycles evaluated after the agent settles. */
	turnsEvaluated: number;
	noToolTurns: number;
	maxTurns: number;
	lastVerdict: GoalVerdict | null;
	lastReason: string;
	/** Cumulative command/read-back facts retained when older transcript evidence is clipped. */
	proofs?: string[];
	status: GoalStatus;
};

const EVALUATOR_SYSTEM = [
	"You evaluate whether a coding-agent session has met a user-stated goal.",
	"You have no tools. Judge the retained proof ledger plus the recent transcript excerpt.",
	"Ledger entries are command/read-back facts verified in earlier transcript windows.",
	"Return ONLY JSON: {\"verdict\":\"met\"|\"not_yet\"|\"impossible\",\"reason\":\"...\",\"proofs\":[\"new concise verified fact\"],\"invalidatedProofs\":[\"exact prior entry contradicted by newer evidence\"]}.",
	"met: every part of the condition is evidenced by the cumulative proofs or recent command/read-back output.",
	"not_yet: work remains or proof for any required part is missing.",
	"impossible: the condition cannot be satisfied (missing access, contradiction, unfixable red lock).",
	"A claim without command/read-back evidence is not_yet, never met and never a proof entry.",
].join(" ");

let active: GoalState | null = null;
let evaluating = false;
let api: ExtensionAPI | null = null;
let chromeUi: ExtensionUIContext | null = null;
let chromeClock: ReturnType<typeof setInterval> | null = null;

export default function goalExtension(pi: ExtensionAPI): void {
	api = pi;

	pi.registerCommand("goal", {
		description: "Keep working toward a verifiable condition until it holds",
		getArgumentCompletions: (prefix: string) => {
			const options = ["clear", "status"];
			const hits = options.filter((item) => item.startsWith(prefix));
			if (hits.length === 0) return null;
			return hits.map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => {
			handleCommand(args.trim(), ctx);
		},
	});

	pi.registerTool({
		name: "goal_set",
		label: "Goal Set",
		description: "Set (or replace) the active /goal condition so the extension auto-continues across turns. Call at the start of /ship, /stack, /accor-ship to engage the auto-continue loop.",
		promptSnippet: "Set a goal condition for auto-continue across turns",
		promptGuidelines: [
			"Use goal_set at the start of /ship, /stack, /accor-ship to engage the auto-continue loop; the condition must be provable from command outputs, not declarations.",
		],
		parameters: Type.Object({
			condition: Type.String({ minLength: 1, maxLength: MAX_CONDITION_CHARS, description: "Verifiable condition for the auto-continue loop" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const next = createGoal(params.condition);
			persist(ctx, next);
			active = next;
			renderChrome(ctx, next);
			ctx.ui.notify(`Goal set: ${next.condition}`, "info");
			return {
				content: [{ type: "text", text: `Goal set: ${params.condition}` }],
			};
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		active = restoreActiveGoal(ctx.sessionManager.getEntries());
		renderChrome(ctx, active);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopChromeClock();
		setOrderedAboveEditorWidget(ctx.ui, "goal", undefined);
		chromeUi = null;
	});

	pi.on("agent_settled", async (_event, ctx) => {
		if (!active || active.status !== "active" || evaluating) return;
		evaluating = true;
		try {
			await evaluateAndContinue(ctx);
		} finally {
			evaluating = false;
		}
	});
}

function handleCommand(args: string, ctx: ExtensionCommandContext): void {
	if (args.length === 0 || args === "status") {
		ctx.ui.notify(formatStatus(active), "info");
		return;
	}
	if (CLEAR_ALIASES.has(args.split(/\s+/)[0] ?? "")) {
		if (!active || active.status !== "active") {
			ctx.ui.notify("No goal set", "info");
			return;
		}
		clearGoal(ctx, "cleared");
		ctx.ui.notify("Goal cleared", "info");
		return;
	}
	if (args.length > MAX_CONDITION_CHARS) {
		ctx.ui.notify(`Condition too long (${args.length} > ${MAX_CONDITION_CHARS})`, "error");
		return;
	}

	const next = createGoal(args);
	persist(ctx, next);
	active = next;
	renderChrome(ctx, next);
	ctx.ui.notify(`Goal set: ${next.condition}`, "info");

	const host = api;
	if (!host) return;
	host.sendUserMessage(kickoffPrompt(next), { expandPromptTemplates: true });
}

function createGoal(condition: string): GoalState {
	return {
		condition,
		startedAt: new Date().toISOString(),
		turnsEvaluated: 0,
		noToolTurns: 0,
		maxTurns: parseMaxTurns(condition),
		lastVerdict: null,
		lastReason: "",
		proofs: [],
		status: "active",
	};
}

function parseMaxTurns(condition: string): number {
	const match = condition.match(/stop after (\d+) turns/i);
	if (!match) return DEFAULT_MAX_TURNS;
	const parsed = Number(match[1]);
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_TURNS;
	return Math.min(parsed, 100);
}

export function isTurnCapReached(turnsEvaluated: number, maxTurns: number): boolean {
	return turnsEvaluated >= maxTurns;
}

function clearGoal(ctx: ExtensionCommandContext | ExtensionContext, status: GoalStatus): void {
	if (!active) return;
	const closed: GoalState = { ...active, status };
	persist(ctx, closed);
	active = status === "cleared" ? null : closed;
	renderChrome(ctx, active);
}

async function evaluateAndContinue(ctx: ExtensionContext): Promise<void> {
	const current = active;
	if (!current || current.status !== "active") return;

	const excerpt = collectTranscriptExcerpt(ctx.sessionManager.getBranch());
	const usedTools = excerpt.toolCallCount > 0;
	const counters: GoalTurnCounters = {
		turnsEvaluated: current.turnsEvaluated + 1,
		noToolTurns: usedTools ? 0 : current.noToolTurns + 1,
	};
	const decision = await decideGoalLoop(ctx, current, excerpt.text, counters);
	if (active !== current) return;
	const next = nextGoalState(current, counters, decision);
	persist(ctx, next);
	active = next;
	renderChrome(ctx, next);
	enactGoalDecision(ctx, next, decision);
}

async function decideGoalLoop(
	ctx: ExtensionContext,
	current: GoalState,
	transcript: string,
	counters: GoalTurnCounters,
): Promise<GoalLoopDecision> {
	const judged = await judgeCondition(ctx, current.condition, transcript, current.proofs ?? []);
	return decideEvaluatedGoal(current, counters, judged);
}

export function decideEvaluatedGoal(
	current: GoalState,
	counters: GoalTurnCounters,
	judged: ParsedEvaluatorReply,
): GoalLoopDecision {
	if (!judged.ok) return { action: "pause", reason: judged.reason };
	const proofs = updateProofLedger(current.proofs ?? [], judged.proofs, judged.invalidatedProofs);
	if (judged.verdict === "met" && proofs.length === 0) {
		return { action: "pause", reason: "Evaluator returned met without verified proofs." };
	}
	if (judged.verdict !== "not_yet") {
		return { action: "stop", verdict: judged.verdict, reason: judged.reason, proofs };
	}
	if (isTurnCapReached(counters.turnsEvaluated, current.maxTurns)) {
		return {
			action: "stop",
			verdict: "stuck",
			reason: `Turn cap reached (${current.maxTurns}).`,
			proofs,
		};
	}
	if (counters.noToolTurns >= STUCK_NO_TOOL_TURNS) {
		return {
			action: "stop",
			verdict: "stuck",
			reason: `No tool use for ${counters.noToolTurns} turns — loop stopped, goal still set.`,
			proofs,
		};
	}
	return { action: "continue", reason: judged.reason, proofs };
}

function nextGoalState(
	current: GoalState,
	counters: GoalTurnCounters,
	decision: GoalLoopDecision,
): GoalState {
	if (decision.action === "pause") {
		return { ...current, ...counters, lastReason: decision.reason };
	}
	if (decision.action === "continue") {
		return {
			...current,
			...counters,
			lastVerdict: "not_yet",
			lastReason: decision.reason,
			proofs: decision.proofs,
			status: "active",
		};
	}
	return {
		...current,
		...counters,
		lastVerdict: decision.verdict,
		lastReason: decision.reason,
		proofs: decision.proofs ?? current.proofs,
		status: decision.verdict,
	};
}

function enactGoalDecision(
	ctx: ExtensionContext,
	next: GoalState,
	decision: GoalLoopDecision,
): void {
	const host = api;
	if (!host) return;

	if (decision.action === "continue") {
		ctx.ui.notify(`◎ goal not yet: ${decision.reason}`, "info");
		host.sendUserMessage(continuePrompt(next), { deliverAs: "followUp" });
		return;
	}
	if (decision.action === "pause") {
		ctx.ui.notify(`Goal paused: ${decision.reason}`, "warning");
		return;
	}
	ctx.ui.notify(
		`Goal ${decision.verdict}: ${decision.reason}`,
		decision.verdict === "met" ? "info" : "warning",
	);
}

async function judgeCondition(
	ctx: ExtensionContext,
	condition: string,
	transcript: string,
	proofs: readonly string[],
): Promise<ParsedEvaluatorReply> {
	const models = pickEvaluatorModels(ctx);
	if (models.length === 0) {
		return { ok: false, reason: "No evaluator model." };
	}

	const evaluatorContext = {
		systemPrompt: EVALUATOR_SYSTEM,
		messages: [
			{
				role: "user" as const,
				content: [
					`Condition:\n${condition}`,
					`Retained proof ledger:\n${formatProofLedger(proofs)}`,
					`Recent transcript excerpt:\n${transcript}`,
				].join("\n\n"),
				timestamp: Date.now(),
			},
		],
	};

	return evaluateWithFallback(models, async (model) => {
		// complete() takes ApiStreamOptions; SimpleStreamOptions.reasoning is only on completeSimple, which ModelRegistry does not expose.
		const reply = await ctx.modelRegistry.complete(model, evaluatorContext);
		return parseEvaluatorReply(reply);
	});
}

function pickEvaluatorModels(ctx: ExtensionContext): Model<Api>[] {
	const available = ctx.modelRegistry.getAvailable();
	const selected = undefined;
	return selectEvaluatorAttempts(available, selected, ctx.model);
}

export function selectEvaluatorAttempts<T extends EvaluatorModelIdentity>(
	available: readonly T[],
	selected: T | undefined,
	current: T | undefined,
): T[] {
	const candidates = available.length > 0 ? available : current ? [current] : [];
	const primary =
		selected ??
		pickPreferredModel(candidates, PREFERRED_EVALUATOR_IDS) ??
		candidates.find((model) => !isSameModel(model, current)) ??
		current ??
		candidates[0];
	if (!primary) return [];

	const alternatives = candidates.filter((model) => !isSameModel(model, primary));
	const fallback =
		(current && !isSameModel(current, primary) ? current : undefined) ??
		pickPreferredModel(alternatives, PREFERRED_EVALUATOR_IDS) ??
		alternatives[0] ??
		primary;
	return [primary, fallback];
}

export async function evaluateWithFallback<T extends EvaluatorModelIdentity>(
	models: readonly T[],
	evaluate: (model: T) => Promise<ParsedEvaluatorReply>,
): Promise<ParsedEvaluatorReply> {
	const failures: string[] = [];
	for (const [index, model] of models.slice(0, 2).entries()) {
		try {
			const result = await evaluate(model);
			if (result.ok) return result;
			failures.push(formatEvaluatorFailure(index, model, result.reason));
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : "evaluator failed";
			failures.push(formatEvaluatorFailure(index, model, reason));
		}
	}
	return {
		ok: false,
		reason: truncate(
			`Evaluator attempts failed: ${failures.join("; ") || "no evaluator model"}`,
			MAX_EVALUATOR_DIAGNOSTIC_CHARS,
		),
	};
}

function formatEvaluatorFailure(
	index: number,
	model: EvaluatorModelIdentity,
	reason: string,
): string {
	const identity = normalizeDiagnostic(`${model.provider}/${model.id}`, MAX_EVALUATOR_MODEL_CHARS);
	return `#${index + 1} ${identity}: ${normalizeDiagnostic(reason, MAX_EVALUATOR_REASON_CHARS)}`;
}

function normalizeDiagnostic(value: string, max: number): string {
	return truncate(value.replace(/\s+/g, " ").trim() || "unknown", max);
}

function isSameModel(
	left: EvaluatorModelIdentity,
	right: EvaluatorModelIdentity | undefined,
): boolean {
	return right !== undefined && left.provider === right.provider && left.id === right.id;
}

function parseEvaluatorReply(reply: AssistantMessage): ParsedEvaluatorReply {
	const parsed = parseEvaluatorText(assistantText(reply));
	if (parsed.ok) return parsed;
	const contentTypes = [...new Set(reply.content.map((part) => part.type))].join(",") || "none";
	const stopReason = reply.stopReason ?? "unknown";
	return {
		ok: false,
		reason: `${parsed.reason} content=${contentTypes}, stop=${stopReason}`,
	};
}

export function parseEvaluatorText(text: string): ParsedEvaluatorReply {
	const jsonText = extractJsonObject(text);
	if (!jsonText) {
		return { ok: false, reason: "Evaluator returned no JSON." };
	}
	const parsed = parseJsonValue(jsonText);
	if (!parsed.ok) {
		return { ok: false, reason: "Evaluator JSON parse failed." };
	}
	return parseEvaluatorPayload(parsed.value);
}

function extractJsonObject(text: string): string | null {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	return jsonMatch ? jsonMatch[0] : null;
}

function parseJsonValue(text: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

function parseEvaluatorPayload(value: unknown): ParsedEvaluatorReply {
	if (!isRecord(value)) {
		return { ok: false, reason: "Evaluator JSON is not an object." };
	}
	const reason = typeof value.reason === "string" ? value.reason : "";
	if (!isEvaluatorVerdict(value.verdict)) {
		return { ok: false, reason: reason || "Unknown evaluator verdict." };
	}
	if (!isStringArray(value.proofs) || !isStringArray(value.invalidatedProofs)) {
		return { ok: false, reason: "Evaluator proof updates are missing or invalid." };
	}
	return {
		ok: true,
		verdict: value.verdict,
		reason: reason || value.verdict,
		proofs: normalizeProofs(value.proofs),
		invalidatedProofs: normalizeProofs(value.invalidatedProofs),
	};
}

function normalizeProofs(proofs: readonly string[]): string[] {
	const unique: string[] = [];
	for (const proof of proofs) {
		const normalized = truncate(proof.replace(/\s+/g, " ").trim(), MAX_PROOF_ITEM_CHARS);
		if (!normalized) continue;
		const previous = unique.indexOf(normalized);
		if (previous >= 0) unique.splice(previous, 1);
		unique.push(normalized);
	}
	return unique.slice(-MAX_PROOF_ITEMS);
}

export function updateProofLedger(
	current: readonly string[],
	added: readonly string[],
	invalidated: readonly string[],
): string[] {
	const removed = new Set(normalizeProofs(invalidated));
	return normalizeProofs([...current.filter((proof) => !removed.has(proof)), ...added]);
}

function formatProofLedger(proofs: readonly string[]): string {
	if (proofs.length === 0) return "(empty)";
	return proofs.map((proof) => `- ${proof}`).join("\n");
}

function isEvaluatorVerdict(value: unknown): value is EvaluatorVerdict {
	return value === "met" || value === "not_yet" || value === "impossible";
}

function collectTranscriptExcerpt(branch: readonly SessionEntry[]): {
	text: string;
	toolCallCount: number;
} {
	const chunks: string[] = [];
	let toolCallCount = 0;

	for (const entry of branch.slice(-30)) {
		if (entry.type !== "message") continue;
		const message = entry.message;

		if (isAssistantMessage(message)) {
			const text = assistantText(message);
			if (text) chunks.push(`ASSISTANT:\n${text}`);
			toolCallCount += message.content.filter((part) => part.type === "toolCall").length;
		} else if (isToolResultMessage(message)) {
			const text = textParts(message.content)
				.map((part) => part.text)
				.join("\n");
			if (text) chunks.push(`TOOL ${message.toolName}:\n${clipTail(text, TOOL_RESULT_CHAR_BUDGET)}`);
		} else if (isUserMessage(message)) {
			const text = userText(message.content);
			if (text && !text.startsWith("Goal ")) chunks.push(`USER:\n${text.slice(0, 400)}`);
		}
	}

	const text = clipTail(chunks.join("\n\n"), TRANSCRIPT_CHAR_BUDGET);
	return { text, toolCallCount };
}

function restoreActiveGoal(entries: readonly SessionEntry[]): GoalState | null {
	let found: unknown = null;
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
		if (!isGoalState(entry.data)) continue;
		found = entry.data;
	}
	return restoreGoalState(found);
}

export function restoreGoalState(value: unknown): GoalState | null {
	if (!isGoalState(value)) return null;
	const falseLegacyCap = isFalseLegacyTurnCap(value);
	if (value.status !== "active" && !falseLegacyCap) return null;
	return {
		condition: value.condition,
		startedAt: value.startedAt,
		turnsEvaluated: value.turnsEvaluated,
		noToolTurns: 0,
		maxTurns: value.maxTurns,
		lastVerdict: falseLegacyCap ? "not_yet" : value.lastVerdict,
		lastReason: falseLegacyCap
			? "Restored after correcting legacy turn-cap counting."
			: value.lastReason,
		proofs: isStringArray(value.proofs) ? normalizeProofs(value.proofs) : [],
		status: "active",
	};
}

function isFalseLegacyTurnCap(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return (
		value.status === "stuck" &&
		typeof value.turnsStarted === "number" &&
		typeof value.turnsEvaluated === "number" &&
		value.turnsStarted > value.turnsEvaluated &&
		typeof value.lastReason === "string" &&
		/^Turn cap reached \(\d+\)\.$/.test(value.lastReason)
	);
}

function persist(ctx: ExtensionCommandContext | ExtensionContext, state: GoalState): void {
	if (!("sessionManager" in ctx)) return;
	const host = api;
	if (!host) return;
	host.appendEntry(ENTRY_TYPE, state);
}

function chromeLine(state: GoalState): string {
	return `◎ /goal active · ${formatElapsed(state.startedAt)} · ${state.turnsEvaluated} turns`;
}

function stopChromeClock(): void {
	if (!chromeClock) return;
	clearInterval(chromeClock);
	chromeClock = null;
}

function startChromeClock(): void {
	if (chromeClock) return;
	chromeClock = setInterval(() => {
		if (!active || active.status !== "active" || !chromeUi) {
			stopChromeClock();
			return;
		}
		try {
			paintChrome(chromeUi, active);
		} catch {
			stopChromeClock();
			chromeUi = null;
		}
	}, CHROME_TICK_MS);
	chromeClock.unref?.();
}

export function goalChromeLines(state: GoalState, width: number): string[] {
	return [
		chromeLine(state),
		truncate(state.condition, 80),
		state.lastReason ? `last: ${truncate(state.lastReason, 80)}` : "waiting for first evaluation",
	].map((line) => truncate(line, Math.max(1, width)));
}

export function paintChrome(ui: ExtensionUIContext, state: GoalState): void {
	setOrderedAboveEditorWidget(ui, "goal", {
		priority: ABOVE_EDITOR_PRIORITY.goal,
		active: state.status === "active",
		render: (width) => goalChromeLines(state, width),
	});
}

function renderChrome(ctx: ExtensionCommandContext | ExtensionContext, state: GoalState | null): void {
	ctx.ui.setStatus("goal", undefined);
	if (!state || state.status !== "active") {
		stopChromeClock();
		setOrderedAboveEditorWidget(ctx.ui, "goal", undefined);
		chromeUi = null;
		return;
	}
	chromeUi = ctx.ui;
	paintChrome(ctx.ui, state);
	startChromeClock();
}

function formatStatus(state: GoalState | null): string {
	if (!state) return "No goal set";
	const elapsed = formatElapsed(state.startedAt);
	const reason = state.lastReason ? `\nLast: ${state.lastReason}` : "";
	return [
		`Goal (${state.status}): ${state.condition}`,
		`Running ${elapsed}, ${state.turnsEvaluated} evaluated turns, cap ${state.maxTurns}`,
		reason,
	]
		.filter(Boolean)
		.join("\n");
}

function kickoffPrompt(state: GoalState): string {
	return [
		"/skill:goal",
		"",
		`Goal actif: ${state.condition}`,
		"",
		"Travaille jusqu'à ce que la condition soit prouvée dans le transcript.",
		"Ne demande rien. Un step vérifiable par tour. Si c'est un livrable de code: /stack (hors Plane) ou /ship (Plane).",
	].join("\n");
}

function continuePrompt(state: GoalState): string {
	return [
		`Goal toujours actif: ${state.condition}`,
		`Dernier verdict: not_yet — ${state.lastReason}`,
		`Tours évalués: ${state.turnsEvaluated}/${state.maxTurns}.`,
		"Continue. Ne demande rien. Prouve la condition par une sortie de commande.",
	].join("\n");
}

function formatElapsed(startedAt: string): string {
	const start = Date.parse(startedAt);
	if (!Number.isFinite(start)) return "?";
	const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h${minutes % 60}m`;
}

function truncate(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}

function clipTail(value: string, max: number): string {
	if (value.length <= max) return value;
	return value.slice(value.length - max);
}

function assistantText(message: AssistantMessage): string {
	return message.content
		.filter((part): part is TextContent => part.type === "text")
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function textParts(content: ReadonlyArray<{ type: string }>): TextContent[] {
	return content.filter((part): part is TextContent => part.type === "text");
}

function userText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is TextContent => isRecord(part) && part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n");
}

function isAssistantMessage(value: AgentMessage): value is AssistantMessage {
	return isRecord(value) && value.role === "assistant" && Array.isArray(value.content);
}

function isToolResultMessage(value: AgentMessage): value is ToolResultMessage {
	return (
		isRecord(value) &&
		value.role === "toolResult" &&
		typeof value.toolName === "string" &&
		Array.isArray(value.content)
	);
}

function isUserMessage(value: AgentMessage): value is UserMessage {
	return isRecord(value) && value.role === "user";
}

function isGoalState(value: unknown): value is GoalState {
	if (!isRecord(value)) return false;
	return (
		typeof value.condition === "string" &&
		typeof value.startedAt === "string" &&
		typeof value.turnsEvaluated === "number" &&
		typeof value.noToolTurns === "number" &&
		typeof value.maxTurns === "number" &&
		typeof value.status === "string"
	);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
