/**
 * Compact Tools — Ultra-flat, visually recessive rendering for built-in tools
 *
 * Built-in tools (read, bash, edit, write, grep, find, ls) are re-registered
 * with renderShell: "self" so they render as flat text lines — no Box, no
 * background, no padding.  The text is muted/dim by default, making the
 * assistant's final response visually dominant.
 *
 * Execution is delegated to the original built-in implementations (behavior
 * is unchanged).  app.tools.expand (ctrl+shift+` here) still expands excerpts.
 *
 * Collapsed (default):  one muted line `name target · meta` (error in red)
 * Expanded:             call header + excerpt of the output (~20 lines)
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
	createEditTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadTool,
	createBashTool,
	createWriteTool,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { homedir } from "os";
import {
	bashHeader,
	compactPath,
	editHeader,
	findHeader,
	grepHeader,
	joinCollapsed,
	lsHeader,
	readHeader,
	showCallLine,
	truncate,
	writeHeader,
	type CompactToolArgs,
} from "./compact-tools/format.ts";

const EXCERPT_LINES = 20;
const DIFF_EXCERPT_LINES = 30;

function shortenPath(path: string): string {
	const home = homedir();
	const shortened = path.startsWith(home) ? `~${path.slice(home.length)}` : path;
	return compactPath(shortened);
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
	header: string,
	meta: string,
	detail: string,
): Text {
	const error = errorLine(result);
	if (error) {
		if (expanded) {
			return new Text(
				`${theme.fg("error", error)}\n${excerpt(textOf(result), theme, EXCERPT_LINES)}`,
				0,
				0,
			);
		}
		return new Text(theme.fg("error", joinCollapsed(header, error)), 0, 0);
	}
	if (expanded) {
		return new Text(`${theme.fg("muted", meta)}\n${detail}`, 0, 0);
	}
	return new Text(theme.fg("muted", joinCollapsed(header, meta)), 0, 0);
}

function toolArgs(context: { args?: CompactToolArgs }): CompactToolArgs {
	return context.args ?? {};
}

function renderCallLine(
	header: string,
	theme: { fg: (color: string, text: string) => string },
	context: { expanded: boolean; isPartial: boolean; state: Record<string, unknown> },
): Text {
	context.state.compactSpacing = true;
	return new Text(showCallLine(context) ? theme.fg("muted", header) : "", 0, 0);
}

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
	pi.registerTool({
		name: "read",
		label: "read",
		description: builtIn(process.cwd()).read.description,
		parameters: builtIn(process.cwd()).read.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(readHeader(args, shortenPath), theme, context);
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text("", 0, 0);
			const details = result.details as ReadToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} lines`;
			if (details?.truncation?.truncated) meta += " (truncated)";
			return collapsedStatusLine(
				result,
				expanded,
				theme,
				readHeader(toolArgs(context), shortenPath),
				meta,
				excerpt(text, theme, EXCERPT_LINES),
			);
		},
	});

	pi.registerTool({
		name: "bash",
		label: "bash",
		description: builtIn(process.cwd()).bash.description,
		parameters: builtIn(process.cwd()).bash.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).bash.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(bashHeader(args), theme, context);
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text("", 0, 0);
			const details = result.details as BashToolDetails | undefined;
			const text = textOf(result);
			const header = bashHeader(toolArgs(context));
			const exitMatch = text.match(/exit code: (\d+)/);
			const exitCode = exitMatch?.[1] !== undefined ? Number.parseInt(exitMatch[1], 10) : 0;

			if (exitCode !== 0) {
				const first = text.split("\n").find((line) => line.trim().length > 0) ?? "";
				const meta = `exit ${exitCode} ${truncate(first, 80)}`;
				if (expanded) {
					return new Text(`${theme.fg("error", meta)}\n${excerpt(text, theme, EXCERPT_LINES)}`, 0, 0);
				}
				return new Text(theme.fg("error", joinCollapsed(header, meta)), 0, 0);
			}

			let meta = `${countLines(text)} lines`;
			if (details?.truncation?.truncated) meta += " (truncated)";
			return collapsedStatusLine(
				result,
				expanded,
				theme,
				header,
				meta,
				excerpt(text, theme, EXCERPT_LINES),
			);
		},
	});

	pi.registerTool({
		name: "edit",
		label: "edit",
		description: builtIn(process.cwd()).edit.description,
		parameters: builtIn(process.cwd()).edit.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(editHeader(args, shortenPath), theme, context);
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("muted", "edit …"), 0, 0);
			const details = result.details as EditToolDetails | undefined;
			const header = editHeader(toolArgs(context), shortenPath);

			const error = errorLine(result);
			if (error) {
				if (expanded) return new Text(theme.fg("error", error), 0, 0);
				return new Text(theme.fg("error", joinCollapsed(header, error)), 0, 0);
			}

			const diffLines = details?.diff.split("\n") ?? [];
			const additions = diffLines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
			const removals = diffLines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
			const meta = `+${additions} / -${removals}`;

			let text = expanded
				? `${theme.fg("success", `+${additions}`)}${theme.fg("muted", " / ")}${theme.fg("error", `-${removals}`)}`
				: theme.fg("muted", joinCollapsed(header, meta));

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

	pi.registerTool({
		name: "write",
		label: "write",
		description: builtIn(process.cwd()).write.description,
		parameters: builtIn(process.cwd()).write.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(writeHeader(args, shortenPath), theme, context);
		},

		renderResult(_result, { expanded }, theme, context) {
			const header = writeHeader(toolArgs(context), shortenPath);
			if (expanded) return new Text(theme.fg("muted", "written"), 0, 0);
			return new Text(theme.fg("muted", joinCollapsed(header, "written")), 0, 0);
		},
	});

	pi.registerTool({
		name: "grep",
		label: "grep",
		description: builtIn(process.cwd()).grep.description,
		parameters: builtIn(process.cwd()).grep.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).grep.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(grepHeader(args, shortenPath), theme, context);
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text("", 0, 0);
			const details = result.details as GrepToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} matches`;
			if (details?.matchLimitReached) meta += ` (limit ${details.matchLimitReached})`;
			return collapsedStatusLine(
				result,
				expanded,
				theme,
				grepHeader(toolArgs(context), shortenPath),
				meta,
				excerpt(text, theme, EXCERPT_LINES),
			);
		},
	});

	pi.registerTool({
		name: "find",
		label: "find",
		description: builtIn(process.cwd()).find.description,
		parameters: builtIn(process.cwd()).find.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).find.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(findHeader(args, shortenPath), theme, context);
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text("", 0, 0);
			const details = result.details as FindToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} files`;
			if (details?.resultLimitReached) meta += ` (limit ${details.resultLimitReached})`;
			return collapsedStatusLine(
				result,
				expanded,
				theme,
				findHeader(toolArgs(context), shortenPath),
				meta,
				excerpt(text, theme, EXCERPT_LINES),
			);
		},
	});

	pi.registerTool({
		name: "ls",
		label: "ls",
		description: builtIn(process.cwd()).ls.description,
		parameters: builtIn(process.cwd()).ls.parameters,
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return builtIn(ctx.cwd).ls.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, context) {
			return renderCallLine(lsHeader(args, shortenPath), theme, context);
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text("", 0, 0);
			const details = result.details as LsToolDetails | undefined;
			const text = textOf(result);
			let meta = `${countLines(text)} entries`;
			if (details?.entryLimitReached) meta += ` (limit ${details.entryLimitReached})`;
			return collapsedStatusLine(
				result,
				expanded,
				theme,
				lsHeader(toolArgs(context), shortenPath),
				meta,
				excerpt(text, theme, EXCERPT_LINES),
			);
		},
	});
}
