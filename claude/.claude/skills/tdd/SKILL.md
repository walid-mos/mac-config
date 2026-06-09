---
name: tdd
user-invocable: true
description: >-
  Test-driven development for bug fixes and new features. Use when the user
  wants to fix a bug "with TDD", says "reproduce the bug as a test first",
  mentions "red-green-refactor", or runs `/tdd`. Enforces strict vertical
  slicing: one failing test, one fix, all green, repeat. Complements `/test`
  (assertion rules) and language-specific testing skills (load those too).
---

# Test-Driven Development

**MANDATORY first step — load the test-quality skills.** At invocation, also load `/test` and the project's language-specific testing skill (`vitest`, `javascript`, `typescript`). TDD drives the RHYTHM; without test-quality rules it produces passing-but-wrong tests. This skill owns the WORKFLOW; `/test` owns the test quality.

Every line of production code MUST be justified by a failing test. The `/test` skill governs test quality; this skill governs the rhythm.

## Primary use case — bug fixing

The highest-leverage TDD loop is bug repair:

1. **Reproduce as a test** — write a test that calls the buggy public API and asserts the correct behavior. Run it. It MUST fail with the observed bug (a real assertion mismatch matching the user's report — not a compile error, not "function not found").
2. **Fix** — change production code until the new test passes. All other tests must stay green.
3. **Expand** — if the bug hints at adjacent untested behavior (same edge class, same code path), add one more failing test, then fix. Repeat until coverage matches the bug surface.
4. **Refactor under green** — once green, clean up the production code AND the new tests.

A bug fix without a reproducing test is a bug fix that will silently regress. The test IS the deliverable, not the patch.

## The cycle — RED / GREEN / REFACTOR

**RED**: write ONE test for behavior the code does not yet support (feature) or does incorrectly (bug). Run it. See a real **assertion failure**. Compile/import errors are NOT a valid red phase.

**GREEN**: write real production code to pass the failing test — not a stub, not a hardcoded value. Run ALL tests. Everything must stay green.

**REFACTOR**: with all tests green, improve design without changing behavior. Refactor production code AND test code. Run tests after every refactor step; if anything goes red, undo and take a smaller step.

**Never refactor while RED.**

## Vertical slicing only

```
// FORBIDDEN (horizontal — tests imagined behavior, outruns your headlights)
RED:   test1, test2, test3, test4
GREEN: impl1, impl2, impl3, impl4

// MANDATORY (vertical — each test responds to what the previous cycle taught)
RED→GREEN→REFACTOR: test1 + impl1
RED→GREEN→REFACTOR: test2 + impl2
```

Writing all tests upfront tests the *shape* you imagine, not the behavior that actually matters. Each cycle should respond to what you just learned.

## Communicating the cycle

State the phase at every step:

> RED — `should reject negative amounts`. Running... FAILS (asserts `amount > 0`, got `-5`)
> GREEN — adding validation. Running... PASSES
> REFACTOR — extracting `validateAmount` helper. Running... still PASSES
> RED — next: `should reject zero` ...

The transparency lets the user catch deviations from the cycle.

## Anti-patterns

1. **Test-after** — writing production code first then tests, claiming TDD. If the code already exists, you're writing regression tests, not TDD. Be honest.
2. **The Guru Test** — one massive test exercising the whole feature. Break into small ones, each driving one behavior.
3. **Testing implementation, not behavior** — spying on internal functions, asserting which algorithm was called. Test through the public API. Full rules in `/test`.
4. **Testing private methods** — if a private method is complex enough to need its own tests, that is a single-responsibility (SRP) signal: extract it into its own module with a public API and test that.
5. **Skipping refactor** — every green is a refactor opportunity. Skipping accumulates rot.
6. **Refactoring while red** — a failing test means stop the structural change, finish the current cycle first.
7. **Mocking internal collaborators** — mock at system boundaries only (network, FS, time, randomness). See `/test` mocking rules.

## Architectural mandates (what makes code TDD-able)

- **Pure core.** Business-logic decisions MUST be pure functions — no I/O, no side effects. Effects (network, FS, time, randomness) live at the shell. This is what makes the core testable without mocking. See [interface-design.md](interface-design.md) (functional core / imperative shell).
- **Single responsibility (SRP).** Every new function/module under TDD does ONE thing. If a test needs to reach inside, the unit is doing too much — split it.
- **Stay small enough to drive.** If the unit under test grows past ~30 LOC or branches more than ~4 ways, stop and extract before the next RED. Past that size, tests pass but the design stops improving — TDD fails silently.

## Forbidden vs Mandatory

| FORBIDDEN | MANDATORY |
| --- | --- |
| Writing any production code before a failing test exists | A real assertion failure (not compile/import error) before any GREEN |
| Entering the next RED while any test is red | All tests green before entering REFACTOR |
| Refactoring while RED | Refactor production code AND test code under green |
| Mocking collaborators that are not system boundaries (network, FS, time, randomness) | New functions/modules have a single responsibility (SRP) |
| Asserting which internal function/algorithm was called | Test through the public interface only |
| Claiming "TDD" when tests were written after the code | Be honest: code-first is regression testing, not TDD |
| Duplicating setup/assertions across tests (copy-pasted bodies) | Business-logic decisions are pure functions; effects at the shell |
| Cryptic test names | Name tests as documentation: `should <behavior> when <condition>` |

## When TDD doesn't fit

Be explicit about skipping rather than silently abandoning:

- **Spike / prototype** — don't know WHAT to build yet → spike, throw away, then TDD the real thing.
- **Pure UI layout / styling** — visual output resists meaningful assertion.
- **Trivial one-liner wiring** — pure pass-through glue with no logic or branching (not large codegen output, which must be tested).

## Design for testability

When a bug fix or new test forces you to redesign for testability, the load-bearing patterns are in sub-files:

- [interface-design.md](interface-design.md) — accept dependencies, return results not side effects, separate decisions from effects (functional core / imperative shell), deep vs shallow modules.
- [mocking.md](mocking.md) — SDK-style interfaces vs generic fetchers.

## Per-cycle checklist

- [ ] Test name reads as documentation (`should <behavior> when <condition>`)
- [ ] Test describes behavior, not implementation
- [ ] Test uses public interface only
- [ ] Test would survive an internal refactor
- [ ] No duplicated setup/assertions (shared helper, not copy-paste)
- [ ] Implementation is real, not a placeholder
- [ ] Unit under test has one responsibility, small enough to drive
- [ ] No speculative features added
- [ ] All tests green before next RED
