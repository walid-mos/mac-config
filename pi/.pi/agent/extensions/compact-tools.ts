/**
 * Compact Tools — Ultra-flat, visually recessive rendering for built-in tools
 *
 * Built-in tools (read, bash, edit, write, grep, find, ls) are re-registered
 * with renderShell: "self" so they render as flat text lines — no Box, no
 * background, no padding.  The text is muted/dim by default, making the
 * assistant's final response visually dominant.
 *
 * Execution is delegated to the original built-in implementations (behavior
 * is unchanged).  Ctrl+O still expands to show an excerpt of the output.
 *
 * Collapsed (default):  muted header + dim status line  (error in red)
 * Expanded (ctrl+o):    excerpt of the output (~20 lines)
 *
 * Adapted from examples/extensions/minimal-mode.ts and
 * examples/extensions/built-in-tool-renderer.ts (pi-coding-agent package).
 */

import type {
	BashToolDetails,
	EditToolDetails,
	ExtensionAPI,
	FindToolDetails,
	GrepToolDetails,
	LsToolDetails,
	ReadToolDetails,
} from "@earendil-works/pi-coding-agent";
import {
	createBashTool,
	createEditTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadTool,
	createWriteTool,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { homedir } from "os";

const EXCERPT_LINES = 20;
const DIFF_EXCERPT_LINES = 30;
const MAX_COMMAND_LENGTH = 80;

function shortenPath(path: string): string {
	const home = homedir();
	return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

type ToolResult = {
	content: Array<{ type: string; text?: string }>;
	details?: unknown;
};

function textOf(result: ToolResult): string {
	const block = result.content.find((c) => c.type === "text");
	return block?.text ?? "";
}

function errorLine(result: ToolResult): string | null {
	const text = textOf(result);
	const first = text.split("\n").find((line) => line.trim().length > 0) ?? "";
	return /error/i.test(first) ? first : null;
}

function countLines(text: string): number {
	return text.trim().split("\n").filter(Boolean).length;
}

function excerpt(text: string, theme: { fg: (color: string, s: string) => string }, maxLines: number): string {
	const lines = text.trim().split("\n");
	const shown = lines.slice(0, maxLines).map((line) => theme.fg("dim", line));
	if (lines.length > maxLines) {
		shown.push(theme.fg("muted", `... ${lines.length - maxLines} more lines`));
	}
	return shown.join("\n");
}

function collapsedStatusLine(
	result: ToolResult,
	expanded: boolean,
	theme: { fg: (color: string, s: string) => string },
	meta: string,
	detail: string,
): Text {
	const error = errorLine(result);
	if (error) {
		const extra = expanded ? `\n${excerpt(textOf(result), theme, EXCERPT_LINES)}` : "";
		return new Text(`${theme.fg("error", "→")} ${theme.fg("error", error)}${extra}`, 0, 0);
	}
	const suffix = expanded ? `\n${detail}` : "";
	return new Text(`${theme.fg("muted", "→")} ${theme.fg("muted", meta)}${suffix}`, 0, 0);
}

// Built-in tool instances, cached per cwd
type BuiltInTools = ReturnType<typeof createBuiltInTools>;
const toolCache = new Map<string, BuiltInTools>();

function createBuiltInTools(cwd: string) {
	return {
		read: createReadTool(cwd),
		bash: createBashTool(cwd),
		edit: createEditTool(cwd),
		write: createWriteTool(cwd),
		grep: createGrepTool(cwd),
		find: createFindTool(cwd),
		ls: createLsTool(cwd),
	};
}

function builtIn(cwd: string): BuiltInTools {
	let tools = toolCache.get(cwd);
	if (!tools) {
		tools = createBuiltInTools(cwd);
		toolCache.set(cwd, tools);
	}
	return tools;
}

export default function (pi: ExtensionAPI): void {
	// =========================================================================
	// read
	// =========================================================================
	pi.registerTool({
		name: "read",
		label: "read",
		description: builtIn(process.cwd()).read.description,
		parameters: builtIn(process.cwd()).read.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			let text = `${theme.fg("muted", "read ")}${theme.fg("dim", shortenPath(args.path || "..."))}`;
			if (args.offset !== undefined || args.limit !== undefined) {
				const start = args.offset ?? 1;
				const end = args.limit !== undefined ? start + args.limit - 1 : "";
				text += theme.fg("muted", `:${start}${end ? `-${end}` : ""}`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("muted", "read …"), 0, 0);
			const details = result.details as ReadToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} lines`;
			if (details?.truncation?.truncated) meta += " (truncated)";
			return collapsedStatusLine(result, expanded, theme, meta, excerpt(text, theme, EXCERPT_LINES));
		},
	});

	// =========================================================================
	// bash
	// =========================================================================
	pi.registerTool({
		name: "bash",
		label: "bash",
		description: builtIn(process.cwd()).bash.description,
		parameters: builtIn(process.cwd()).bash.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).bash.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const command = truncate(args.command || "...", MAX_COMMAND_LENGTH);
			let text = `${theme.fg("muted", "$ ")}${theme.fg("dim", command)}`;
			if (args.timeout) text += theme.fg("muted", ` (timeout ${args.timeout}s)`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("muted", "bash …"), 0, 0);
			const details = result.details as BashToolDetails | undefined;
			const text = textOf(result);
			const exitMatch = text.match(/exit code: (\d+)/);
			const exitCode = exitMatch?.[1] !== undefined ? Number.parseInt(exitMatch[1], 10) : 0;

			if (exitCode !== 0) {
				const first = text.split("\n").find((line) => line.trim().length > 0) ?? "";
				let line = `${theme.fg("error", "→")} ${theme.fg("error", `exit ${exitCode}`)} ${theme.fg("dim", truncate(first, MAX_COMMAND_LENGTH))}`;
				if (expanded) line += `\n${excerpt(text, theme, EXCERPT_LINES)}`;
				return new Text(line, 0, 0);
			}

			let meta = `${countLines(text)} lines`;
			if (details?.truncation?.truncated) meta += " (truncated)";
			return collapsedStatusLine(result, expanded, theme, meta, excerpt(text, theme, EXCERPT_LINES));
		},
	});

	// =========================================================================
	// edit
	// =========================================================================
	pi.registerTool({
		name: "edit",
		label: "edit",
		description: builtIn(process.cwd()).edit.description,
		parameters: builtIn(process.cwd()).edit.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			return new Text(
				`${theme.fg("muted", "edit ")}${theme.fg("dim", shortenPath(args.path || "..."))}`,
				0,
				0,
			);
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("muted", "edit …"), 0, 0);
			const details = result.details as EditToolDetails | undefined;

			const error = errorLine(result);
			if (error) return new Text(`${theme.fg("error", "→")} ${theme.fg("error", error)}`, 0, 0);

			const diffLines = details?.diff.split("\n") ?? [];
			const additions = diffLines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
			const removals = diffLines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;

			let text = `${theme.fg("muted", "→")} ${theme.fg("success", `+${additions}`)}`;
			text += theme.fg("muted", " / ");
			text += theme.fg("error", `-${removals}`);

			if (expanded && details?.diff) {
				const shown = diffLines.slice(0, DIFF_EXCERPT_LINES).map((line) => {
					if (line.startsWith("+") && !line.startsWith("+++")) return theme.fg("success", line);
					if (line.startsWith("-") && !line.startsWith("---")) return theme.fg("error", line);
					return theme.fg("dim", line);
				});
				if (diffLines.length > DIFF_EXCERPT_LINES) {
					shown.push(theme.fg("muted", `... ${diffLines.length - DIFF_EXCERPT_LINES} more diff lines`));
				}
				text += `\n${shown.join("\n")}`;
			}

			return new Text(text, 0, 0);
		},
	});

	// =========================================================================
	// write
	// =========================================================================
	pi.registerTool({
		name: "write",
		label: "write",
		description: builtIn(process.cwd()).write.description,
		parameters: builtIn(process.cwd()).write.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const lines = args.content ? args.content.split("\n").length : 0;
			let text = `${theme.fg("muted", "write ")}${theme.fg("dim", shortenPath(args.path || "..."))}`;
			if (lines > 0) text += theme.fg("muted", ` (${lines} lines)`);
			return new Text(text, 0, 0);
		},

		renderResult(_result, _options, theme, _context) {
			return new Text(theme.fg("muted", "→ written"), 0, 0);
		},
	});

	// =========================================================================
	// grep
	// =========================================================================
	pi.registerTool({
		name: "grep",
		label: "grep",
		description: builtIn(process.cwd()).grep.description,
		parameters: builtIn(process.cwd()).grep.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).grep.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			let text = `${theme.fg("muted", "grep ")}${theme.fg("dim", `/${args.pattern || ""}/`)}`;
			text += theme.fg("muted", ` in ${shortenPath(args.path || ".")}`);
			if (args.glob) text += theme.fg("muted", ` (${args.glob})`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("muted", "grep …"), 0, 0);
			const details = result.details as GrepToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} matches`;
			if (details?.matchLimitReached) meta += ` (limit ${details.matchLimitReached})`;
			return collapsedStatusLine(result, expanded, theme, meta, excerpt(text, theme, EXCERPT_LINES));
		},
	});

	// =========================================================================
	// find
	// =========================================================================
	pi.registerTool({
		name: "find",
		label: "find",
		description: builtIn(process.cwd()).find.description,
		parameters: builtIn(process.cwd()).find.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).find.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			let text = `${theme.fg("muted", "find ")}${theme.fg("dim", args.pattern || "")}`;
			text += theme.fg("muted", ` in ${shortenPath(args.path || ".")}`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("muted", "find …"), 0, 0);
			const details = result.details as FindToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} files`;
			if (details?.resultLimitReached) meta += ` (limit ${details.resultLimitReached})`;
			return collapsedStatusLine(result, expanded, theme, meta, excerpt(text, theme, EXCERPT_LINES));
		},
	});

	// =========================================================================
	// ls
	// =========================================================================
	pi.registerTool({
		name: "ls",
		label: "ls",
		description: builtIn(process.cwd()).ls.description,
		parameters: builtIn(process.cwd()).ls.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).ls.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			return new Text(
				`${theme.fg("muted", "ls ")}${theme.fg("dim", shortenPath(args.path || "."))}`,
				0,
				0,
			);
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("muted", "ls …"), 0, 0);
			const details = result.details as LsToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} entries`;
			if (details?.entryLimitReached) meta += ` (limit ${details.entryLimitReached})`;
			return collapsedStatusLine(result, expanded, theme, meta, excerpt(text, theme, EXCERPT_LINES));
		},
	});
}