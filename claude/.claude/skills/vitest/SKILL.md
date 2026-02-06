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

## Test File Organization

- Colocate test files next to source: `user-service.ts` → `user-service.test.ts`
- One test file per source file — split if test file exceeds 300 lines
- Group test utilities in `__test-utils__/` directories, not generic `utils/`
