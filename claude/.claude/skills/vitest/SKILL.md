---
name: vitest
user-invocable: false
description: >-
  Vitest-specific patterns, APIs, and anti-patterns. Load when the project has
  vitest in package.json or when creating/editing *.test.ts, *.test.tsx,
  *.spec.ts, *.spec.tsx files in a JS/TS project. Must be used alongside the
  "test" skill.
---

# Vitest-Specific Rules

These rules supplement the global `test` skill (test-quality doctrine). Both apply simultaneously. For the red-green-refactor workflow, also load the `tdd` skill.

## Quick reference

| MANDATORY | FORBIDDEN |
| --- | --- |
| Explicit imports from `vitest` (unless `globals: true`) | Bare `vi.mock("./mod")` auto-mock when you need one fn |
| `vi.mock()` factory + `importOriginal`, override selectively | Mocking the module/function under test |
| `vi.spyOn()` over `vi.mock()` when the real impl can run | `expect(...).resolves/.rejects` without `await` |
| Restore mocks/timers in `afterEach` (or `restoreMocks: true`) | Fake timers / spies left un-restored between tests |
| `mockResolvedValue`/`mockRejectedValue` for async mocks | `mockReturnValue(Promise.resolve(...))` for async |
| Sequential `test`/`it` for shared mutable state | `test.concurrent` with shared state / `vi.mock()` side-effects |
| Assert specific fields | Snapshotting large objects / API responses / error messages |

## Imports

Always use explicit imports from `vitest`. Never rely on globals unless the project's `vitest.config` has `globals: true`.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

## Mocking with `vi`

### `vi.mock()` - Module Mocking

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
- `importOriginal` is the factory argument shown above; `vi.importActual("./mod")` is the standalone equivalent for grabbing the real module outside a factory. Prefer `importOriginal` inside `vi.mock()`.
- If you need variables declared outside the factory, use `vi.hoisted()`:

```ts
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("./api", () => ({
  apiFetch: mocks.fetch,
}));
```

### `vi.spyOn()` - Prefer Over `vi.mock()` When Possible

- Use `vi.spyOn()` to observe calls while keeping the real implementation:

```ts
const spy = vi.spyOn(userService, "validate");
// real implementation runs, but you can assert on calls
expect(spy).toHaveBeenCalledWith(userData);
```

- Always call `spy.mockRestore()` in `afterEach`, or use `vi.restoreAllMocks()`.

### Configuring `vi.fn()` Return Values

Configure mock functions with these instead of hand-rolling implementations:

```ts
const fn = vi.fn();
fn.mockReturnValue(42);             // sync value
fn.mockResolvedValue(user);         // resolves a Promise
fn.mockRejectedValue(new Error()); // rejects a Promise
fn.mockImplementation((x) => x * 2); // only when behavior matters
```

- Prefer `mockResolvedValue` / `mockRejectedValue` over `mockReturnValue(Promise.resolve(...))`.
- Use `mockReturnValueOnce` / `mockResolvedValueOnce` to queue per-call results.
- Reach for `mockImplementation` only when the value depends on arguments; for fixed values use the simpler variants.

### Mock Cleanup - MANDATORY

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
// CORRECT - always await
it("fetches user", async () => {
  const user = await getUser(1);
  expect(user.name).toBe("Alice");
});

// CORRECT - testing rejections
it("rejects on invalid id", async () => {
  await expect(getUser(-1)).rejects.toThrow(ValidationError);
});
```

### Common Async Pitfall - FORBIDDEN

```ts
// FORBIDDEN - missing await, test always passes
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

Use `describe.each` for matrix-style suites that need shared setup or multiple assertions per case:

