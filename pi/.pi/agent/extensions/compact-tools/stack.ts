import { compactRowLine, type CompactRowView } from "./line.ts";
import { truncateTerminalLine } from "../ui/terminal-text.ts";

export const MAX_VISIBLE_STACK_CALLS = 6;
const MAX_TOOL_COLUMN_WIDTH = 12;
const STACK_STATE_SYMBOL = Symbol.for("pi.compact-tools.row-stack.state");

interface StackEntry {
	view: CompactRowView;
	invalidate: () => void;
}

interface CompactRowStackState {
	entries: Map<string, StackEntry>;
	groupById: Map<string, string[]>;
	stackableTools: Set<string>;
	activeGroup: string[] | undefined;
	seenCallIds: Set<string>;
	liveAssistant: boolean;
	liveTextBoundaryApplied: boolean;
}

function createCompactRowStackState(): CompactRowStackState {
	return {
		entries: new Map(),
		groupById: new Map(),
		stackableTools: new Set(),
		activeGroup: undefined,
		seenCallIds: new Set(),
		liveAssistant: false,
		liveTextBoundaryApplied: false,
	};
}

interface ToolCallBlock {
	type: "toolCall";
	id: string;
	name: string;
}

interface TextBlock {
	type: "text";
	text?: string;
}

type MessageBlock = ToolCallBlock | TextBlock | { type: string; [key: string]: unknown };

export interface StackMessage {
	role: string;
	content?: ReadonlyArray<MessageBlock> | string;
}

/**
 * Process-global coordinator because Pi loads extension entrypoints through
 * isolated jiti module graphs. It groups consecutive compact calls into one
 * self-rendered component, leaving Pi only one outer spacer for the stack.
 */
export class CompactRowStack {
	private readonly state: CompactRowStackState;

	constructor(state: CompactRowStackState = createCompactRowStackState()) {
		this.state = state;
	}

	private get entries(): Map<string, StackEntry> {
		return this.state.entries;
	}

	private get groupById(): Map<string, string[]> {
		return this.state.groupById;
	}

	private get stackableTools(): Set<string> {
		return this.state.stackableTools;
	}

	private get activeGroup(): string[] | undefined {
		return this.state.activeGroup;
	}

	private set activeGroup(value: string[] | undefined) {
		this.state.activeGroup = value;
	}

	private get seenCallIds(): Set<string> {
		return this.state.seenCallIds;
	}

	private get liveAssistant(): boolean {
		return this.state.liveAssistant;
	}

	private set liveAssistant(value: boolean) {
		this.state.liveAssistant = value;
	}

	private get liveTextBoundaryApplied(): boolean {
		return this.state.liveTextBoundaryApplied;
	}

	private set liveTextBoundaryApplied(value: boolean) {
		this.state.liveTextBoundaryApplied = value;
	}

	registerTool(tool: string, stackable: boolean): void {
		if (stackable) this.stackableTools.add(tool);
		else this.stackableTools.delete(tool);
	}

	clearRegisteredTools(): void {
		this.stackableTools.clear();
	}

	reset(): void {
		this.entries.clear();
		this.groupById.clear();
		this.activeGroup = undefined;
		this.seenCallIds.clear();
		this.liveAssistant = false;
		this.liveTextBoundaryApplied = false;
	}

	rebuild(messages: ReadonlyArray<StackMessage>): void {
		this.reset();
		for (const message of messages) this.consumeRestoredMessage(message);
	}

	beginMessage(message: StackMessage): void {
		if (message.role === "user") {
			this.breakGroup();
			this.liveAssistant = false;
			return;
		}
		if (message.role !== "assistant") return;
		this.liveAssistant = true;
		this.liveTextBoundaryApplied = false;
		this.consumeLiveAssistant(message);
	}

	updateMessage(message: StackMessage): void {
		if (message.role !== "assistant") return;
		if (!this.liveAssistant) {
			this.liveAssistant = true;
			this.liveTextBoundaryApplied = false;
		}
		this.consumeLiveAssistant(message);
	}

	endMessage(message: StackMessage): void {
		if (message.role === "assistant") this.updateMessage(message);
		if (message.role === "user") this.breakGroup();
		this.liveAssistant = false;
	}

	attach(id: string, view: CompactRowView, invalidate: () => void): void {
		const previous = this.entries.get(id);
		this.entries.set(id, { view, invalidate });
		if (!previous) this.invalidateGroup(id);
	}

	updateView(id: string, view: CompactRowView): void {
		const entry = this.entries.get(id);
		if (!entry) return;
		entry.view = view;
	}

