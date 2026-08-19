/**
 * /goal — session-scoped completion loop (Claude-compatible).
 *
 * /goal <condition>  set (replaces) and start working
 * /goal              status
 * /goal clear        clear (aliases: stop, off, reset, none, cancel)
 *
 * After each settled turn a small independent model judges the condition
 * against the transcript. not_yet → auto-continue. met / impossible /
 * stuck → clear and return control.
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
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

const ENTRY_TYPE = "goal-state";
const MAX_CONDITION_CHARS = 4000;
const DEFAULT_MAX_TURNS = 25;
const STUCK_NO_TOOL_TURNS = 2;
const TRANSCRIPT_CHAR_BUDGET = 6000;
const CHROME_TICK_MS = 1_000;

const PREFERRED_EVALUATOR_IDS = ["deepseek-v4-flash", "grok-build", "k3"] as const;

const CLEAR_ALIASES = new Set(["clear", "stop", "off", "reset", "none", "cancel"]);

type GoalVerdict = "not_yet" | "met" | "impossible" | "stuck";

type GoalStatus = "active" | "met" | "impossible" | "cleared" | "stuck";

type GoalState = {
	condition: string;
	startedAt: string;
	turnsEvaluated: number;
	/** In-memory display counter (LLM rounds). Optional on restored entries. */
	turnsStarted?: number;
	noToolTurns: number;
	maxTurns: number;
	lastVerdict: GoalVerdict | null;
	lastReason: string;
	status: GoalStatus;
};

const EVALUATOR_SYSTEM = [
	"You evaluate whether a coding-agent session has met a user-stated goal.",
	"You have no tools. Judge only the transcript excerpt.",
	"Return ONLY JSON: {\"verdict\":\"met\"|\"not_yet\"|\"impossible\",\"reason\":\"...\"}",
	"met: the stated check is evidenced in the excerpt (command output, grep empty, etc.).",
	"not_yet: work remains or the proof is missing.",
	"impossible: the condition cannot be satisfied (missing access, contradiction, unfixable red lock).",
	"A claim without command/read-back evidence is not_yet, never met.",
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
			const next = createGoal(params.condition, !ctx.isIdle());
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

	pi.on("session_shutdown", async () => {
		stopChromeClock();
	});

	pi.on("turn_start", async (_event, ctx) => {
		if (!active || active.status !== "active") return;
		active = { ...active, turnsStarted: displayTurns(active) + 1 };
		renderChrome(ctx, active);
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

	const next = createGoal(args, !ctx.isIdle());
	persist(ctx, next);
	active = next;
	renderChrome(ctx, next);
	ctx.ui.notify(`Goal set: ${next.condition}`, "info");

	const host = api;
	if (!host) return;
	host.sendUserMessage(kickoffPrompt(next), { expandPromptTemplates: true });
}

function createGoal(condition: string, alreadyInTurn: boolean): GoalState {
	return {
		condition,
		startedAt: new Date().toISOString(),
		turnsEvaluated: 0,
		turnsStarted: alreadyInTurn ? 1 : 0,
		noToolTurns: 0,
		maxTurns: parseMaxTurns(condition),
		lastVerdict: null,
		lastReason: "",
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
	const noToolTurns = usedTools ? 0 : current.noToolTurns + 1;
	const turnsEvaluated = current.turnsEvaluated + 1;

	let verdict: GoalVerdict = "not_yet";
	let reason = "";

	if (turnsEvaluated >= current.maxTurns) {
		verdict = "stuck";
		reason = `Turn cap reached (${current.maxTurns}).`;
	} else if (noToolTurns >= STUCK_NO_TOOL_TURNS) {
		verdict = "stuck";
		reason = `No tool use for ${noToolTurns} turns — loop stopped, goal still set.`;
	} else {
		const judged = await judgeCondition(ctx, current.condition, excerpt.text);
		verdict = judged.verdict;
		reason = judged.reason;
	}

	const next: GoalState = {
		...current,
		turnsEvaluated,
		noToolTurns,
		lastVerdict: verdict,
		lastReason: reason,
		status: verdict === "not_yet" ? "active" : verdict,
	};
	persist(ctx, next);
	active = next;
	renderChrome(ctx, next);

	const host = api;
	if (!host) return;

	if (verdict === "not_yet") {
		ctx.ui.notify(`◎ goal not yet: ${reason}`, "info");
		host.sendUserMessage(continuePrompt(next), { deliverAs: "followUp" });
		return;
	}

	if (verdict === "stuck" && noToolTurns >= STUCK_NO_TOOL_TURNS) {
		next.status = "active";
		active = next;
		persist(ctx, next);
		renderChrome(ctx, next);
		ctx.ui.notify(`Goal paused: ${reason}`, "warning");
		return;
	}

	ctx.ui.notify(`Goal ${verdict}: ${reason}`, verdict === "met" ? "info" : "warning");
}

async function judgeCondition(
	ctx: ExtensionContext,
	condition: string,
	transcript: string,
): Promise<{ verdict: GoalVerdict; reason: string }> {
	const model = pickEvaluatorModel(ctx);
	if (!model) {
		return { verdict: "not_yet", reason: "No evaluator model; continuing." };
	}

	try {
		const reply = await ctx.modelRegistry.complete(model, {
			systemPrompt: EVALUATOR_SYSTEM,
			messages: [
				{
					role: "user",
					content: `Condition:\n${condition}\n\nTranscript excerpt:\n${transcript}`,
					timestamp: Date.now(),
				},
			],
		});
		return parseEvaluatorReply(reply);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "evaluator failed";
		return { verdict: "not_yet", reason: `${message}; continuing.` };
	}
}

function pickEvaluatorModel(ctx: ExtensionContext): Model | undefined {
	const available = ctx.modelRegistry.getAvailable();
	if (available.length === 0) return ctx.model;

	for (const needle of PREFERRED_EVALUATOR_IDS) {
		const hit = available.find((model) => model.id.includes(needle));
		if (hit) return hit;
	}

	const currentId = ctx.model?.id;
	const other = available.find((model) => model.id !== currentId);
	return other ?? ctx.model ?? available[0];
}

function parseEvaluatorReply(reply: AssistantMessage): { verdict: GoalVerdict; reason: string } {
	const text = assistantText(reply);
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return { verdict: "not_yet", reason: "Evaluator returned no JSON; continuing." };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonMatch[0]);
	} catch {
		return { verdict: "not_yet", reason: "Evaluator JSON parse failed; continuing." };
	}
	if (!isRecord(parsed)) {
		return { verdict: "not_yet", reason: "Evaluator JSON is not an object; continuing." };
	}

	const verdict = parsed.verdict;
	const reason = typeof parsed.reason === "string" ? parsed.reason : "";
	if (verdict === "met" || verdict === "not_yet" || verdict === "impossible") {
		return { verdict, reason: reason || verdict };
	}
	return { verdict: "not_yet", reason: reason || "Unknown evaluator verdict; continuing." };
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
			if (text) chunks.push(`TOOL ${message.toolName}:\n${text.slice(0, 800)}`);
		} else if (isUserMessage(message)) {
			const text = userText(message.content);
			if (text && !text.startsWith("Goal ")) chunks.push(`USER:\n${text.slice(0, 400)}`);
		}
	}

	let text = chunks.join("\n\n");
	if (text.length > TRANSCRIPT_CHAR_BUDGET) {
		text = text.slice(text.length - TRANSCRIPT_CHAR_BUDGET);
	}
	return { text, toolCallCount };
}

