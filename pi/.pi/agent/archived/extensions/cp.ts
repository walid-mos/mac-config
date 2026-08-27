/**
 * cp — open the conversation in nvim to copy any block cleanly.
 *
 * Flow: /cp dumps the conversation (user + assistant messages, markdown source,
 * no padding) into a temp file and opens it in nvim, suspended from the TUI.
 *
 * In nvim:
 *   <CR> (normal mode)  — copy the block under the cursor (paragraph), then quit
 *   <CR> (visual mode)  — copy the visual selection, then quit
 *   q                   — quit without copying
 *   (or just use your own yank/clipboard config and quit)
 *
 * Commands:
 *   /cp       — last turn (your prompt + the reply)
 *   /cp 3     — last 3 turns
 *   /cp all   — whole conversation
 *   /cp code [n|all] — generated code only (write/edit/bash tool calls)
 *
 * Normal mode shows the conversation text plus a compact `# tools:` summary
 * line per turn; code mode dumps the full artifacts instead.
 */

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

/** Split markdown into blocks, keeping fenced code blocks intact. */
function splitBlocks(markdown: string): string[] {
	const blocks: string[] = [];
	let current: string[] = [];
	let inFence = false;

	const flush = () => {
		const b = current.join("\n").trim();
		if (b) blocks.push(b);
		current = [];
	};

	for (const line of markdown.split("\n")) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			current.push(line);
			continue;
		}
		if (!inFence && line.trim() === "") {
			flush();
			continue;
		}
		current.push(line);
	}
	flush();
	return blocks;
}

function messageText(message: any): string {
	if (typeof message.content === "string") return message.content;
	if (!Array.isArray(message.content)) return "";
	return message.content
		.filter((c: any) => c.type === "text")
		.map((c: any) => c.text)
		.join("\n");
}

interface Turn {
	userText: string;
	blocks: string[];    // text blocks and one-line tool markers, in call order
	artifacts: string[]; // generated code blocks from tool calls
}

/** Walk an assistant message in order: text blocks as-is, tool calls as one-liners. */
function processAssistantMessage(
	message: any,
	turn: Turn,
): void {
	if (!Array.isArray(message.content)) {
		const text = messageText(message).trim();
		if (text) turn.blocks.push(...splitBlocks(text));
		return;
	}

	for (const block of message.content) {
		if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
			turn.blocks.push(...splitBlocks(block.text.trim()));
			continue;
		}
		if (block.type !== "toolCall") continue;

		const args = block.arguments ?? {};
		const target = args.path ?? args.command ?? "";
		const short = typeof target === "string" ? target.split("\n")[0].slice(0, 50) : "";
		turn.blocks.push(short ? `# tool: ${block.name}(${short})` : `# tool: ${block.name}`);

		if (block.name === "write" && typeof args.content === "string") {
			turn.artifacts.push(`# write: ${args.path ?? "?"}\n\n${fence(args.path)}\n${args.content}\n\`\`\`\``);
		} else if (block.name === "edit" && Array.isArray(args.edits)) {
			const news = args.edits
				.map((e: any) => e.newText)
				.filter((t: any) => typeof t === "string" && t.trim());
			if (news.length) {
				turn.artifacts.push(`# edit: ${args.path ?? "?"}\n\n${fence(args.path)}\n${news.join("\n")}\n\`\`\`\``);
			}
		} else if (block.name === "bash" && typeof args.command === "string") {
			turn.artifacts.push(`# bash:\n\n\`\`\`\`bash\n${args.command}\n\`\`\`\``);
		}
	}
}

/** Pick a fence language from a file extension. */
function fence(path: unknown): string {
	const ext = typeof path === "string" ? path.split(".").pop()?.toLowerCase() : "";
	const langs: Record<string, string> = {
		ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
		py: "python", rs: "rust", go: "go", rb: "ruby",
		md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
		sh: "bash", bash: "bash", zsh: "bash",
		html: "html", css: "css", sql: "sql",
	};
	return "\`\`\`\`" + (ext ? (langs[ext] ?? ext) : "");
}

/** Group branch entries into turns: a user message + the assistant replies that follow. */
function collectTurns(ctx: ExtensionContext): Turn[] {
	const turns: Turn[] = [];
	let current: Turn | null = null;

	for (const entry of ctx.sessionManager.getBranch() as any[]) {
		if (entry.type !== "message") continue;
		const role = entry.message?.role;
		const text = messageText(entry.message ?? {}).trim();

		if (role === "user") {
			if (!text) continue;
			current = { userText: text, blocks: [], artifacts: [] };
			turns.push(current);
		} else if (role === "assistant" && current) {
			processAssistantMessage(entry.message, current);
		}
	}
	return turns;
}

