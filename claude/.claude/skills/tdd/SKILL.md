---
name: tdd
description: >-
  Test-driven development with red-green-refactor loop. Use when the user wants
  to build features or fix bugs using TDD, mentions "red-green-refactor", wants
  test-first development, or says "TDD". Enforces strict vertical slicing: one
  test, one implementation, repeat. Complements the "Testing Best Practices"
  and language-specific testing skills — load those too. This skill governs
  the WORKFLOW and MINDSET, not the test syntax.
---

# Test-Driven Development — Mandatory Rules

You are working in TDD mode. Every line of production code MUST be justified by a failing test. Follow the rules below without exception.

This skill governs **how you work** (the cycle, the discipline, the design). It does NOT replace the "Testing Best Practices" skill — both apply simultaneously.

---

## Philosophy

**Core principle**: Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

---

## THE CYCLE — Red / Green / Refactor

### Phase 1 — RED: Write a Failing Test

Write ONE test that describes a behavior the code does not yet support. Run it. **It MUST fail.** If it passes, either the behavior already exists (delete the test or rethink) or the test is broken (fix it).

**Rules:**
- The test asserts on the PUBLIC API — inputs and outputs. Not internals.
- The test name describes the behavior: `should reject negative amounts`, not `test1`.
- You MUST see a real **assertion failure**. Compile/import errors are NOT a valid red phase.

### Phase 2 — GREEN: Make It Pass

Write production code that makes the failing test pass. The implementation should be correct and intentional — not a placeholder.

**Rules:**
- Do NOT write code that no test requires. If no test is failing, you have no reason to write production code.
- Write a real, working implementation. Not a stub, not a hardcoded return value.
- Do NOT refactor here. Get to green, then refactor.
- Run ALL tests, not just the new one. Everything must stay green.

### Phase 3 — REFACTOR: Clean Up Under Green Tests

With all tests passing, improve the code's design without changing behavior.

**Rules:**
- Refactor ONLY when tests are green. **Never refactor while RED.**
- Remove duplication. Extract constants, helpers, abstractions.
- Deepen modules — move complexity behind simple interfaces.
- Apply SOLID principles where natural.
- Consider what new code reveals about existing code.
- Run tests after EVERY refactor step. If anything goes red, undo and take a smaller step.
- Refactor BOTH production code AND test code. Tests are code — they deserve the same quality.

---

## Anti-Pattern: Horizontal Slices

**FORBIDDEN: Writing all tests first, then all implementation.** This is "horizontal slicing" — treating RED as "write all tests" and GREEN as "write all code."

This produces crap tests:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes — they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

```
// FORBIDDEN (horizontal)
RED:   test1, test2, test3, test4, test5
GREEN: impl1, impl2, impl3, impl4, impl5

// MANDATORY (vertical — tracer bullets)
RED→GREEN: test1→impl1
RED→GREEN: test2→impl2
RED→GREEN: test3→impl3
```

**Each test responds to what you learned from the previous cycle.** Because you just wrote the code, you know exactly what behavior matters and how to verify it.

---

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for deep modules (see [deep-modules.md](deep-modules.md))
- [ ] Design interfaces for testability (see [interface-design.md](interface-design.md))
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behavior → test fails
GREEN: Write real implementation to pass → test passes
```

This is your tracer bullet — proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Implementation to pass → passes
REFACTOR: Clean up what you just wrote
```

Rules:
- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

### 4. Final Refactor

After all behaviors are covered, look for refactor candidates across the whole codebase touched. See [refactoring.md](refactoring.md).

---

## TDD ANTI-PATTERNS — EXPLICITLY FORBIDDEN

### 1. Horizontal Slicing (Write All Tests First)

FORBIDDEN: Writing all tests before any production code. Already covered above — the single most important rule.

### 2. Test-After (Pretending It's TDD)

FORBIDDEN: Writing production code first and tests after, then claiming TDD.

If the code already exists, you're writing regression tests — which is fine, but it's not TDD. Don't pretend.

### 3. The Guru Test

FORBIDDEN: Writing a massive test that exercises the entire feature at once.

