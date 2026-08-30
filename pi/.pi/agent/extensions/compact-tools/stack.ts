import { compactRowLine, type CompactRowTone, type CompactRowView } from "./line.ts";

const STACK_TOOLS = new Set(["read", "grep", "find", "ls", "bash", "background"]);
const STACK_SYMBOL = Symbol.for("pi.compact-tools.row-stack.v1");

interface StackEntry {
	view: CompactRowView;
	invalidate: () => void;
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
	private readonly entries = new Map<string, StackEntry>();
	private readonly groupById = new Map<string, string[]>();
	private activeGroup: string[] | undefined;
	private readonly seenCallIds = new Set<string>();
	private liveAssistant = false;
	private liveTextBoundaryApplied = false;

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
		return visible.map(({ entry }, index) => {
			const distance = visible.length - index - 1;
			const tone: CompactRowTone = distance === 0 ? "normal" : distance === 1 ? "muted" : "dim";
			return compactRowLine(entry.view, width, entry.view.theme, tone, Math.min(distance, 2));
		});
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
		if (!STACK_TOOLS.has(block.name)) {
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

interface GlobalWithCompactStack {
	[STACK_SYMBOL]?: CompactRowStack;
}

const globalScope = globalThis as GlobalWithCompactStack;
export const compactRowStack = (globalScope[STACK_SYMBOL] ??= new CompactRowStack());
