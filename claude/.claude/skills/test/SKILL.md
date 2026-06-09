---
name: test
user-invocable: false
description: >-
  Enforces LLM-proof test-quality rules. Use whenever writing or modifying
  tests: user request ("write/add/cover tests") OR assistant is about to
  create/edit any *.test.* or *.spec.* file.
---

# Testing Best Practices - Mandatory Rules

This skill owns test QUALITY. Also load: the project's language testing skill (e.g. `/vitest` when vitest is in `package.json`); `/tdd` if you are writing tests BEFORE the implementation (red-green-refactor). Global rules (em-dash ban, greenfield, verify-in-code-before-asking) live in the user's CLAUDE.md.

## Golden Rule

**Test behavior, not implementation.** Assert on public API outputs, return values, side effects, and observable state changes. Never assert on internal method calls, private state, or execution order.

## Structure

- **One concept per test.** Each test verifies exactly one behavior. No mega-tests.
- **Name tests as behavior specifications.** Use descriptive names that explain the expected behavior: `should reject expired tokens`, `returns empty array when no results found`. Never use `test1`, `testFunction`, or vague names.
- **AAA pattern.** Structure every test as Arrange / Act / Assert. Separate the three sections visually.
- **Group with `describe` blocks.** Group tests by unit/feature, not by method name. Use nesting for sub-behaviors.

## Test File Structure

- **One test file per module under test (SRP).** Mirror the source layout; no mega test file covering an entire feature across many modules. When a test file grows past ~150 lines, split it along the module boundaries it covers (clean splitting = `/coding` RULE 13).
- **Shared setup goes in typed helpers.** Extract repeated mock factories / fixture loaders into a dedicated `test-helpers/` (or `__mocks__/`) file, typed, reused across tests. Inline one-off setup; factor out anything used by 2+ tests (DRY = `/coding` RULE 12).
- **Test body max ~20 lines.** If a test body exceeds that, extract the Arrange step into a helper. No nested `if`/loops inside a test body.
- **Never import from another test file.** Shared code lives in a non-`.test`/`.spec` helper module, never in another test file (avoids circular test-helper coupling).

## Assertions

- **Every test MUST have at least one meaningful assertion.** A test with no assertions or only `toBeTruthy()`/`toBeDefined()` on a non-nullable value is worthless. Delete it.
- **Assert on specific values.** Use `toBe(5)`, `toEqual({id: 1, name: "foo"})`, `toThrow(SpecificError)`. Never use `toBeTruthy()`, `toBeDefined()`, or `toMatchObject({})` as lazy catch-alls.
- **Assert on error types AND messages.** When testing error paths, verify the specific error type and message, not just that "something was thrown".

## Coverage Requirements

For every happy path, you MUST also write:

1. **At least one error/failure case** - what happens when the operation fails?
2. **At least one boundary/edge case** - empty input, null, zero, max values, empty arrays, single-element arrays
3. **At least one invalid input case** - wrong type, missing required fields, malformed data

If you cannot identify edge cases, state that explicitly rather than skipping them silently.

## Mocking Rules - STRICT

- **Mock ONLY at system boundaries** - network calls, databases, filesystem, external APIs, time/date.
- **Never mock the code under test.** If you're mocking the function you're testing, the test is useless.
- **Never mock first-party code** unless it has side effects (DB writes, network calls). Use real implementations.
- **Prefer fakes over mocks.** In-memory implementations > mock objects. They catch more real bugs.
- **Every mock must be justified.** If you add a mock, add a comment explaining WHY it's mocked (what side effect it prevents).

## Layer Discipline

- **A unit test must not cross an architectural layer boundary.** No real DB calls, no HTTP, no filesystem, no clock - fake/mock those at the boundary (see Mocking Rules).
- **Integration tests that span layers are explicit.** Label them as integration and place them in a separate directory (e.g. `tests/integration/`). Never disguise a multi-layer integration test as a unit test.

