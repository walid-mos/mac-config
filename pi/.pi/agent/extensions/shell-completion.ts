/**
 * Shell completion for pi's `!` / `!!` bash mode.
 *
 * - Popup opens right after typing `!`, stays alive while typing the command.
 * - Command position (first word after `!`, also after `|`, `;`, `&&`, `||`):
 *   completes from your real zsh environment — PATH executables, builtins,
 *   aliases, functions — dumped once per process via `zsh -ic` (sources your
 *   ~/.zshrc). The cache survives /clear and /resume.
 * - Argument position: delegates to pi's built-in path completion.
 * - Outside `!` mode: 100% native behavior (slash commands, @files, Tab).
 *
 * NOTE: completing an alias/function only helps if `!` actually runs through
 * your zsh — see shellPath / shellCommandPrefix in ~/.pi/agent/settings.json.
 * pi's default `!` execution is non-interactive bash.
 *
 * /refresh-shell-completions reloads the cache (e.g. after editing .zshrc).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type AutocompleteItem,
	type AutocompleteProvider,
	type AutocompleteSuggestions,
	fuzzyFilter,
} from "@earendil-works/pi-tui";
import { readdirSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

const MAX_SUGGESTIONS = 20;
const ZSH_TIMEOUT_MS = 15_000;

type Kind = "alias" | "function" | "builtin" | "command" | "keyword";
/** Display/precedence order: what you customized yourself ranks first. */
const KIND_RANK: Record<Kind, number> = { alias: 0, function: 1, builtin: 2, command: 3, keyword: 4 };

type Cache = Map<string, Kind>;

// Only `!` — the popup opens on `!` and the editor's letter branch keeps
// re-querying while the token matches `^![^\s]*$`. Adding letters here would
// instead route them into the symbol branch, which requires the char before
// to be a space — `!g` would NOT trigger (checked against pi-tui editor.js).
const TRIGGER_CHARACTERS = ["!"];

// Module scope: survives session replacement (/clear, /resume, /fork) —
// session_start re-fires for each session but the zsh dump need not.
let cachePromise: Promise<Cache> | undefined;
let failureNotified = false;

const ZSH_DUMP_SCRIPT = [
	"print -r -- '@@ALIASES@@'",
	"print -l -- ${(k)aliases}",
	"print -r -- '@@FUNCTIONS@@'",
	"print -l -- ${(k)functions}",
	"print -r -- '@@BUILTINS@@'",
	"print -l -- ${(k)builtins}",
	"print -r -- '@@COMMANDS@@'",
	"print -l -- ${(k)commands}",
	"print -r -- '@@RESWORDS@@'",
	"print -l -- ${(k)reswords}",
].join("; ");

function parseZshDump(stdout: string): Cache {
	const cache: Cache = new Map();
	let section: string | undefined;
	for (const raw of stdout.split("\n")) {
		const line = raw.trim();
		const marker = line.match(/^@@([A-Z]+)@@$/);
		if (marker) {
			section = marker[1];
			continue;
		}
		if (!section || !line || !/^[\w.:+-]+$/.test(line)) continue;
		// Skip zsh completion internals (_git, prompt hooks, etc.)
		if (line.startsWith("_")) continue;

		const kind: Kind | undefined =
			section === "ALIASES"
				? "alias"
				: section === "FUNCTIONS"
					? "function"
					: section === "BUILTINS"
						? "builtin"
						: section === "COMMANDS"
							? "command"
							: section === "RESWORDS"
								? "keyword"
								: undefined;
		// First section wins: dump order follows KIND_RANK precedence.
		if (kind && !cache.has(line)) cache.set(line, kind);
	}
	return cache;
}

/** Fallback: scan PATH for executables if the zsh dump fails. */
function scanPathExecutables(): Cache {
	const cache: Cache = new Map();
	for (const dir of (process.env.PATH ?? "").split(delimiter)) {
		if (!dir) continue;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (cache.has(entry)) continue;
			try {
				const st = statSync(join(dir, entry));
				if (st.isFile() && st.mode & 0o111) cache.set(entry, "command");
			} catch {
				// ignore broken symlinks etc.
			}
		}
	}
	return cache;
}

