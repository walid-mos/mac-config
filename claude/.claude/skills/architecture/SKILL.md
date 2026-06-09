---
name: architecture
user-invocable: true
description: >-
  Validate and improve a codebase's architecture: find shallow modules, tight
  coupling, and missing seams, then propose ranked "deepening" refactors that
  raise testability and AI-navigability. Use when the user runs /architecture,
  asks to review or improve architecture, find refactoring opportunities,
  reduce coupling, consolidate tightly-coupled modules, or make a codebase
  easier to test.
---

# Architecture Review

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones (a lot of behaviour behind a small interface). The aim is **locality** (change, bugs, knowledge concentrated in one place) and **testability** (the interface is the test surface).

This skill is the *launchable workflow*. The doctrine and vocabulary it speaks live in [`../coding/architecture.md`](../coding/architecture.md) (ARCH 0: deep vs shallow, the deletion test, seams, dependency direction). **Load that file first** — use its terms exactly (module, interface, depth, seam, adapter, leverage, locality); do not drift into "component / service / API / boundary".

## Workflow

### 1. Orient

- Load `../coding/architecture.md` (doctrine + vocabulary).
- Read the project's domain language and decisions so suggestions match the codebase: `CLAUDE.md`, `CONTEXT.md` / `ARCHITECTURE.md` if present, and any ADRs under `docs/adr/`. **Do not re-litigate decisions already recorded in an ADR.**

### 2. Explore (delegate breadth)

Spawn one or more `Explore` subagents to map the modules and note where you feel friction — don't follow rigid heuristics:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation (pass-throughs, forwarding wrappers, "managers" exposing every internal)?
- Where were pure functions extracted only for testability, but the real bugs hide in how they're *called* (no locality)?
- Where do tightly-coupled modules leak across their seams? Where does high-level policy import low-level detail (DB/HTTP/FS) directly?
- What is untested or hard to test through its current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? "Concentrates" is the signal worth chasing.

### 3. Rank candidates

For each candidate refactor:

- **Files / modules** involved.
- **Problem** — the friction, in deep/shallow terms.
- **Solution** — plain English: what gets deepened, what sits behind the seam.
- **Benefit** — stated as **leverage** (callers) + **locality** (maintainers) + how tests improve.
- **Before / After** — a quick structural sketch of the shallowness and the deepening.
- **Strength** — `Strong` | `Worth exploring` | `Speculative`.

If a candidate contradicts an ADR, surface it ONLY when the friction is real enough to reopen the decision; mark it clearly. Do **not** propose concrete interfaces yet.

### 4. Present + choose

Default to an **inline** ranked summary ending with a single **Top recommendation**. For a shareable artifact, hand off to the `html` skill (shape: `audit`, NextNode branding, before/after blocks) and save it per the `project-docs` layout. Then ask: **"Which of these would you like to explore?"**

### 5. Grill the chosen one

When the user picks a candidate, drop into the `interview` skill to walk the design tree — constraints, dependencies, the shape of the deepened interface, what sits behind the seam, which tests survive. For the interface itself, use `tdd/interface-design.md` (deep modules, dependencies as parameters, decisions separated from effects). Side effects of the conversation:

- Deepened module named after a concept not yet in the domain glossary → add the term (to `CONTEXT.md` / `CLAUDE.md`).
- User rejects a candidate with a load-bearing reason a future review would need → offer to record it as an ADR so it isn't re-suggested.

## Boundaries

- This skill **finds and shapes** architecture; it does not mass-rewrite code. Once a refactor is agreed, implement it under the normal coding doctrine (`coding`, language skill; React via the `react` skill + hook).
- One refactor at a time, behind green tests — drive the change with the `tdd` skill.