/** Build the file content: one section per turn, blocks as vim paragraphs. */
function buildDocument(ctx: ExtensionContext, lastN: number | null, codeOnly: boolean): string {
	const turns = collectTurns(ctx);
	const selected = lastN === null ? turns : turns.slice(-lastN);
	const sections: string[] = [];

	for (const turn of selected) {
		const blocks: string[] = [];
		if (codeOnly) {
			if (turn.artifacts.length === 0) continue;
			blocks.push(`# you: ${turn.userText.split("\n")[0].slice(0, 60)}`);
		} else {
			blocks.push(
				`# you: ${turn.userText.split("\n")[0].slice(0, 60)}`,
				...splitBlocks(turn.userText),
				"# pi:",
				...turn.blocks,
			);
		}
		if (codeOnly && turn.artifacts.length > 0) {
			blocks.push("# code:", ...turn.artifacts);
		}
		sections.push(blocks.join("\n\n"));
	}
	return sections.join("\n\n\n") + "\n";
}

function resolveEditor(): string {
	if (process.env.PI_CP_EDITOR) return process.env.PI_CP_EDITOR;
	if (process.env.VISUAL) return process.env.VISUAL;
	if (process.env.EDITOR) return process.env.EDITOR;
	return "nvim";
}

function copyToClipboard(text: string): void {
	const commands: [string, string[]][] =
		process.platform === "darwin"
			? [["pbcopy", []]]
			: process.platform === "win32"
				? [["clip", []]]
				: [
						["wl-copy", []],
						["xclip", ["-selection", "clipboard"]],
						["xsel", ["--clipboard", "--input"]],
					];
	for (const [cmd, args] of commands) {
		try {
			execFileSync(cmd, args, { input: text });
			return;
		} catch {
			// try next
		}
	}
	throw new Error("no clipboard tool found");
}

/** Grab the real TUI instance (needed to suspend/resume the UI around nvim). */
async function acquireTui(ctx: ExtensionContext): Promise<TUI | null> {
	let tui: TUI | null = null;
	await ctx.ui.custom<null>((t, _theme, _kb, done) => {
		tui = t;
		done(null);
		return { render: () => [], invalidate: () => {} };
	});
	return tui;
}

async function openInEditor(ctx: ExtensionContext, arg: string): Promise<void> {
	const tokens = arg.trim().split(/\s+/).filter(Boolean);
	const codeOnly = tokens[0] === "code";
	const range = codeOnly ? (tokens[1] ?? "1") : (tokens[0] ?? "1");
	const lastN = range === "all" ? null : Math.max(1, parseInt(range, 10) || 1);
	const doc = buildDocument(ctx, lastN, codeOnly);
	if (!doc.trim()) {
		ctx.ui.notify("Nothing to copy in this conversation.", "info");
		return;
	}

	const tui = await acquireTui(ctx);
	if (!tui) {
		ctx.ui.notify("Could not access the TUI.", "error");
		return;
	}

	const dir = mkdtempSync(join(tmpdir(), "pi-cp-"));
	const filePath = join(dir, "conversation.md");
	const resultPath = join(dir, "selection.txt");
	writeFileSync(filePath, doc, "utf-8");

	const [editor, ...editorArgs] = resolveEditor().split(" ");

	// Buffer-local mappings: <CR> copies paragraph (normal) or selection (visual)
	// into the result file and quits; extension then puts it in the clipboard.
	const vimCmds = [
		"setlocal filetype=markdown",
		`nnoremap <buffer> <CR> vip"ay:call writefile(split(@a, "\\n", 1), "${resultPath}") <Bar> qa!<CR>`,
		`vnoremap <buffer> <CR> "ay:call writefile(split(@a, "\\n", 1), "${resultPath}") <Bar> qa!<CR>`,
		"nnoremap <buffer> q :qa!<CR>",
	];

	tui.stop();
	try {
		const args = editorArgs.concat(vimCmds.flatMap((c) => ["-c", c]), [filePath]);
		const exitCode = await new Promise<number | null>((resolve) => {
			const child = spawn(editor, args, {
				stdio: "inherit",
				shell: process.platform === "win32",
			});
			child.on("error", () => resolve(null));
			child.on("close", (code) => resolve(code));
		});

		if (exitCode === null) {
			ctx.ui.notify(`Failed to launch editor: ${editor}`, "error");
			return;
		}

		let selected = "";
		try {
			selected = readFileSync(resultPath, "utf-8");
		} catch {
			// user quit without copying
		}

		if (selected.trim()) {
			try {
				copyToClipboard(selected);
				ctx.ui.notify(`Copied ${selected.trim().length} chars to clipboard.`, "info");
			} catch {
				ctx.ui.notify("Selection made but clipboard copy failed.", "error");
			}
		}
	} finally {
		tui.start();
		tui.requestRender(true);
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// best effort
		}
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("cp", {
		description: "Copy cleanly via $EDITOR: /cp [code] [n|all] — last n turns (default 1)",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/cp requires the TUI.", "error");
				return;
			}
			await openInEditor(ctx, args);
		},
	});

	pi.registerShortcut("ctrl+shift+x", {
		description: "Copy last turn cleanly via $EDITOR",
		handler: async (ctx) => {
			if (!ctx.hasUI) return;
			await openInEditor(ctx, "");
		},
	});
}