async function buildCache(pi: ExtensionAPI, cwd: string, notify: (msg: string) => void): Promise<Cache> {
	try {
		const result = await pi.exec("zsh", ["-ic", ZSH_DUMP_SCRIPT], {
			cwd,
			timeout: ZSH_TIMEOUT_MS,
		});
		if (result.code === 0) {
			const cache = parseZshDump(result.stdout);
			if (cache.size > 0) return cache;
		}
		throw new Error(result.stderr.trim() || `zsh exited ${result.code}`);
	} catch (err) {
		if (!failureNotified) {
			failureNotified = true;
			notify(`shell-completion: zsh dump failed, PATH scan only (${err instanceof Error ? err.message : err})`);
		}
		return scanPathExecutables();
	}
}

function isBashMode(lines: string[]): boolean {
	return lines.join("\n").trimStart().startsWith("!");
}

/** Index of the first non-empty line — where the `!` lives. */
function firstContentLine(lines: string[]): number {
	const idx = lines.findIndex((l) => l.trim() !== "");
	return idx === -1 ? 0 : idx;
}

/**
 * If the cursor is in command position (first word after `!`/`!!`, or the
 * first word after a `|` `;` `&&` `||` separator), returns the token being
 * typed. Otherwise undefined. Works with the cursor mid-token.
 */
function commandToken(lines: string[], cursorLine: number, cursorCol: number): string | undefined {
	if (!isBashMode(lines)) return undefined;
	if (cursorLine !== firstContentLine(lines)) return undefined;
	const before = lines[cursorLine]?.slice(0, cursorCol) ?? "";

	const segments = before.split(/&&|\|\||[|;]/);
	const segment = segments[segments.length - 1] ?? "";

	if (segments.length === 1) {
		// First segment: must carry the `!` prefix.
		const match = segment.match(/^\s*!!?\s*([^\s]*)$/);
		return match ? (match[1] ?? "") : undefined;
	}
	// Later segments: plain command position (no `!` needed).
	const match = segment.match(/^\s*([^\s]*)$/);
	return match ? (match[1] ?? "") : undefined;
}

function byKindThenLength(cache: Cache) {
	return (a: string, b: string) =>
		KIND_RANK[cache.get(a)!] - KIND_RANK[cache.get(b)!] || a.length - b.length || a.localeCompare(b);
}

function filterCommands(cache: Cache, token: string): AutocompleteItem[] {
	const names = [...cache.keys()];
	let ordered: string[];
	if (token === "") {
		// Popup right after `!`: show the user's own stuff first.
		ordered = names.sort(byKindThenLength(cache));
	} else {
		// Prefix matches first (feels like zsh), then fuzzy for the rest.
		const prefixMatches = names.filter((n) => n.startsWith(token)).sort(byKindThenLength(cache));
		const fuzzyMatches = fuzzyFilter(
			names.filter((n) => !n.startsWith(token)),
			token,
			(n) => n,
		);
		ordered = [...prefixMatches, ...fuzzyMatches];
	}
	return ordered.slice(0, MAX_SUGGESTIONS).map((n) => ({ value: n, label: n, description: cache.get(n) }));
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		const getCache = () => loadCache(pi, ctx.cwd, (msg) => ctx.ui.notify(msg, "warning"));

		function loadCache(api: ExtensionAPI, cwd: string, notify: (msg: string) => void): Promise<Cache> {
			// Memoized: one zsh dump per process, NOT per keystroke.
			cachePromise ??= buildCache(api, cwd, notify);
			return cachePromise;
		}

		// Warm the cache at startup (async, non-blocking).
		void getCache();

		pi.registerCommand("refresh-shell-completions", {
			description: "Reload the zsh command/alias/function cache used by `!` completion",
			handler: async (_args, cmdCtx) => {
				cachePromise = undefined;
				const cache = await getCache();
				cmdCtx.ui.notify(`shell-completion: ${cache.size} entries cached`, "info");
			},
		});

		ctx.ui.addAutocompleteProvider((current): AutocompleteProvider => {
			return {
				triggerCharacters: TRIGGER_CHARACTERS,

				async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
					const token = commandToken(lines, cursorLine, cursorCol);

					// Not bash mode, or argument position, or explicit path:
					// full native behavior (slash commands, @files, paths, Tab).
					if (
						token === undefined ||
						token.startsWith("/") ||
						token.startsWith(".") ||
						token.startsWith("~")
					) {
						return current.getSuggestions(lines, cursorLine, cursorCol, options);
					}

					const cache = await getCache();
					if (options.signal.aborted) return null;

					const items = filterCommands(cache, token);
					if (items.length === 0) {
						return current.getSuggestions(lines, cursorLine, cursorCol, options);
					}
					return { items, prefix: token };
				},

				applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
					return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
				},

				shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
					return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
				},
			};
		});
	});
}