```
// FORBIDDEN — one test tries to cover everything
it("processes a full order", () => {
  const user = createUser(...)
  const cart = addToCart(user, ...)
  applyDiscount(cart, ...)
  const order = checkout(cart)
  processPayment(order)
  sendConfirmation(order)
  expect(order.status).toBe("confirmed")
  expect(user.orders).toHaveLength(1)
  expect(emailService.sent).toHaveLength(1)
})
```

Break this into many small tests, each driving one piece of functionality.

### 4. Testing Implementation, Not Behavior

FORBIDDEN: Coupling tests to internal structure.

```
// FORBIDDEN — testing HOW
it("uses quicksort algorithm", () => {
  const spy = vi.spyOn(internals, "quicksort")
  sort([3, 1, 2])
  expect(spy).toHaveBeenCalled()
})

// MANDATORY — testing WHAT
it("returns elements in ascending order", () => {
  expect(sort([3, 1, 2])).toEqual([1, 2, 3])
})
```

### 5. Testing Private Methods

FORBIDDEN: Reaching into internals to test private implementation details.

```
// FORBIDDEN
it("_parseToken returns decoded payload", () => {
  expect(auth._parseToken(token)).toEqual(payload)
})

// MANDATORY — test through the public API
it("authenticates valid tokens", () => {
  expect(auth.authenticate(validToken)).toEqual({ userId: 1 })
})
```

If a private method is complex enough to need its own tests, extract it into its own module with a public API.

### 6. Skipping Refactor

FORBIDDEN: Going from green straight to the next red without considering refactoring.

If you skip refactor consistently, the codebase rots. Every cycle includes a refactoring evaluation — even if the conclusion is "nothing to improve right now."

### 7. Refactoring While Red

FORBIDDEN: Attempting to improve code while a test is failing.

```
// FORBIDDEN workflow:
// 1. Write test (RED)
// 2. Start implementing
// 3. "Oh, I should rename this function while I'm here"
// 4. Now 3 tests are broken and you don't know why

// MANDATORY workflow:
// 1. Write test (RED)
// 2. Make it pass (GREEN)
// 3. NOW rename, restructure, clean up (REFACTOR)
```

### 8. Mocking Internal Collaborators

FORBIDDEN: Mocking your own code unless it has side effects at system boundaries.

See [mocking.md](mocking.md) for full rules.

---

## COMMUNICATING THE CYCLE

When working in TDD mode, ALWAYS communicate which phase you're in:

```
RED — Writing test: "should return 0 for empty string"
Running test... FAILS ✓

GREEN — Implementing countWords
Running test... PASSES ✓

REFACTOR — Extracting constant, improving name
Running test... still PASSES ✓

RED — Next test: "should handle multiple spaces between words"
```

This transparency helps the user follow the TDD rhythm and catch deviations.

---

## WHEN TDD DOESN'T FIT

TDD is not always the right tool. Be honest about it:

- **Spike/prototype exploration**: When you don't know WHAT to build yet, spike first, throw the code away, then TDD the real thing.
- **Pure UI layout/styling**: Visual output is hard to assert meaningfully.
- **Trivial glue code**: One-line delegation functions that just wire things together.
- **Generated code**: Don't TDD code that's generated by tools.

When you skip TDD, be explicit about WHY. Never silently abandon the cycle.

---

## Checklist Per Cycle

- [ ] Test describes behavior, not implementation
- [ ] Test uses public interface only
- [ ] Test would survive internal refactor
- [ ] Code is a real implementation, not a placeholder
- [ ] No speculative features added
- [ ] Refactoring considered before next RED

---

## Quick Reference

| Principle | Rule |
|---|---|
| Production code without a failing test | FORBIDDEN |
| Writing multiple tests before implementing | FORBIDDEN — vertical slicing only |
| Refactoring with a failing test | FORBIDDEN |
| Skipping the refactor phase | FORBIDDEN |
| Testing private methods | FORBIDDEN — test public API |
| Mocking internal collaborators | FORBIDDEN — mock at boundaries only |
| Testing implementation instead of behavior | FORBIDDEN |
| Ugly code in green phase | ALLOWED — refactor phase cleans it |
| Deleting tests that no longer add value | ALLOWED — after refactoring merges behaviors |
