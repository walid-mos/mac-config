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

Surface architectural friction and propose **deepening opportunities** - refactors that turn shallow modules into deep ones, for **locality** and **testability**.

This skill is the *launchable workflow*. The doctrine and vocabulary live in [`../coding/architecture.md`](../coding/architecture.md). **Load that file first** - use its terms exactly (module, interface, depth, seam, adapter, leverage, locality); do not drift into "component / service / API / boundary".

## Workflow

### 1. Orient

- Load `../coding/architecture.md` (doctrine + vocabulary).
- Read the project's domain language and decisions so suggestions match the codebase: `CLAUDE.md`, `CONTEXT.md` / `ARCHITECTURE.md` if present, and any ADRs under `docs/adr/`. **Do not re-litigate decisions already recorded in an ADR.**

### 2. Explore


Map where you feel friction — don't follow rigid heuristics:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** (ARCH 0 signals)?
- Where were pure functions extracted only for testability, but the real bugs hide in how they're *called* (no locality)?
- Where do tightly-coupled modules leak across their seams? Where does high-level policy import low-level detail directly?
- What is untested or hard to test through its current interface?

Apply ARCH 0's **deletion test** to anything you suspect is shallow: "deleting it would concentrate complexity" is the signal worth chasing; "would just move it" is not.

### 3. Rank candidates

For each candidate refactor:

- **Files / modules** involved.
- **Problem** - the friction, in deep/shallow terms.
- **Solution** - plain English: what gets deepened, what sits behind the seam.
- **Benefit** - stated as **leverage** (callers) + **locality** (maintainers) + how tests improve.
- **Before / After** - a quick structural sketch of the shallowness and the deepening.
- **Strength** - `Strong` | `Worth exploring` | `Speculative`.

If a candidate contradicts an ADR, surface it ONLY when the friction is real enough to reopen the decision; mark it clearly. Do **not** propose concrete interfaces yet.

### 4. Present + choose

Default to an **inline** ranked summary ending with a single **Top recommendation**. For a shareable artifact, consider saving it under the project's `docs/` notes. Then ask which candidate to explore via `ask_user_question` — never a free-text question.

### 5. Grill the chosen one

When the user picks a candidate, walk the design tree in conversation - constraints, dependencies, the shape of the deepened interface, what sits behind the seam, which tests survive. Side effects of the conversation:

- Deepened module named after a concept not yet in the domain glossary -> add the term (to `CONTEXT.md` / `CLAUDE.md`).
- User rejects a candidate with a load-bearing reason a future review would need -> offer to record it as an ADR so it isn't re-suggested.

## Boundaries

- This skill **finds and shapes** architecture; it does not mass-rewrite code. Once a refactor is agreed, implement it under the normal coding doctrine (`coding`, language skill, `react`), behind green tests. One refactor at a time.