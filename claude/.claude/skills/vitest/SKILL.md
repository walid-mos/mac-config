---
name: vitest
description: Vitest testing standards. Use when writing or reviewing test files (.test.ts, .spec.ts, .test.tsx).
user-invocable: false
---

# Vitest Standards

## Philosophy

- A test exists to prevent a **real regression** — if it can't break when behavior breaks, delete it
- Test behavior and outcomes, NEVER implementation details
- If a test breaks on refactor without behavior change — it's a bad test, delete it
- Less tests with high value > many tests with low value
- Every test must answer: "What user-visible or business-critical behavior does this protect?"

## What to Test (Worth It)

- **Business logic / pure functions**: calculations, transformations, validation rules, state machines
- **Edge cases**: empty inputs, boundary values, null/undefined, overflow, unicode, concurrent calls
- **Error paths**: what happens when things fail — error messages, fallback behavior, recovery
- **Integration points**: API call → state update → correct output (mock the network, test the flow)
- **Complex conditionals**: if a function has 3+ branches, each branch deserves a test
- **Regressions**: every bug fix gets a test that would have caught the bug
- **Custom hooks**: state transitions, side effect ordering, cleanup behavior
- **User interactions** (component tests): click → outcome, submit → validation, type → filtered results

## What NOT to Test (Waste of Time)

- NEVER test that a CSS/Tailwind class is applied — that's testing the template engine
- NEVER test that a component renders without crashing — if it doesn't render, you'll know
- NEVER test prop forwarding (`<Child title={title} />` then assert Child got title)
- NEVER test static text content ("renders the correct heading")
- NEVER test that a library works (React renders, router routes, i18n translates)
- NEVER test type correctness — that's TypeScript's job
- NEVER test 1:1 mirrors of implementation (copy-pasting the function logic into the test)
- NEVER test trivial getters/setters or simple wrappers
- NEVER write a test just to increase coverage — coverage is a side effect, not a goal
- NEVER test documentation files (docs/, *.md, README, CHANGELOG, specs, guides) — docs are prose, not testable code
- NEVER test CI/CD pipelines, build configs, or deployment scripts — these are validated by running them, not by unit tests
- NEVER test infrastructure code (Terraform, Dagger modules, Docker configs) with unit tests — infra is tested by deploying it
- NEVER test static config files (tsconfig, eslint, vite.config, etc.) — the tool that consumes the config validates it
- NEVER test that config values haven't changed (snapshot-testing a config = test that breaks on every legitimate update)
- NEVER test simple re-exports, type aliases, or constant declarations

## Resilience Rules

- NEVER assert on exact config values, version strings, or counts that change with normal project evolution
- NEVER write tests that assert "nothing was added/removed/changed" — these break on every legitimate update and provide zero regression protection
- Prefer asserting on **behavior** ("calling X with Y produces Z") over **structure** ("object has exactly these 5 keys")
- Use `expect.objectContaining()` and `expect.arrayContaining()` to test what matters without breaking on additions
- If a test would break when a teammate adds a new feature/option/field, it's a bad test — delete it

## Decision Framework

Before writing any test, pass ALL 4 gates:

1. **Can this break?** If the code is trivial or type-safe, skip it
2. **Will this catch a real bug?** If only a copy-paste of the implementation would fail, skip it
3. **Is this the right testing level?** Unit for logic, integration for flows, E2E for critical paths
4. **Is this resilient to refactors?** If renaming a variable or moving a div breaks it, skip it

## Component Testing (React Testing Library)

- Query by **role, label, placeholder, text** — NEVER by test-id unless no accessible alternative
- `test-id` is a last resort, not a default — if you need it, the component likely has an a11y issue
- Test user workflows: "user types email → clicks submit → sees success message"
- NEVER assert on DOM structure, element count, or class names
- `userEvent` over `fireEvent` — always (closer to real user behavior)
- NEVER snapshot test components — they break on every change, nobody reads the diff
- Mock API responses at the network level (`msw`) — NEVER mock React hooks directly

## Mocking

- Mock ONLY external boundaries: network, filesystem, timers, randomness, dates
- Pure functions and business logic stay real — NEVER mock them
- ALWAYS clean up: `vi.restoreAllMocks()` in `afterEach`
- ALWAYS `vi.useRealTimers()` in `afterEach` when using fake timers
- `vi.hoisted()` for shared module-level mocks
- Prefer dependency injection over `vi.mock()` — easier to test, easier to read
- If you mock more than 2 things in a test, the unit is too coupled — refactor the code
- **3-mock threshold**: If a test requires 3+ mocks, add `// WARNING: over-mocked — code coupling issue, consider refactoring` and flag to team lead

