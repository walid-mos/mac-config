/**
 * skill-chaining — auto-open /skill: autocomplete anywhere in the prompt.
 *
 * The built-in slash-command autocomplete only opens at the very start of the
 * message (line 0, column 0).  This extension adds two things:
 *
 * 1. An autocomplete provider that intercepts `/skill:...` mid-line, queries
 *    the real skill list from the built-in command registry (same source of
 *    truth), and returns fuzzy-filtered skill names.
 *
 * 2. An editor wrapper that auto-triggers the popup when the user types
 *    `/skill:` mid-line.  Escape closes it as usual.
 *
 * Usage:
 *   faire un audit /skill:swarm /skill:stack
 *               ^-- popup opens after typing `:`  ^-- same here
 *
 *   Esc closes the popup.  Tab / Enter confirms the selection.
 */
import type { ExtensionAPI, ExtensionContext, Skill } from "@earendil-works/pi-coding-agent";
import { CustomEditor, loadSkills, stripFrontmatter } from "@earendil-works/pi-coding-agent";
import type {
	AutocompleteItem,
	AutocompleteProvider,
	AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { fuzzyFilter } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";

/**
 * Regex that matches a `/skill:` token with optional typed prefix,
 * preceded by whitespace or line-start.
 */
const SKILL_TOKEN_RE = /(?:^|\s)(\/skill:([a-z0-9-]*))$/;

/**
 * Regex to check whether we are INSIDE a `/skill:` context
 * (for tab-completion gating).
 */
const SKILL_CONTEXT_RE = /(?:^|\s)\/skill:[a-z0-9-]*$/;

/**
 * Build an autocomplete provider that wraps the built-in provider.
 *
 * When the cursor is after a `/skill:` token mid-line, it queries the
 * built-in provider for the full command list (same source of truth as
 * the slash-command menu), filters to items starting with `skill:`, and
 * fuzzy-matches the typed prefix.
 */
function createSkillChainingProvider(current: AutocompleteProvider): AutocompleteProvider {
	return {
		async getSuggestions(
			lines: string[],
			cursorLine: number,
			cursorCol: number,
			options: { signal: AbortSignal; force?: boolean },
		): Promise<AutocompleteSuggestions | null> {
			const currentLine = lines[cursorLine] ?? "";
			const textBefore = currentLine.slice(0, cursorCol);

			const match = textBefore.match(SKILL_TOKEN_RE);
			if (!match) {
				// Not a /skill: context — full delegation to built-in.
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const fullToken = match[1]!; // "/skill:sw"
			const prefix = match[2]!; // "sw"

			// Ask the built-in provider for the same command list it uses
			// for the start-of-line slash menu.  This is the single source
			// of truth: skills, extension commands, prompt templates, …
			const allCommands = await current.getSuggestions(["/"], 0, 1, options);
			if (!allCommands) return null;

			// Only return skill: commands
			const skillItems = allCommands.items.filter((item) =>
				item.value.startsWith("skill:"),
			);
			if (skillItems.length === 0) return null;

			// Fuzzy-filter by what the user typed after /skill:
			const filtered: AutocompleteItem[] = prefix
				? fuzzyFilter(skillItems, prefix, (item) => item.value)
				: skillItems;

			return {
				items: filtered.map((item) => ({
					value: item.value, // "skill:swarm"
					label: item.label,
					description: item.description,
				})),
				prefix: fullToken, // "/skill:sw"
			};
		},

		applyCompletion(
			lines: string[],
			cursorLine: number,
			cursorCol: number,
			item: AutocompleteItem,
			prefix: string,
		): { lines: string[]; cursorLine: number; cursorCol: number } {
			const currentLine = lines[cursorLine] ?? "";
			const before = currentLine.slice(0, cursorCol - prefix.length);
			const after = currentLine.slice(cursorCol);

			// Insert "/skill:name " (leading slash + trailing space for chaining).
			const newLine = before + "/" + item.value + " " + after;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;

			return {
				lines: newLines,
				cursorLine,
				cursorCol: before.length + item.value.length + 2, // +2 for "/" and space
			};
		},

		shouldTriggerFileCompletion(
			lines: string[],
			cursorLine: number,
			cursorCol: number,
		): boolean {
			const currentLine = lines[cursorLine] ?? "";
			const textBefore = currentLine.slice(0, cursorCol);

			// Inside a /skill: context, Tab should open the skill menu,
			// not the file-completion menu.
			if (textBefore.match(SKILL_CONTEXT_RE)) {
				return false;
			}

			return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
		},
	};
}

// ---------------------------------------------------------------------------
// Multi-skill expansion
// ---------------------------------------------------------------------------
//
// pi's built-in expansion (_expandSkillCommand in agent-session.js) only
// handles a SINGLE `/skill:` at the very start of the prompt: everything after
// the first space becomes that skill's args. So `/skill:a /skill:b` loads `a`
// and passes `/skill:b` through as literal args — `b` is never loaded, and
// `/skill:` mid-line is never expanded at all.
//
// The `input` event (with action: "transform") fires BEFORE the native skill
// expansion, so we expand every `/skill:` token here, in the same `<skill>`
// block format pi uses natively. The native step then finds no `/skill:`
// prefix and passes the already-expanded text through unchanged.
//
// Args: the text after a skill name is attached to that skill, up to the next
// `/skill:` token. So `/skill:stack fais une PR propre /skill:swarm` expands
// to the stack block + "fais une PR propre" + the swarm block.

/**
 * Cache of known skills. Seeded by re-discovering default directories,
 * then replaced by pi's exact loaded list once before_agent_start fires.
 */
let skillsCache: { cwd: string; skills: Map<string, Skill> } | undefined;

/** Get the skill list, keyed by cwd so a new project re-discovers. */
function getSkills(ctx: ExtensionContext): Map<string, Skill> {
	if (skillsCache && skillsCache.cwd === ctx.cwd) {
		return skillsCache.skills;
	}
	const result = loadSkills({
		cwd: ctx.cwd,
		agentDir: undefined, // falls back to pi's own getAgentDir()
		skillPaths: [],
		includeDefaults: true,
	});
	const skills = new Map(result.skills.map((s) => [s.name, s]));
	skillsCache = { cwd: ctx.cwd, skills };
	return skills;
}

/** Replace the cache with pi's exact loaded skill list (covers npm packages). */
function adoptLoadedSkills(skills: Skill[] | undefined, cwd: string): void {
	if (!Array.isArray(skills)) return;
	skillsCache = { cwd, skills: new Map(skills.map((s) => [s.name, s])) };
}

/**
 * Expand every `/skill:name` token (at start or after whitespace) into its
 * `<skill>` content block, in the same format pi uses natively. Unknown skill
 * names are left untouched (pi will also pass them through). Returns the
 * original text when nothing changed.
 */
function expandAllSkills(text: string, skills: Map<string, Skill>): string {
	const TOKEN_RE = /(?:^|\s)\/skill:([a-z0-9-]+)/g;
	const matches = [...text.matchAll(TOKEN_RE)].filter((m) => skills.has(m[1]));
	if (matches.length === 0) return text;

	let out = "";
	let cursor = 0;
	for (let i = 0; i < matches.length; i++) {
		const m = matches[i]!;
		const skill = skills.get(m[1])!;

		// Everything before this token (including any leading whitespace).
		out += text.slice(cursor, m.index);

		let body = "";
		try {
			body = stripFrontmatter(readFileSync(skill.filePath, "utf-8")).trim();
		} catch {
			// Unreadable skill file — leave the token untouched.
			out += m[0];
			cursor = m.index + m[0].length;
			continue;
		}

		out += `<skill name="${skill.name}" location="${skill.filePath}">\n`
			+ `References are relative to ${skill.baseDir}.\n\n`
			+ `${body}\n</skill>`;

		// Args: text from the end of this token to the next /skill: token (or end).
		const next = matches[i + 1];
		const argsEnd = next ? next.index : text.length;
		const args = text.slice(m.index + m[0].length, argsEnd).trim();
		if (args) {
			out += `\n\n${args}`;
		} else if (next) {
			out += "\n"; // separator between chained skill blocks
		}
		cursor = argsEnd;
	}
	out += text.slice(cursor);
	return out;
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		// Refresh the skill cache when resources are reloaded.
		if (_event.reason === "reload") {
			skillsCache = undefined;
		}

		// 1. Register the autocomplete provider that handles /skill: mid-line.
		ctx.ui.addAutocompleteProvider(createSkillChainingProvider);

		// 2. Replace the editor with a wrapper that auto-triggers the popup
		//    when the user types `/skill:` mid-line.
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			// Note: the "{}" options are fine — the interactive mode copies
			// paddingX / autocompleteMaxVisible / borderColor / callbacks
			// from the default editor (see setCustomEditorComponent).
			const editor = new CustomEditor(tui, theme, keybindings, {});
			const originalHandleInput = editor.handleInput.bind(editor);

			// Override handleInput on the instance to add mid-line /skill: detection.
			// The original is called first for standard behaviour, then we check
			// whether the popup should open.
			editor.handleInput = (data: string) => {
				originalHandleInput(data);

				// Only respond to single printable ASCII characters.
				// Escape (0x1b), Tab (0x09), arrows (0x1b…), backspace (0x7f),
				// Enter (0x0a) etc. must NOT re-trigger.
				if (data.length !== 1) return;
				const code = data.charCodeAt(0);
				if (code < 0x20 || code > 0x7e) return;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const ed = editor as any;
				const textBefore = (
					ed.state.lines[ed.state.cursorLine] ?? ""
				).slice(0, ed.state.cursorCol);

				// Trigger on /skill: mid-line.
				// The built-in already handles start-of-line; we focus on
				// the mid-line case the built-in misses.
				if (
					textBefore.match(SKILL_CONTEXT_RE) &&
					!editor.isShowingAutocomplete()
				) {
					ed.tryTriggerAutocomplete();
				}
			};

			return editor;
		});
	});

	// Adopt pi's exact loaded skill list once an agent run starts
	// (covers skills shipped in npm packages, which re-discovery misses).
	pi.on("before_agent_start", (event) => {
		adoptLoadedSkills(event.systemPromptOptions.skills, event.systemPromptOptions.cwd);
	});

	// Expand every /skill: token in the submitted prompt, so chained skills
	// are all loaded — not just the first one at the start.
	pi.on("input", async (event, ctx) => {
		if (!event.text.includes("/skill:")) {
			return { action: "continue" as const };
		}
		// Seeded lazily; before_agent_start keeps it in sync with pi's list.
		const skills = getSkills(ctx);
		const expanded = expandAllSkills(event.text, skills);
		if (expanded === event.text) {
			return { action: "continue" as const };
		}
		return { action: "transform" as const, text: expanded };
	});
}