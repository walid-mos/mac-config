# LLM Test Anti-Patterns - Full Catalogue (4-10)

Patterns 1-3 (tautological tests, assert-free tests, snapshot worship) stay inline in SKILL.md. The patterns below are the less-frequently-violated, more detailed ones. All are EXPLICITLY FORBIDDEN.

## 4. Tests That Mirror Implementation

FORBIDDEN: Asserting that internal methods were called in a specific order. If renaming a private method breaks your test, the test is wrong.

## 5. Copy-Paste Test Farms

FORBIDDEN: Dozens of near-identical tests with trivially different inputs. Use parameterized tests (`test.each` / `it.each`) instead when testing the same behavior with different data.

## 6. Fabricated Expected Values

FORBIDDEN: Guessing what the expected output should be. If you don't know the correct expected value, say so. NEVER invent an expected value just to make the test pass.

## 7. Testing the Framework

FORBIDDEN: Writing tests that verify language features or framework behavior rather than application logic.

## 8. Manual `throw` or `return` Inside a Test Body

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

## 9. Inline File Generation Instead of Fixtures

FORBIDDEN: Using `writeFileSync` to create test input files inline. Put input data (TOML, JSON, YAML) in `fixtures/` files with descriptive names and load via a helper:

```
const fixture = (name: string): string => join(FIXTURES, name)
// Vitest; Jest equivalent: process.env stubbing or jest.replaceProperty
vi.stubEnv('PIPELINE_CONFIG_FILE', fixture('static-with-domain.toml'))
```

## 10. Generic Variable Names for Mock Data

FORBIDDEN: `call`, `args`, `result`, or indexed access (`call[0]`) on mock calls. Destructure into domain-specific names:

```
// Vitest/Jest mock shape (mockFn.mock.lastCall, Jest 28+)
const [url, init] = mock.mock.lastCall ?? []
```
