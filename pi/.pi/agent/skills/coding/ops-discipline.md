# AI Operational Discipline

---

## OPS 1 - Context Discipline (Grep Before Read)

Most of an AI coding bill pays for context that never gets used; reading 2000-line files to fix 30 lines is the single biggest leak.

- **Locate before opening.** `Grep`/`Glob` first to find the exact symbol or file; `Read` only once you know which file and roughly which lines.
- **Read targeted slices.** File > 500 lines and the area is known: pass `offset`/`limit` to `Read`. Never default to whole files.
- **One file at a time, on demand.** Never pre-load files "in case they're related"; open the next file only when the current one points to it.
- **Don't re-read after editing.** `Edit`/`Write` are tracked and error on failure; re-reading to "verify" is pure waste.

If you cannot articulate WHY you need to read a file right now, do not read it.

---

The `Agent` tool accepts `model: "haiku" | "sonnet" | "opus"`. Running Opus on lint, lookup, or rename pays premium for what Haiku nails.

**Pass `model: "haiku"` explicitly for:**

- Read-only search / lookup (`Explore`, "where is X", "find references")
- Mechanical edits (rename a symbol, fix a lint, tweak a log message, formatting)
- Status / introspection (`statusline-setup`, "what's the current git state")
- Q&A about tooling (`claude-code-guide`, "how does hook X work")

**Do NOT override (let it inherit) for:**

- `general-purpose` multi-step work (research + edits + reasoning)
- `Plan` (architect / design)
- Code review, security review
- Anything requiring cross-file reasoning, design tradeoffs, or correctness judgment

Rule of thumb: "find / list / format / rename" is a Haiku job; "decide / design / reason / refactor across files" inherits the parent model.

---

## OPS 3 - Routing Is Not an Excuse to Skip

A "this must go through agent/tool/process X" rule constrains **how** work is done, never **whether** it gets done. When a change is worth making, route it through the required path - don't quietly drop it because doing it properly needs a separate task, a second file, or a config/CSS touch.

- **The only legitimate skip is an honest value-vs-cost call.** "It needs a separate task", "it spans CSS _and_ JS", "it's adjacent to my diff" are routing/scope facts, not skip reasons.
- **Watch the tell.** If the reason for _not_ doing something is a process rule rather than "the change isn't worth the cost", that's rationalized inaction. Re-decide on value alone, then route correctly.
- **Cross-boundary debt still counts.** A value duplicated across languages that must stay in sync (e.g. a color hardcoded in both CSS and JS) is exactly the debt a cleanup pass exists to retire: make one side the single source of truth (CSS owns `--terminal-bg`; JS reads the var) and have the other read it. "Two files" is not "out of scope" - if the edit must go through a specific agent, complete it, don't drop it.
