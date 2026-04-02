---
name: Testing Best Practices
description: >-
  This skill MUST be loaded ANY TIME tests are being written, whether
  explicitly requested by the user ("write tests", "add tests", "test this",
  "cover this with tests") OR when the assistant decides on its own to write
  or modify tests. If you are about to create or edit a file matching
  *.test.* or *.spec.* patterns, you MUST load this skill first.
  It enforces strict testing quality rules to prevent common LLM
  testing anti-patterns.
---

# Testing Best Practices — Mandatory Rules

You are writing tests. Follow every rule below without exception. These rules exist because LLMs have well-documented failure modes when generating tests. You MUST actively resist these patterns.

## Golden Rule

**Test behavior, not implementation.** Assert on public API outputs, return values, side effects, and observable state changes. Never assert on internal method calls, private state, or execution order.

## Structure

- **One concept per test.** Each test verifies exactly one behavior. No mega-tests.
- **Name tests as behavior specifications.** Use descriptive names that explain the expected behavior: `should reject expired tokens`, `returns empty array when no results found`. Never use `test1`, `testFunction`, or vague names.
- **AAA pattern.** Structure every test as Arrange / Act / Assert. Separate the three sections visually.
- **Group with `describe` blocks.** Group tests by unit/feature, not by method name. Use nesting for sub-behaviors.

## Assertions

- **Every test MUST have at least one meaningful assertion.** A test with no assertions or only `toBeTruthy()`/`toBeDefined()` on a non-nullable value is worthless. Delete it.
- **Assert on specific values.** Use `toBe(5)`, `toEqual({id: 1, name: "foo"})`, `toThrow(SpecificError)`. Never use `toBeTruthy()`, `toBeDefined()`, or `toMatchObject({})` as lazy catch-alls.
- **Assert on error types AND messages.** When testing error paths, verify the specific error type and message, not just that "something was thrown".

## Coverage Requirements

For every happy path, you MUST also write:

1. **At least one error/failure case** — what happens when the operation fails?
2. **At least one boundary/edge case** — empty input, null, zero, max values, empty arrays, single-element arrays
3. **At least one invalid input case** — wrong type, missing required fields, malformed data

If you cannot identify edge cases, state that explicitly rather than skipping them silently.

## Mocking Rules — STRICT

- **Mock ONLY at system boundaries** — network calls, databases, filesystem, external APIs, time/date.
- **Never mock the code under test.** If you're mocking the function you're testing, the test is useless.
- **Never mock first-party code** unless it has side effects (DB writes, network calls). Use real implementations.
- **Prefer fakes over mocks.** In-memory implementations > mock objects. They catch more real bugs.
- **Every mock must be justified.** If you add a mock, add a comment explaining WHY it's mocked (what side effect it prevents).

## LLM Anti-Patterns — EXPLICITLY FORBIDDEN

These are patterns that LLMs generate constantly. You MUST NOT do any of these:

### 1. Tautological Tests
FORBIDDEN: Reimplementing production logic in the test to compute the expected value.
```
// FORBIDDEN — this just re-implements the function
test("adds numbers", () => {
  const a = 2, b = 3;
  expect(add(a, b)).toBe(a + b); // tautology!
});
// CORRECT — use a known, hardcoded expected value
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

### 4. Tests That Mirror Implementation
FORBIDDEN: Asserting that internal methods were called in a specific order. If renaming a private method breaks your test, the test is wrong.

### 5. Copy-Paste Test Farms
FORBIDDEN: Dozens of near-identical tests with trivially different inputs. Use parameterized tests (`test.each` / `it.each`) instead when testing the same behavior with different data.

### 6. Fabricated Expected Values
FORBIDDEN: Guessing what the expected output should be. If you don't know the correct expected value, say so. NEVER invent an expected value just to make the test pass.

### 7. Testing the Framework
FORBIDDEN: Writing tests that verify language features or framework behavior rather than application logic.

## Test Isolation

- **No test may depend on another test.** Every test must pass when run alone, in any order.
- **No shared mutable state.** Use `beforeEach` to create fresh state for each test.
- **Clean up side effects.** If a test modifies global state, restore it in `afterEach`.
- **No hardcoded environment assumptions.** Don't depend on specific file paths, timestamps, locales, or timezone.

## Async Testing

- **Always `await` async operations.** Missing `await` causes tests to pass vacuously.
- **Test rejection cases.** For every async happy path, test the rejection/error path.
- **Handle timeouts explicitly.** Set appropriate timeouts for async tests; don't rely on defaults.

## Before Finishing

- **Run the tests.** Never consider tests done until they execute and pass.
- **Verify tests can fail.** Mentally (or actually) confirm that breaking the production code would cause the test to fail. If a test passes no matter what, it's worthless.