## LLM Anti-Patterns - EXPLICITLY FORBIDDEN

These are patterns that LLMs generate constantly. You MUST NOT do any of these:

### 1. Tautological Tests
FORBIDDEN: Reimplementing production logic in the test to compute the expected value.
```
// FORBIDDEN - this just re-implements the function
test("adds numbers", () => {
  const a = 2, b = 3;
  expect(add(a, b)).toBe(a + b); // tautology!
});
// CORRECT - use a known, hardcoded expected value
test("adds numbers", () => {
  expect(add(2, 3)).toBe(5);
});
```

### 2. Assert-Free Tests
FORBIDDEN: Tests that just call code without asserting anything meaningful.
```
// FORBIDDEN
test("processes data", () => {
  const result = processData(input);
  expect(result).toBeDefined(); // everything is "defined"
});
```

### 3. Snapshot Worship
FORBIDDEN: Generating snapshot tests for complex objects you don't fully understand. Snapshots are only acceptable for stable, well-understood UI output.

Patterns 4-10 are equally forbidden but less frequently violated. Before writing tests, read the full forbidden-pattern catalogue in `anti-patterns.md`: 4 mirror-implementation, 5 copy-paste farms, 6 fabricated expected values, 7 testing the framework, 8 manual `throw`/early-`return` (+ discriminated-union narrowing trap), 9 inline file generation vs fixtures, 10 generic mock-data names.

## Test Isolation

- **No test may depend on another test.** Every test must pass when run alone, in any order.
- **No shared mutable state.** Use `beforeEach` to create fresh state for each test.
- **Clean up side effects.** If a test modifies global state, restore it in `afterEach`.
- **No hardcoded environment assumptions.** Don't depend on specific file paths, timestamps, locales, or timezone.

## Async Testing

- **Always `await` async operations.** Missing `await` causes tests to pass vacuously.
- **Test rejection cases.** For every async happy path, test the rejection/error path.
- **Handle timeouts explicitly.** Set per-test timeouts for slow async tests rather than relying on defaults: Vitest/Jest take a timeout as the third arg to `it`/`test` (e.g. `it("name", async () => {...}, 10_000)`); Jest also has `jest.setTimeout(ms)` at file scope.

## Before Finishing (mandatory)

1. **Run the tests.** Tests are not done until they execute and pass.
2. **Verify each test can fail.** Confirm (by actually breaking the production code, or by inspecting that every assertion is load-bearing) that a regression would make the test red. A test that passes no matter what is worthless - delete or fix it.
3. **Every exported public function has at least one test.** Coverage breadth across the module, not just depth per test.

## Quick Reference

| FORBIDDEN | MANDATORY |
| --- | --- |
| Asserting internal calls, private state, execution order | Assert public API outputs / side effects / observable state |
| `toBeTruthy()` / `toBeDefined()` / empty `toMatchObject({})` as catch-alls | Specific values: `toBe`, `toEqual`, `toThrow(SpecificError)` |
| Test with no meaningful assertion | At least one load-bearing assertion per test |
| Manual `throw` / early `return` / `if (...) return` narrowing to signal failure | Express every failure path through an assertion |
| Mocking the code under test or first-party pure code | Mock only system boundaries (network, DB, FS, time); prefer fakes |
| Unit test that hits real DB/HTTP/FS/clock | Fake the boundary; label cross-layer tests as integration, separate dir |
| Reimplementing prod logic / fabricating expected values | Known, hardcoded expected values |
| Snapshot tests of objects you don't fully understand | Snapshots only for stable, well-understood UI output |
| Copy-paste near-identical tests | `test.each` / `it.each` |
| Mega test file across many modules; importing from another test file | One test file per module; shared setup in a typed helper module |
| Tests depending on order / shared mutable state | Fresh state per test (`beforeEach`), clean up in `afterEach` |
| Shipping tests without running them or proving they can fail | Run + verify-can-fail + every public function covered |