## Assertions

- Specific assertions: `toHaveBeenCalledWith(expected)` — NEVER `toHaveBeenCalled()` alone
- `toEqual` for deep object comparison, `toBe` for primitives/references
- `toMatchInlineSnapshot()` for complex outputs — NEVER external `.snap` files
- One logical assertion per test — multiple `expect` are fine if testing the same behavior
- `expect.objectContaining()` / `expect.arrayContaining()` to avoid brittle exact matches
- NEVER assert on the entire response object when you only care about 2 fields

## Structure

- `describe` blocks group by behavior/feature, not by method name
- Test names describe the scenario and expected outcome: `it('returns empty array when filter matches nothing')`
- AAA pattern: Arrange → Act → Assert — separated by blank lines
- Factory functions (`createUser()`, `buildOrder()`) for test data — NEVER inline object literals everywhere
- Shared setup in `beforeEach` — NEVER in module scope (test isolation)
- Keep tests flat: max 2 levels of `describe` nesting — deeper = bad test organization

## Async

- ALWAYS `await` async assertions — un-awaited expect silently passes
- `vi.waitFor()` for eventually-consistent behavior (DOM updates, debounced calls)
- `vi.advanceTimersByTime(ms)` over `vi.runAllTimers()` for precise control
- Test both resolve and reject paths for async functions
- Clean up in `afterEach`: cancel pending timers, abort controllers, unmount components

## Test File Organization

- Colocate test files next to source: `user-service.ts` → `user-service.test.ts`
- One test file per source file — split if test file exceeds 300 lines
- **300-line split rule**: When splitting, group by behavior. Shared factories and helpers go to `__test-utils__/` directories, not generic `utils/`

## TDD Template

Reference structure for strict TDD workflows:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Factory functions at top
const createTestData = (overrides = {}) => ({
  // sensible defaults representing valid state
  ...overrides,
})

describe('<Feature> — <behavior group>', () => {
  beforeEach(() => {
    // shared setup — reset state, seed mocks
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('<scenario> — <expected outcome>', () => {
    // Arrange
    const input = createTestData()

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toEqual(expected)
  })

  describe('edge cases', () => {
    it('handles empty input', () => { /* ... */ })
    it('handles null/undefined', () => { /* ... */ })
    it('handles boundary values', () => { /* ... */ })
  })

  describe('error paths', () => {
    it('throws on invalid input', () => { /* ... */ })
    it('returns fallback on failure', () => { /* ... */ })
  })
})
```

## Pre-Push Gate (Husky)

All NextNode/SaaS projects use **Husky** with a `pre-push` hook that runs `pnpm test` before every push. This means:

- **Every test MUST pass locally before code reaches the remote** — broken tests block the entire push
- **NEVER write tests that are flaky, environment-dependent, or timing-sensitive** — they will block pushes randomly
- **NEVER leave failing tests behind** — if you modify code, run `pnpm test` mentally and ensure all existing + new tests pass
- **If you add/change functionality, verify test impact** — check that no existing test breaks as a side effect
- **If you delete or rename exports/functions**, grep for test files that reference them and update accordingly
- **Quick feedback loop**: tests must run fast — avoid heavy setup, large fixtures, or unnecessary async delays

> Bottom line: treat `pnpm test` as a hard gate. If Claude writes code that breaks tests, the user cannot push. Every code change must be test-aware.

## Anti-Patterns — NEVER Do These

1. NEVER test implementation details — no internal state, private methods, CSS classes, DOM structure
2. NEVER use snapshot tests for components — they break on every change, nobody reads the diff
3. NEVER use `getByTestId` as default query strategy — it masks a11y issues
4. NEVER leave `vi.mock()` without `vi.restoreAllMocks()` in `afterEach`
5. NEVER write tests just for coverage numbers — every test must pass the 4-gate decision framework
6. NEVER use `any` in test types — use test-specific types or `unknown` with type guards
7. NEVER use external `.snap` files — inline snapshots only (`toMatchInlineSnapshot()`)
8. NEVER share mutable state between tests — each test must be independent
9. NEVER use `fireEvent` when `userEvent` is available
10. NEVER mock pure functions or internal modules
