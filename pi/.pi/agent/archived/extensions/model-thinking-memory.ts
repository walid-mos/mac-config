/**
 * Remember the last chosen thinking level per provider/model.
 *
 * Pi keeps one global thinking level and clamps it on model switch. DeepSeek
 * only exposes high, so a free /model or Ctrl+P switch used to leave every
 * other model on high. This extension restores the last level for the exact
 * provider/model and persists it across restarts.
 *
 * Event order on switch:
 *   1. agent.state.model becomes the new model
 *   2. thinking_level_select may fire for the clamp (ctx.model is already new)
 *   3. model_select fires
 * Step 2 must not write the clamped level onto the new model. It may snapshot
 * previousLevel onto the old model. Restore runs on model_select.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const THINKING_LEVELS = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export type ThinkingMemoryCommand =
	| { type: "list" }
	| { type: "reset"; scope: "current" | "all" }
	| { type: "unknown"; args: string };

export type ThinkingLevelWrite = {
	modelKey: string;
	level: ThinkingLevel;
};

type PersistLevels = (levels: Record<string, ThinkingLevel>) => void;

type ThinkingMemoryOptions = {
	levels?: Record<string, ThinkingLevel>;
	persist?: PersistLevels;
};

export type ThinkingMemory = {
	noteThinkingLevel: (input: {
		currentModelKey: string | undefined;
		level: ThinkingLevel;
		previousLevel?: ThinkingLevel;
	}) => void;
	selectModel: (
		modelKey: string,
		currentLevel: ThinkingLevel,
		setLevel: (level: ThinkingLevel) => void,
	) => ThinkingLevel | undefined;
	reset: (modelKey: string) => boolean;
	resetAll: () => void;
	list: () => Record<string, ThinkingLevel>;
};

const STORE_VERSION = 1;

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
	return typeof value === "string" && THINKING_LEVELS.some((level) => level === value);
}

export function modelKey(provider: string, id: string): string {
	return `${provider}/${id}`;
}

export function modelKeyFrom(model: { provider: string; id: string } | undefined): string | undefined {
	if (!model) return undefined;
	return modelKey(model.provider, model.id);
}

export function defaultThinkingMemoryPath(): string {
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
	return join(agentDir, "model-thinking-memory.json");
}

export function parseThinkingMemoryFile(text: string): Record<string, ThinkingLevel> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return {};
	}
	return extractLevels(parsed);
}

export function loadThinkingMemoryFile(path: string): Record<string, ThinkingLevel> {
	try {
		return parseThinkingMemoryFile(readFileSync(path, "utf8"));
	} catch {
		return {};
	}
}

export function saveThinkingMemoryFile(path: string, levels: Record<string, ThinkingLevel>): void {
	const directory = dirname(path);
	if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
	const body = `${JSON.stringify({ version: STORE_VERSION, levels }, null, 2)}\n`;
	const tmpPath = `${path}.${process.pid}.tmp`;
	writeFileSync(tmpPath, body);
	try {
		renameSync(tmpPath, path);
	} catch {
		writeFileSync(path, body);
		try {
			unlinkSync(tmpPath);
		} catch {
			return;
		}
	}
}

export function parseThinkingMemoryCommand(args: string): ThinkingMemoryCommand {
	const trimmed = args.trim();
	if (trimmed === "") return { type: "list" };
	if (trimmed === "reset") return { type: "reset", scope: "current" };
	if (trimmed === "reset all") return { type: "reset", scope: "all" };
	return { type: "unknown", args: trimmed };
}

/**
 * Decide which model (if any) should receive a thinking-level write.
 *
 * Same model: user (or settings) changed thinking — persist `level`.
 * Different model: clamp during switch — snapshot `previousLevel` onto the
 * old model and never write the clamped `level` onto the new one.
 */
export function decideThinkingLevelWrite(input: {
	restoring: boolean;
	lastModelKey: string | undefined;
	currentModelKey: string | undefined;
	level: ThinkingLevel;
	previousLevel: ThinkingLevel | undefined;
}): ThinkingLevelWrite | undefined {
	if (input.restoring) return undefined;
	if (input.lastModelKey === undefined || input.currentModelKey === undefined) return undefined;
	if (input.currentModelKey === input.lastModelKey) {
		return { modelKey: input.currentModelKey, level: input.level };
	}
	if (input.previousLevel === undefined) return undefined;
	return { modelKey: input.lastModelKey, level: input.previousLevel };
}

