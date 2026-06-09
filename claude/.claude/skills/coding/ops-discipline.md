# AI Operational Discipline

These rules govern **how an AI agent operates** (context spend, delegation, model choice) — not how code is written. They are split out of `SKILL.md` so they don't tax every code-authoring invocation. Load them when you are **operating as an agent or orchestrator** (searching a repo, delegating to subagents, deciding scope), not when you are simply writing a function.

---

## OPS 1 - Context Discipline (Grep Before Read)

Most of an AI coding bill is paying for context that never gets used. Reading 2000-line files to fix 30 lines is the single biggest leak. Don't do it.

**Mandatory habits:**
- **Locate before opening.** Use `Grep` / `Glob` first to find the exact symbol, function, or filename. Only `Read` once you know which file and roughly which lines matter.
- **Read targeted slices.** When a file is large (>500 lines) and you know the area, pass `offset` and `limit` to `Read`. Do NOT default to loading whole files.
- **One file at a time, on demand.** Never pre-load 5 files "in case they're related". Open the next file only when the current one tells you to.
- **Delegate breadth to Explore.** For "where is X defined / which files reference Y" across the repo, spawn the `Explore` subagent rather than running grep+Read in the main loop. Explore returns a digest; the main loop stays small.
- **Don't re-read after editing.** `Edit` and `Write` are tracked. Reading a file you just changed to "verify" is pure waste - the tool would have errored if the change failed.

```
// FORBIDDEN - blind whole-file read for a small fix
Read("/path/to/big-module.ts")            // 1800 lines, you need 20

// MANDATORY - locate, then slice
Grep("functionName", path="/path/to")     // returns file:line
Read("/path/to/big-module.ts", offset=420, limit=60)
```

If you cannot articulate WHY you need to read a file right now, do not read it.

---

## OPS 2 - Model Routing on Subagent Calls

The `Agent` tool accepts an optional `model` parameter (`"haiku" | "sonnet" | "opus"`). Use it. Running Opus on lint, lookup, or rename is paying premium for what Haiku nails.

**Pass `model: "haiku"` explicitly when invoking Agent for:**
- Read-only search / lookup (`Explore` agent, "where is X", "find references")
- Mechanical edits (rename a symbol, fix a lint, tweak a log message, adjust formatting)
- Status / introspection (`statusline-setup`, "what's the current git state")
- Q&A about tooling (`claude-code-guide`, "how does hook X work")

**Do NOT override (let it inherit) for:**
- `general-purpose` multi-step work (research + edits + reasoning)
- `Plan` (architect / design)
- Code review, security review
- Anything requiring cross-file reasoning, design tradeoffs, or correctness judgment

**Rule of thumb:** if the task is "find / list / format / rename", it's a Haiku job. If it's "decide / design / reason / refactor across files", let the parent model handle it.

```
// MANDATORY - cheap lookup
Agent({ subagent_type: "Explore", model: "haiku", prompt: "find every call site of fooBar across packages/" })

// MANDATORY - no override, real work
Agent({ subagent_type: "general-purpose", prompt: "refactor the auth flow to use the new session API" })
```

---

## OPS 3 - Routing Is Not an Excuse to Skip

A "this must go through agent/tool/process X" rule constrains **how** the work is done, never **whether** it gets done. When a change is worth making, route it through the required path - don't quietly drop it because doing it properly needs a delegated agent, a second file, or a config/CSS touch.

- **The only legitimate skip is an honest value-vs-cost call.** "It needs a delegated agent", "it spans CSS *and* JS", "it's adjacent to my diff" are routing/scope facts, not skip reasons. Decide on value; if it's worth doing, delegate and do it.
- **Watch the tell.** If your reason for *not* doing something is a process rule rather than "the change isn't worth the cost," you're rationalizing inaction. Re-decide on value alone, then route correctly.
- **Cross-boundary debt still counts.** A value duplicated across languages that MUST stay in sync (e.g. a color hardcoded in both CSS and JS) is exactly the debt a cleanup/simplify pass exists to retire: make one side the single source of truth and have the other read it. "Two files" is not "out of scope."

```
// FORBIDDEN - a routing rule weaponized as a skip
// "DEFAULT_BACKGROUND duplicates App.css's #1e1e1e, but the fix lives in a file
//  another agent owns, so I'll leave it / note it as follow-up."

// MANDATORY - decide on value, then route
// Worth it (a color that must stay in sync IS real debt) -> do it:
//   CSS owns --terminal-bg; the consumer reads the var instead of re-hardcoding it.
//   If that edit must go through a specific agent, delegate it - don't drop it.
```