	render(id: string, fallbackView: CompactRowView, width: number): string[] {
		if (fallbackView.expanded) return [compactRowLine(fallbackView, width, fallbackView.theme)];
		const group = this.groupById.get(id);
		if (!group || group.length < 2) {
			return [compactRowLine(fallbackView, width, fallbackView.theme)];
		}
		const visible = group
			.map((memberId) => ({ id: memberId, entry: this.entries.get(memberId) }))
			.filter((member): member is { id: string; entry: StackEntry } =>
				member.entry !== undefined && !member.entry.view.expanded,
			);
		if (visible.length < 2) return [compactRowLine(fallbackView, width, fallbackView.theme)];
		if (visible[visible.length - 1]?.id !== id) return [];

		const hidden = visible.slice(0, -MAX_VISIBLE_STACK_CALLS);
		const shown = visible.slice(-MAX_VISIBLE_STACK_CALLS);
		const toolWidth = Math.min(
			MAX_TOOL_COLUMN_WIDTH,
			Math.max(...shown.map(({ entry }) => entry.view.tool.length)),
		);
		const lines = shown.map(({ entry }, index) =>
			compactRowLine(entry.view, width, entry.view.theme, {
				tone: index === shown.length - 1 ? "normal" : "muted",
				connector: index === shown.length - 1 ? "last" : "middle",
				toolWidth,
			}),
		);
		if (hidden.length > 0) {
			lines.unshift(collapsedHistoryLine(hidden, width, fallbackView.theme));
		}
		return lines;
	}

	groups(): string[][] {
		return this.uniqueGroups().map((group) => [...group]);
	}

	private consumeRestoredMessage(message: StackMessage): void {
		if (message.role === "user") {
			this.breakGroup();
			return;
		}
		if (message.role !== "assistant") return;
		let textBoundaryApplied = false;
		for (const block of contentBlocks(message)) {
			if (isVisibleText(block)) {
				if (!textBoundaryApplied) this.breakGroup();
				textBoundaryApplied = true;
				continue;
			}
			this.consumeToolBlock(block);
		}
	}

	private consumeLiveAssistant(message: StackMessage): void {
		for (const block of contentBlocks(message)) {
			if (isVisibleText(block)) {
				if (!this.liveTextBoundaryApplied) this.breakGroup();
				this.liveTextBoundaryApplied = true;
				continue;
			}
			this.consumeToolBlock(block);
		}
	}

	private consumeToolBlock(block: MessageBlock): void {
		if (!isToolCall(block) || this.seenCallIds.has(block.id)) return;
		this.seenCallIds.add(block.id);
		if (!this.stackableTools.has(block.name)) {
			this.breakGroup();
			return;
		}
		const group = this.activeGroup ?? [];
		if (!this.activeGroup) this.activeGroup = group;
		group.push(block.id);
		this.groupById.set(block.id, group);
		for (const memberId of group) this.entries.get(memberId)?.invalidate();
	}

	private breakGroup(): void {
		this.activeGroup = undefined;
	}

	private invalidateGroup(id: string): void {
		const group = this.groupById.get(id);
		if (!group) return;
		for (const memberId of group) this.entries.get(memberId)?.invalidate();
	}

	private uniqueGroups(): string[][] {
		const groups: string[][] = [];
		const seen = new Set<string[]>();
		for (const group of this.groupById.values()) {
			if (seen.has(group)) continue;
			seen.add(group);
			groups.push(group);
		}
		return groups;
	}
}

function contentBlocks(message: StackMessage): ReadonlyArray<MessageBlock> {
	return Array.isArray(message.content) ? message.content : [];
}

function isVisibleText(block: MessageBlock): block is TextBlock {
	return block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0;
}

function isToolCall(block: MessageBlock): block is ToolCallBlock {
	return block.type === "toolCall" && typeof block.id === "string" && typeof block.name === "string";
}

function collapsedHistoryLine(
	hidden: Array<{ entry: StackEntry }>,
	width: number,
	theme: CompactRowView["theme"],
): string {
	const errors = hidden.filter(({ entry }) => entry.view.state.status === "error").length;
	let line = `${theme.fg("muted", "│")}  ${theme.fg("dim", `⋯ ${hidden.length} étapes précédentes`)}`;
	if (errors > 0) {
		line += ` ${theme.fg("error", `· ${errors} erreur${errors > 1 ? "s" : ""}`)}`;
	}
	return truncateTerminalLine(line, width, "…");
}

function isCompactRowStackState(value: unknown): value is CompactRowStackState {
	if (typeof value !== "object" || value === null) return false;
	const state = value as Partial<CompactRowStackState>;
	return (
		state.entries instanceof Map &&
		state.groupById instanceof Map &&
		state.stackableTools instanceof Set &&
		(state.activeGroup === undefined || Array.isArray(state.activeGroup)) &&
		state.seenCallIds instanceof Set &&
		typeof state.liveAssistant === "boolean" &&
		typeof state.liveTextBoundaryApplied === "boolean"
	);
}

interface GlobalWithCompactStackState {
	[key: symbol]: unknown;
}

function processSharedState(): CompactRowStackState {
	const globalScope = globalThis as unknown as GlobalWithCompactStackState;
	const current = globalScope[STACK_STATE_SYMBOL];
	if (isCompactRowStackState(current)) return current;
	const state = createCompactRowStackState();
	globalScope[STACK_STATE_SYMBOL] = state;
	return state;
}

// Every module graph gets the current implementation. Only inert data is
// process-global, so /reload never needs a manually versioned cache key.
export const compactRowStack = new CompactRowStack(processSharedState());
