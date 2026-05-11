---
name: tdd
user-invocable: true
description: >-
  Test-driven development for bug fixes and new features. Use when the user
  wants to fix a bug "with TDD", says "reproduce the bug as a test first",
  mentions "red-green-refactor", or runs `/tdd`. Enforces strict vertical
  slicing: one failing test, one fix, all green, repeat. Complements `/test`
  (assertion rules) and language-specific testing skills (load those too).
  This skill owns the WORKFLOW; `/test` owns the test quality.
---

# Test-Driven Development

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
4. **Testing private methods** — if a private method is complex enough to need its own tests, extract it into its own module with a public API.
5. **Skipping refactor** — every green is a refactor opportunity. Skipping accumulates rot.
6. **Refactoring while red** — a failing test means stop the structural change, finish the current cycle first.
7. **Mocking internal collaborators** — mock at system boundaries only (network, FS, time, randomness). See `/test` mocking rules.

## When TDD doesn't fit

Be explicit about skipping rather than silently abandoning:

- **Spike / prototype** — don't know WHAT to build yet → spike, throw away, then TDD the real thing.
- **Pure UI layout / styling** — visual output resists meaningful assertion.
- **One-line glue / generated code** — nothing to test.

## Design for testability

When a bug fix or new test forces you to redesign for testability, the load-bearing patterns are in sub-files:

- [interface-design.md](interface-design.md) — accept dependencies, return results not side effects, separate decisions from effects (functional core / imperative shell).
- [deep-modules.md](deep-modules.md) — small interface + deep implementation (Ousterhout).
- [mocking.md](mocking.md) — SDK-style interfaces vs generic fetchers.

## Per-cycle checklist

- [ ] Test describes behavior, not implementation
- [ ] Test uses public interface only
- [ ] Test would survive an internal refactor
- [ ] Implementation is real, not a placeholder
- [ ] No speculative features added
- [ ] All tests green before next RED
