---
name: coding
description: >-
    Mandatory language-agnostic coding doctrine. MUST be loaded before any skill,
    workflow, or agent writes or modifies source or test code in any language.
    Prevents overengineering, controls scope, guides abstractions and tests, and
    treats quality metrics as repository-calibrated evidence rather than goals.
---

# Coding — Mandatory, Language-Agnostic

Apply this doctrine to every code change. Repository instructions and configured
quality gates remain authoritative. A lint or quality-gate violation is fixed in
code, never hidden with a suppression or a weaker threshold unless the user asks.

Load only when needed:

- [architecture.md](architecture.md) — when the change alters structure or
  responsibilities across files.
- [ops-discipline.md](ops-discipline.md) — when planning work;
  not for ordinary code authoring.

## 0. Establish the change boundary

Before editing, identify the requested behavior, acceptance evidence, non-goals,
and what must stay untouched. Ask only when an ambiguity would materially change
the result; otherwise choose the smallest reasonable interpretation.

Read the relevant implementation and tests directly. Do not infer behavior from
file names, search snippets, or conventions when the source can prove it. If the
request's premise conflicts with the source, state the mismatch and solve the
actual problem rather than coding around a false assumption.

Implement the minimum sufficient change. Every changed line must trace to the
request or be made obsolete by it. Do not reformat, refactor, rename, or clean up
unrelated code.

If the change grows beyond the obvious local solution, stop and re-check the
request. A larger diff needs evidence, not confidence.

## 1. No speculative machinery

Do not add a framework, configuration option, public API, dependency, or
generalized error handling for a case the current requirement does not contain.
The global greenfield policy is authoritative for migrations and historical
compatibility.

Do not introduce a wrapper, interface, factory, adapter, strategy, registry, or
helper for one current implementation or one call site unless it hides real
complexity at an existing boundary. One implementation behind one pass-through
abstraction is a deletion candidate.

Fix the smallest root cause. Do not stack patches, copies, parallel
implementations, or compensating layers around a defective path.

Prefer, in order: delete obsolete code, edit the existing owner, add the smallest
local code, then extract only after a real concept or repeated knowledge appears.
Designing for hypothetical future use is not part of the current task.

## 2. Keep control flow readable

Handle invalid and edge cases first with guard clauses. Keep the happy path at
natural indentation. Prefer early returns, `continue`/`break`, and named local
steps over nested conditionals.

A function should stay at one level of abstraction. Split mixed concerns, but do
not fragment readable straight-line logic merely to reduce a line count or metric.
An extraction must improve naming, cohesion, reuse, or testability enough to pay
for the new navigation cost.

Use a lookup or dispatch table only when the variants already present become
clearer than their conditional form. Do not create an extension point in
anticipation of variants that do not exist.

## 3. Name and model the domain

Use the repository's domain language. Names describe meaning, units, and intent,
not container types or implementation mechanics. Use verbs for actions and
question-shaped names for predicates. Avoid non-standard abbreviations.

Represent meaningful states explicitly with the language's types. Validate
untrusted data at the boundary, then pass validated values inward. Make invalid
states hard to construct rather than scattering defensive checks everywhere.

## 4. Keep state and effects controlled

Do not mutate caller-owned inputs or shared state. Prefer pure transformations;
keep justified local mutation local.

Separate computation from side effects. Perform database, network, filesystem,
logging, clock, and randomness work at the edges, without inventing an adapter
layer unless the current design needs a real substitution seam.

Fail near the source with an error that states what failed and relevant context.
Logging and rethrowing is allowed when the current boundary owns useful
observability context; preserve the original cause and stack. Never catch and
swallow an error unless ignoring it is an explicit business rule documented by a
nearby comment that explains why. Do not translate errors without adding meaning
or turn them into ambiguous sentinel values.

## 5. Remove waste without inventing abstractions

Ship no commented-out, unreachable, unused, duplicate, or superseded path. After
fixing a bug, search for the same defect pattern in the requested scope.

Keep one source of truth per piece of knowledge. Two similar occurrences are a
signal to compare; extract when repetition represents the same knowledge and has
a shared reason to change. Similar-looking code with different reasons to change
stays separate. A wrong abstraction costs more than small duplication.

Search for an existing owner before adding a helper, type, constant, or module.
Reuse it when its contract genuinely matches; do not distort it to force reuse.

## 6. Lock behavior with focused tests

Run existing tests to inspect the baseline. Once production behavior is stable,
write the smallest test set that locks externally observable behavior. Reuse the
existing test infrastructure and patterns; avoid assertions coupled to
implementation details. Run the focused tests and report the exact behavior
locked. Fix production mismatches rather than weakening assertions.

A bug fix needs a regression lock only when existing tests did not already fail on
the defect. Matrices, parameter grids, snapshots, end-to-end infrastructure, and
exhaustive edge cases require an explicit acceptance need. Test code must remain
simpler than the behavior it proves; never add a framework or production seam for
a trivial assertion.

Do not chase 100% coverage or zero surviving mutants unless the repository gate
or user requires it. Coverage reveals unexecuted code; mutation testing probes
assertion strength. Neither proves correctness, and both must be interpreted
against the changed risk.

## 7. Treat metrics as tripwires, not design targets

Use the repository's configured lint, type, complexity, duplication, dead-code,
coverage, and mutation tools. Repository gates and hard gates explicitly required
by an active workflow are authoritative; do not invent additional numbers or claim
a numeric score without running its tool. Prefer changed-code or delta gates when
available so existing debt does not expand the task and new debt cannot enter.

Cyclomatic complexity, cognitive complexity, Halstead difficulty, CRAP, lines of
code, coverage, and mutation score are diagnostic signals. Inspect the underlying
function or module when a gate fires. Satisfy a hard size gate by deleting waste,
simplifying, or splitting at a real ownership boundary—never with pass-through
files. Never weaken types or add tests with no behavioral value to improve a
number.

For TypeScript, `any` discards type safety and should be replaced with a real
contract. `unknown` is the correct safe type for untrusted values and caught
errors when it is narrowed before use; banning it would make boundaries less safe.

## 8. Design modules without SOLID ritual

Keep related knowledge together behind the smallest useful public surface. Add an
architectural seam only for current complexity or variation, never terminology or
future extensibility. When structure, ownership, or cross-file dependencies
change, load `architecture.md`; its evidence tests are authoritative.

## Pre-completion gate

Before reporting completion:

- inspect the diff and remove every unrelated line;
- justify every new file, dependency, public symbol, abstraction, and test against
  an acceptance criterion; delete anything without one;
- confirm no old path, duplicate implementation, debug code, or temporary fixture
  remains;
- run the narrowest repository-configured checks that prove the change, then the
  broader required gate when available.