export function createThinkingMemory(options: ThinkingMemoryOptions = {}): ThinkingMemory {
	let levels: Record<string, ThinkingLevel> = { ...(options.levels ?? {}) };
	let lastModelKey: string | undefined;
	let restoring = false;

	const writeLevel = (key: string, level: ThinkingLevel): void => {
		if (levels[key] === level) return;
		levels = { ...levels, [key]: level };
		options.persist?.(levels);
	};

	return {
		noteThinkingLevel(input) {
			const write = decideThinkingLevelWrite({
				restoring,
				lastModelKey,
				currentModelKey: input.currentModelKey,
				level: input.level,
				previousLevel: input.previousLevel,
			});
			if (!write) return;
			writeLevel(write.modelKey, write.level);
		},

		selectModel(nextModelKey, currentLevel, setLevel) {
			lastModelKey = nextModelKey;
			const stored = levels[nextModelKey];
			if (stored === undefined || stored === currentLevel) return undefined;
			restoring = true;
			try {
				setLevel(stored);
			} finally {
				restoring = false;
			}
			return stored;
		},

		reset(key) {
			if (levels[key] === undefined) return false;
			const next = { ...levels };
			delete next[key];
			levels = next;
			options.persist?.(levels);
			return true;
		},

		resetAll() {
			if (Object.keys(levels).length === 0) return;
			levels = {};
			options.persist?.(levels);
		},

		list() {
			return { ...levels };
		},
	};
}

function extractLevels(parsed: unknown): Record<string, ThinkingLevel> {
	if (typeof parsed !== "object" || parsed === null) return {};
	const container = "levels" in parsed ? parsed.levels : parsed;
	if (typeof container !== "object" || container === null) return {};
	const levels: Record<string, ThinkingLevel> = {};
	for (const [key, value] of Object.entries(container)) {
		if (!key.includes("/")) continue;
		if (!isThinkingLevel(value)) continue;
		levels[key] = value;
	}
	return levels;
}

function formatLevelList(
	levels: Record<string, ThinkingLevel>,
	currentKey: string | undefined,
): string {
	const entries = Object.entries(levels).sort(([left], [right]) => left.localeCompare(right));
	if (entries.length === 0) return "No per-model thinking levels remembered yet.";
	const lines = entries.map(([key, level]) => {
		const marker = key === currentKey ? " (current)" : "";
		return `  ${key}: ${level}${marker}`;
	});
	return `Remembered thinking levels:\n${lines.join("\n")}`;
}

function currentThinkingLevel(ctx: ExtensionContext): ThinkingLevel {
	return isThinkingLevel(ctx.thinkingLevel) ? ctx.thinkingLevel : "off";
}

export default function modelThinkingMemory(pi: ExtensionAPI): void {
	const storePath = defaultThinkingMemoryPath();
	const memory = createThinkingMemory({
		levels: loadThinkingMemoryFile(storePath),
		persist: (levels) => saveThinkingMemoryFile(storePath, levels),
	});

	const restoreFor = (ctx: ExtensionContext): void => {
		const key = modelKeyFrom(ctx.model);
		if (key === undefined) return;
		memory.selectModel(key, currentThinkingLevel(ctx), (level) => {
			pi.setThinkingLevel(level);
		});
	};

	pi.on("session_start", (_event, ctx) => {
		restoreFor(ctx);
	});

	pi.on("thinking_level_select", (event, ctx) => {
		if (!isThinkingLevel(event.level)) return;
		memory.noteThinkingLevel({
			currentModelKey: modelKeyFrom(ctx.model),
			level: event.level,
			previousLevel: isThinkingLevel(event.previousLevel) ? event.previousLevel : undefined,
		});
	});

	pi.on("model_select", (_event, ctx) => {
		restoreFor(ctx);
	});

	pi.registerCommand("thinking-memory", {
		description: "Show or reset per-model thinking levels",
		getArgumentCompletions: (prefix) => {
			const items = [
				{ value: "reset", label: "reset", description: "Forget the current model" },
				{ value: "reset all", label: "reset all", description: "Forget every model" },
			];
			const filtered = items.filter((item) => item.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const command = parseThinkingMemoryCommand(args);
			const currentKey = modelKeyFrom(ctx.model);
			if (command.type === "list") {
				ctx.ui.notify(formatLevelList(memory.list(), currentKey), "info");
				return;
			}
			if (command.type === "unknown") {
				ctx.ui.notify(
					"Usage: /thinking-memory | /thinking-memory reset | /thinking-memory reset all",
					"warning",
				);
				return;
			}
			if (command.scope === "all") {
				memory.resetAll();
				ctx.ui.notify("Cleared all remembered thinking levels.", "info");
				return;
			}
			if (currentKey === undefined) {
				ctx.ui.notify("No current model to reset.", "warning");
				return;
			}
			if (!memory.reset(currentKey)) {
				ctx.ui.notify(`No remembered thinking level for ${currentKey}.`, "info");
				return;
			}
			ctx.ui.notify(`Forgot thinking level for ${currentKey}.`, "info");
		},
	});
}
