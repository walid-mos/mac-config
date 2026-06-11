---
name: coding
user-invocable: false
description: >-
  Language-agnostic coding judgment that MUST be loaded whenever writing or
  modifying code in ANY language. Covers what no linter can judge: abstraction
  levels, naming by domain, DRY vs AHA, SOLID, purity, error design.
  Mechanical style rules are enforced by oxlint via @nextnode-solutions/standards.
---

# Coding Rules - Mandatory, Language-Agnostic

Apply to ALL code written or modified, in every language. Mechanical rules (nesting, size caps, magic numbers, boolean params, naming bans, ...) are enforced by the oxlint config in `@nextnode-solutions/standards` - this file carries only the judgment a linter cannot make. A lint violation is fixed by redesign, never by silencing the rule.

Sub-files, load on demand:

- [architecture.md](architecture.md) - project-level structure rules (ARCH 0-6: deep vs shallow modules, god objects, typed structures, dispatch tables, invariants & ownership, cross-cutting registries, decay signals). Load when designing or modifying structure across files, not just functions.
- [ops-discipline.md](ops-discipline.md) - AI operational rules (context spend, model routing, routing-is-not-an-excuse). Load when operating as agent/orchestrator; NOT needed for plain code authoring.

---

## RULE 1 - Early Returns (Guard Clauses)

Handle invalid/edge cases FIRST and return immediately; never wrap the function body in an `if`. Errors first, happy path last at natural indentation. Flattening techniques (the linter caps nesting at 2; these are how you get there): early returns, extract inner blocks into named functions, invert conditions, `continue`/`break` to skip early, pipeline operations (map/filter/reduce) instead of nested loops.

## RULE 3 - Small, Focused Functions: Single Level of Abstraction

A function either orchestrates (calls other functions) or implements (does one small piece of work) - never both. If "and" is needed to describe it, split it. Aim for ~20 lines; the 50-line lint cap is a ceiling, not a target - the real signal is mixed concerns or abstraction levels, which no line count catches.

## RULE 4 - Meaningful Naming (Domain Language)

The linter bans generic words and enforces boolean question-prefixes; judge the rest:

- Describe WHAT it holds, not the type: `activeUsers` not `userList`, `retryDelayMs` not `num`.
- Speak the domain: if the business calls it a "claim", the code says `claim`, not `request`.
- Verbs for actions (`fetchUser`, `calculateTax`); predicates return booleans (`isValid`, `canAfford`); name the intent, not the mechanics (`ensureAuthenticated`, not `checkAndMaybeRedirect`).
- No non-standard abbreviations (`cfg`, `ctx`, `mgr`, `svc`) - full words unless universally standard (`URL`, `HTTP`, `ID`). Single letters only in trivial lambdas (`items.map(x => x.id)`).

## RULE 7 - Immutability by Default

Do not mutate inputs (linted) or shared state (judgment) - create new values. Prefer pure transformations (`map`, `filter`, spread/copy) over in-place mutation; mutable variables only when accumulation or reassignment is genuinely needed. Mutation for performance stays local to the function scope - never mutate something the caller owns.

## RULE 8 - Pure Functions First

Separate computation from side effects: compute the result, then apply it - never interleave IO mid-calculation. Side-effectful operations (DB, network, file, logging) live at the edges, never in utility functions.

## RULE 9 - Simplify Conditionals

- **Consolidate related guards when they state one precondition:** three stacked `if (!user...) return` lines that tell one story become `if (!user?.email || !user.isVerified) return`.
- **Lookup tables over long if/else or switch chains:** at ~10 branches a chain is a registry expressed badly - `handlers[status]`, throw on unknown key. Extension-point angle: architecture.md ARCH 3.

## RULE 10 - No Dead Code

Delete commented-out code (git remembers) and logically unreachable branches. Unused vars/imports are linted; these two are on you.

## RULE 11 - Fail Fast, Fail Loud

Catch errors as close to their source as possible. Validate inputs at function entry - invalid data must not travel deep before exploding. Error messages include: what was expected, what was received, what the caller should do. Never signal errors with ambiguous values (`null`, `-1`, `false`) when the language has exceptions or Result types.

## RULE 12 - DRY: One Source of Truth per Piece of Knowledge

Every piece of knowledge - constant, validation rule, business calculation, type shape - has exactly ONE authoritative home.

- **Rule of three.** Two occurrences are a watch-flag; the THIRD must be extracted to a named constant, function, or module. Don't extract on first sight - the shape isn't known yet.
- **Knowledge, not character-similarity (AHA).** Look-alike snippets that change for different reasons are NOT duplication - keep them apart. A wrong abstraction costs more than the duplication it removed.
- **Across boundaries too.** A value needed in two files or languages (a color, an enum, a route) lives in one place; the other side imports/reads it - never re-hardcoded "for convenience".
- **Grep before writing a helper** - reuse beats rewrite. And when fixing a bug, search for the same mistake elsewhere: duplicated knowledge means duplicated bugs.

## RULE 13 - SOLID at the Module/File Level

RULE 3 is SRP for functions; this is SRP for files, plus the rest of SOLID. House positions:

- **S** - One primary export per file, file named after it (`createInvoice.ts` exports `createInvoice`). Split when concerns mix or "and" is needed to describe the file - don't wait for the 250-line cap.
- **O** - Extend by adding code (a dispatch-table entry, a module satisfying an interface), not by editing central code on every new case (ARCH 3).
- **L** - An implementation honors the contract of what it replaces - no surprise `throw`/`null`/narrowed behavior a caller can't see. If it can't fulfill the interface, it needs a different interface.
- **I** - Depend on the narrow surface actually used: pass `{ name }`, not the whole `User`.
- **D** - High-level policy never imports low-level detail (DB/HTTP/FS) directly; depend on an abstraction and inject the concrete adapter. This is what makes code testable (architecture.md ARCH 0; `tdd` skill).

Drive new behavior test-first: load the `tdd` skill (red -> green -> refactor) when adding a feature or fixing a bug - it bakes SRP and testable seams into the design.
