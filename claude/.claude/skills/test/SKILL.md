---
name: test
user-invocable: false
description: >-
  This skill MUST be loaded ANY TIME tests are being written, whether
  explicitly requested by the user ("write tests", "add tests", "test this",
  "cover this with tests") OR when the assistant decides on its own to write
  or modify tests. If you are about to create or edit a file matching
  *.test.* or *.spec.* patterns, you MUST load this skill first.
  It enforces strict testing quality rules to prevent common LLM
  testing anti-patterns.
---

# Testing Best Practices - Mandatory Rules

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

### 4. Tests That Mirror Implementation
FORBIDDEN: Asserting that internal methods were called in a specific order. If renaming a private method breaks your test, the test is wrong.

### 5. Copy-Paste Test Farms
FORBIDDEN: Dozens of near-identical tests with trivially different inputs. Use parameterized tests (`test.each` / `it.each`) instead when testing the same behavior with different data.

### 6. Fabricated Expected Values
FORBIDDEN: Guessing what the expected output should be. If you don't know the correct expected value, say so. NEVER invent an expected value just to make the test pass.

### 7. Testing the Framework
FORBIDDEN: Writing tests that verify language features or framework behavior rather than application logic.

### 8. Manual `throw` or `return` Inside a Test Body
FORBIDDEN: Using `throw new Error(...)`, early `return`, or `return Promise.reject(...)` to signal failure. The test runner fails a test when an `expect` assertion fails - no manual control flow is needed. Every failure path MUST be expressed through an assertion.
```
// FORBIDDEN - manual throw
it("validates input", () => {
  if (!result.valid) {
    throw new Error("should be valid"); // use an assertion instead
  }
});

// FORBIDDEN - early return silently skips assertions (test passes vacuously)
it("fetches user", async () => {
  const user = await getUser(1);
  if (!user) return;
  expect(user.name).toBe("Alice");
});

// CORRECT
it("validates input", () => {
  expect(result.valid).toBe(true);
});

it("fetches user", async () => {
  const user = await getUser(1);
  expect(user).not.toBeNull();
  expect(user.name).toBe("Alice");
});
```
When you need to assert a branch should/should not be reached, use the framework's assertion helpers (e.g. `expect(() => fn()).toThrow()`, `await expect(fn()).rejects.toThrow()`, or `expect.unreachable()` in Vitest). Never hand-roll failure with `throw`.

**Discriminated-union subjects - no `if (...) return` narrowing tricks.** When the subject is a tagged union (e.g. `{ ok: true; value } | { ok: false; errors }`), do NOT use `if (result.ok) return` as a TypeScript narrowing workaround. The runtime behavior is indistinguishable from the forbidden early-return pattern: if any `expect` above it is ever removed or reordered, the test silently passes while skipping the real assertions.

```
// FORBIDDEN - narrowing via early return
const result = parseConfig(input);
expect(result.ok).toBe(false);
if (result.ok) return; // vacuous-pass trap
expect(result.errors).toEqual(["bad key"]);

// PREFERRED - single whole-shape assertion, no narrowing needed
expect(parseConfig(input)).toEqual({
  ok: false,
  errors: ["bad key"],
});
```

If the test legitimately needs different matchers per field (e.g. `toContain` on one, `toMatchObject` on another), use the framework's type-narrowing assertion helper (`expect.unreachable()` in Vitest) in the wrong branch - never a manual `return` or `throw`.

### 9. Inline File Generation Instead of Fixtures
FORBIDDEN: Using `writeFileSync` to create test input files inline when the project has a fixtures directory. Use real fixture files - they're readable, reusable, and don't pollute tests with data construction noise.
```
// FORBIDDEN - inline file generation
writeFileSync(configFile, '[project]\nname = "my-site"\ntype = "static"\n')
await myCommand()

// FORBIDDEN - even worse: array join
writeFileSync(configFile, ['[project]', 'name = "my-site"', 'type = "static"'].join('\n'))

// CORRECT - use fixture files
const FIXTURES = join(import.meta.dirname, '../config/fixtures')
const fixture = (name: string): string => join(FIXTURES, name)

vi.stubEnv('PIPELINE_CONFIG_FILE', fixture('static-with-domain.toml'))
await myCommand()
```
If a test needs input data that lives in files (config files, JSON, YAML, etc.), create a fixture file in the appropriate `fixtures/` directory. Each fixture has a descriptive name that documents the scenario it covers.

### 10. Generic Variable Names for Mock Data
FORBIDDEN: Using meaningless names like `call`, `args`, `result`, or indexed access (`call[0]`, `call[1]`) when extracting data from mock calls. Always destructure into descriptive, domain-specific variable names.
```
// FORBIDDEN - generic name, indexed access
const call = mock.mock.lastCall
if (!call) throw new Error('No calls recorded')
return [String(call[0]), call[1]]

// CORRECT - destructure into meaningful names
const [url, init] = mock.mock.lastCall ?? []
if (!url) throw new Error('No calls recorded')
return [String(url), init]
```

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
