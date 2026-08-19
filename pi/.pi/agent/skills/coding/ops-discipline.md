# AI Operational Discipline

---

## OPS 1 - Context Discipline (Grep Before Read)

Most of an AI coding bill pays for context that never gets used; reading
2000-line files to fix 30 lines is the single biggest leak.

- **Locate before opening.** `grep`/`find` first to find the exact symbol
  or file; `read` only once you know which file and roughly which lines.
- **Read targeted slices.** File > 500 lines and the area is known: pass
  `offset`/`limit`. Never default to whole files.
- **One file at a time, on demand.** Never pre-load files "in case they're
  related"; open the next file only when the current one points to it.
- **Delegate breadth to `searcher`.** "Where is X defined / which files
  reference Y" across the repo goes to the `searcher` agent (async,
  aliases `scout` / `explorer` / `files`). It returns a digest — the main
  loop stays small.
- **Don't re-read after editing.** `edit`/`write` are tracked and error on
  failure; re-reading to "verify" is pure waste.

If you cannot articulate WHY you need to read a file right now, do not
read it.

---

## OPS 2 - Model pins stay on the agent

Never pass `model` per-run unless the user explicitly asked. Agent
frontmatter pins are the contract.

---

## OPS 3 - Routing Is Not an Excuse to Skip

A "this must go through agent/tool/process X" rule constrains **how**
work is done, never **whether** it gets done. When a change is worth
making, route it through the required path — don't quietly drop it
because doing it properly needs a separate task, a second file, or a
config/CSS touch.

- **The only legitimate skip is an honest value-vs-cost call.** "It needs
  a separate task", "it spans CSS _and_ JS", "it's adjacent to my diff"
  are routing/scope facts, not skip reasons.
- **Watch the tell.** If the reason for _not_ doing something is a
  process rule rather than "the change isn't worth the cost", that's
  rationalized inaction. Re-decide on value alone, then route correctly.
- **Cross-boundary debt still counts.** A value duplicated across
  languages that must stay in sync (e.g. a color hardcoded in both CSS
  and JS) is exactly the debt a cleanup pass exists to retire: make one
  side the single source of truth and have the other read it. "Two files"
  is not "out of scope" — if the edit must go through a specific agent,
  complete it, don't drop it.