function restoreActiveGoal(entries: readonly SessionEntry[]): GoalState | null {
	let found: GoalState | null = null;
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
		const data = entry.data;
		if (!isGoalState(data)) continue;
		found = data;
	}
	if (!found || found.status !== "active") return null;
	return {
		...found,
		turnsStarted: found.turnsStarted || found.turnsEvaluated,
		noToolTurns: 0,
	};
}

function persist(ctx: ExtensionCommandContext | ExtensionContext, state: GoalState): void {
	if (!("sessionManager" in ctx)) return;
	const host = api;
	if (!host) return;
	host.appendEntry(ENTRY_TYPE, state);
}

function displayTurns(state: GoalState): number {
	return state.turnsStarted || state.turnsEvaluated;
}

function chromeLine(state: GoalState): string {
	return `◎ /goal active · ${formatElapsed(state.startedAt)} · ${displayTurns(state)} turns`;
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

function paintChrome(ui: ExtensionUIContext, state: GoalState): void {
	const line = chromeLine(state);
	ui.setWidget("goal", [
		line,
		truncate(state.condition, 80),
		state.lastReason ? `last: ${truncate(state.lastReason, 80)}` : "waiting for first evaluation",
	]);
}

function renderChrome(ctx: ExtensionCommandContext | ExtensionContext, state: GoalState | null): void {
	ctx.ui.setStatus("goal", undefined);
	if (!state || state.status !== "active") {
		stopChromeClock();
		ctx.ui.setWidget("goal", undefined);
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
		`Running ${elapsed}, ${displayTurns(state)} turns, ${state.turnsEvaluated} evaluated, cap ${state.maxTurns}`,
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
		`Tours: ${state.turnsEvaluated}/${state.maxTurns}.`,
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
	return isRecord(value) && value.role === "toolResult" && typeof value.toolName === "string";
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