```ts
describe.each([
  { role: "admin", canEdit: true },
  { role: "viewer", canEdit: false },
])("permissions for $role", ({ role, canEdit }) => {
  it("controls editing", () => {
    expect(can(role, "edit")).toBe(canEdit);
  });
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

Don't abuse this - only use type tests when the type contract is part of the public API.

## Snapshot Rules

- **Inline snapshots** (`toMatchInlineSnapshot()`) are acceptable for small, stable values.
- **File snapshots** (`toMatchSnapshot()`) are acceptable ONLY for stable UI output (component rendering).
- **Never snapshot large objects, API responses, or error messages.** Assert on specific fields instead.
- If you write a snapshot test, verify the snapshot content makes sense. Don't blindly accept generated snapshots.

## Coverage Config

If coverage is enabled, set explicit thresholds — enabling coverage without thresholds reports numbers no one enforces:

```ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8", // default; "istanbul" only if you need its instrumentation
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

## Vitest Anti-Patterns - FORBIDDEN

### 1. Over-mocking with bare `vi.mock()`
```ts
// FORBIDDEN - auto-mocks everything, tests become meaningless
vi.mock("./userService");
vi.mock("./database");
vi.mock("./logger");
```

### 2. Mocking What You're Testing
```ts
// FORBIDDEN - you're testing a mock, not the real code
vi.mock("./calculator");
import { add } from "./calculator";
it("adds", () => {
  (add as Mock).mockReturnValue(5);
  expect(add(2, 3)).toBe(5); // congratulations, you tested vi.fn()
});
```

### 3. Missing `await` on Async Assertions
```ts
// FORBIDDEN - passes even if the promise rejects
it("works", () => {
  expect(asyncFn()).resolves.toBe(value); // NOT awaited
});
```

### 4. Timer Leaks
```ts
// FORBIDDEN - no cleanup
beforeEach(() => {
  vi.useFakeTimers();
});
// Missing: afterEach(() => vi.useRealTimers())
```

### 5. Ignoring `mockRestore`
```ts
// FORBIDDEN - spy leaks to next test
const spy = vi.spyOn(console, "error").mockImplementation(() => {});
// Missing: afterEach cleanup
```

### 6. `test.concurrent` with Shared Mutable State
```ts
// FORBIDDEN - concurrent tests racing on shared state / vi.mock() side-effects
test.concurrent("a", () => { sharedCounter++; expect(sharedCounter).toBe(1); });
test.concurrent("b", () => { sharedCounter++; expect(sharedCounter).toBe(2); });
```
Never use `test.concurrent` when tests share module-level mutable state, mocks, fake
timers, or any `vi.mock()` side-effect. Run such suites sequentially (plain `test`/`it`).
`test.concurrent` is only safe for fully isolated, side-effect-free tests.

### 7. Error Assertions - Use Vitest Matchers

```ts
// async rejection
await expect(getUser(-1)).rejects.toThrow(ValidationError);

// sync throw
expect(() => parseConfig("")).toThrow(ConfigError);
```

See the `test` skill for the universal ban on the manual `throw` / early-`return` assertion pattern and the discriminated-union narrowing patterns (`expect.unreachable` + whole-shape `toEqual`).

## Astro - Container API

When testing Astro components (`.astro` files) or API endpoints, use the Astro Container API with Vitest. Covers `renderToString`, `renderToResponse`, props, slots, locals, params, framework renderers, and endpoints.

See [astro.md](astro.md) for full guide.

## Conventions

- **Co-locate** test files next to source (`src/utils/parser.ts` -> `src/utils/parser.test.ts`), unless the project already uses another convention (e.g. `__tests__/`) — always follow the existing one.
- **One module per test file.** When a test file grows to cover several modules, split it to mirror the source structure.
- **Test through the public API.** Import the module's exported surface, never reach into internal helpers across layers.
- **DRY setup**, not DRY assertions: factor repeated arrange steps into a `beforeEach` factory or a local builder helper; keep each test's assertions explicit and inline.
- To run a single failing test during a red-green loop, use `test.only` / `it.only` (remove before commit) or filter by file: `npx vitest run path/to/file.test.ts`.
