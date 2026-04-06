---
name: vitest
user-invocable: false
description: >-
  This skill MUST be used IN ADDITION to the "Testing Best Practices" skill
  when the project uses Vitest. It activates when the user asks to write tests
  in a project with vitest in package.json, or when creating/editing files
  matching *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx in a JS/TS project.
  Provides Vitest-specific patterns, API usage, and anti-patterns.
---

# Vitest-Specific Rules

These rules supplement the global "Testing Best Practices" skill. Both apply simultaneously.

## Imports

Always use explicit imports from `vitest`. Never rely on globals unless the project's `vitest.config` has `globals: true`.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

## Mocking with `vi`

### `vi.mock()` — Module Mocking

- `vi.mock()` is **hoisted** to the top of the file. It runs before all imports regardless of where you write it.
- Always use `vi.mock()` with a **factory function** when you need custom behavior. The bare `vi.mock("./module")` auto-mocks everything, which over-mocks.
- To access the original module inside a factory, use `importOriginal`:

```ts
vi.mock(import("./userService"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchUser: vi.fn(), // only mock what you need
  };
});
```

- **Never mock the entire module when you only need one function.** Spread the original and override selectively.
- If you need variables declared outside the factory, use `vi.hoisted()`:

```ts
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("./api", () => ({
  apiFetch: mocks.fetch,
}));
```

### `vi.spyOn()` — Prefer Over `vi.mock()` When Possible

- Use `vi.spyOn()` to observe calls while keeping the real implementation:

```ts
const spy = vi.spyOn(userService, "validate");
// real implementation runs, but you can assert on calls
expect(spy).toHaveBeenCalledWith(userData);
```

- Always call `spy.mockRestore()` in `afterEach`, or use `vi.restoreAllMocks()`.

### Mock Cleanup — MANDATORY

```ts
afterEach(() => {
  vi.restoreAllMocks();
});
```

Or configure globally in `vitest.config`:
```ts
export default defineConfig({
  test: {
    restoreMocks: true,
  },
});
```

Never skip mock cleanup. Leaking mocks between tests is a top cause of flaky tests.

## Timers

When testing code that uses `setTimeout`, `setInterval`, or `Date.now`:

```ts
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("debounces calls", () => {
  trigger();
  vi.advanceTimersByTime(300);
  expect(callback).toHaveBeenCalledOnce();
});
```

- **Always restore real timers** in `afterEach`. Fake timers leaking to other tests cause mysterious failures.

## Async Patterns

### Testing Promises

```ts
// CORRECT — always await
it("fetches user", async () => {
  const user = await getUser(1);
  expect(user.name).toBe("Alice");
});

// CORRECT — testing rejections
it("rejects on invalid id", async () => {
  await expect(getUser(-1)).rejects.toThrow(ValidationError);
});
```

### Common Async Pitfall — FORBIDDEN

```ts
// FORBIDDEN — missing await, test always passes
it("fetches user", () => {
  expect(getUser(1)).resolves.toBeDefined(); // no await!
});
```

The `expect(...).resolves` chain MUST be awaited. Without `await`, the test completes before the promise settles and passes vacuously.

## Parameterized Tests

Use `it.each` for testing the same behavior with different data instead of copy-pasting tests:

```ts
it.each([
  { input: "", expected: false },
  { input: "a", expected: false },
  { input: "valid@email.com", expected: true },
  { input: "no-at-sign.com", expected: false },
])("isValidEmail($input) returns $expected", ({ input, expected }) => {
  expect(isValidEmail(input)).toBe(expected);
});
```

## Type Testing

When testing TypeScript types, use `expectTypeOf`:

```ts
import { expectTypeOf } from "vitest";

it("returns a string", () => {
  expectTypeOf(fn()).toBeString();
});
```

Don't abuse this — only use type tests when the type contract is part of the public API.

## Snapshot Rules

- **Inline snapshots** (`toMatchInlineSnapshot()`) are acceptable for small, stable values.
- **File snapshots** (`toMatchSnapshot()`) are acceptable ONLY for stable UI output (component rendering).
- **Never snapshot large objects, API responses, or error messages.** Assert on specific fields instead.
- If you write a snapshot test, verify the snapshot content makes sense. Don't blindly accept generated snapshots.

## Vitest Anti-Patterns — FORBIDDEN

### 1. Over-mocking with bare `vi.mock()`
```ts
// FORBIDDEN — auto-mocks everything, tests become meaningless
vi.mock("./userService");
vi.mock("./database");
vi.mock("./logger");
```

### 2. Mocking What You're Testing
```ts
// FORBIDDEN — you're testing a mock, not the real code
vi.mock("./calculator");
import { add } from "./calculator";
it("adds", () => {
  (add as Mock).mockReturnValue(5);
  expect(add(2, 3)).toBe(5); // congratulations, you tested vi.fn()
});
```

### 3. Missing `await` on Async Assertions
```ts
// FORBIDDEN — passes even if the promise rejects
it("works", () => {
  expect(asyncFn()).resolves.toBe(value); // NOT awaited
});
```

### 4. Timer Leaks
```ts
// FORBIDDEN — no cleanup
beforeEach(() => {
  vi.useFakeTimers();
});
// Missing: afterEach(() => vi.useRealTimers())
```

### 5. Ignoring `mockRestore`
```ts
// FORBIDDEN — spy leaks to next test
const spy = vi.spyOn(console, "error").mockImplementation(() => {});
// Missing: afterEach cleanup
```

## Astro — Container API

When testing Astro components (`.astro` files) or API endpoints, use the Astro Container API with Vitest. Covers `renderToString`, `renderToResponse`, props, slots, locals, params, framework renderers, and endpoints.

See [astro.md](astro.md) for full guide.

## File Naming and Location

- Co-locate test files next to source: `src/utils/parser.ts` -> `src/utils/parser.test.ts`
- Unless the project has an existing convention (e.g., `__tests__/` directory) — always follow existing conventions.

## Running Tests

- Use the project's configured test command (usually `npm test`, `pnpm test`, etc.)
- For running a specific file: `npx vitest run src/utils/parser.test.ts`
- For watch mode during development: `npx vitest src/utils/parser.test.ts`
- Always check `package.json` and `vitest.config.*` for project-specific configuration before running.
