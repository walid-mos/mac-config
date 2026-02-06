---
name: clean-code
description: DRY and SOLID coding standards. Use when writing, reviewing, or refactoring any code to ensure clean, maintainable, and non-duplicated code.
user-invocable: false
---

# Clean Code — DRY & SOLID Standards

## Philosophy

Write code that is clean, versatile, and maintainable. Eliminate duplication when it provides real value — but never at the cost of readability or when abstraction adds more complexity than the duplication it removes. Three similar lines are better than a premature abstraction that nobody understands.

## DRY — Don't Repeat Yourself

### Default: Extract at 2nd Occurrence

- **2 occurrences** = extract by default — duplication is a bug waiting to happen
- The pattern is already clear at the 2nd occurrence in most cases — don't wait
- Business rules and domain logic MUST have a single source of truth — NEVER scatter the same validation, calculation, or rule across files
- Constants, config values, magic numbers = define once, reference everywhere

### Tolerate Duplication Only When

- The two snippets **look similar but serve genuinely different purposes** and will evolve independently
- The abstraction would require 3+ parameters or complex generics just to handle both call sites — it's too forced
- It's glue code, wiring, or boilerplate that is inherently contextual (e.g., route handlers, component props)
- It's test setup code — readability and independence matter more than DRY in tests
- The duplicated code is trivial (1–2 lines) AND has no risk of diverging silently

## SOLID Principles

### S — Single Responsibility

- One module/class/function = one reason to change
- Functions do ONE thing — if the name requires "and", split it
- Files: max ~200–300 lines of meaningful logic; split when responsibilities diverge
- Separate concerns: data access, business logic, presentation, orchestration

### O — Open/Closed

- Extend behavior through composition, plugins, strategy patterns — not by editing existing code
- Use discriminated unions + exhaustive switches for variant handling
- Prefer config/data-driven behavior over hardcoded conditionals
- When adding a new case, you should ideally add a new file/module, not modify 5 existing ones

### L — Liskov Substitution

- Subtypes must be usable wherever their parent type is expected — no surprises
- NEVER narrow, override, or throw in a subtype method that the parent doesn't
- Prefer composition over deep inheritance chains (max 2 levels)
- If a function accepts a base type, it must work correctly with any subtype

### I — Interface Segregation

- Small, focused interfaces — clients should not depend on methods they don't use
- Prefer multiple narrow interfaces over one fat interface
- Split interfaces by consumer role: `Readable`, `Writable` > `ReadWritable`
- Component props: pass only what the component needs, NEVER spread an entire entity

### D — Dependency Inversion

- High-level modules depend on abstractions (interfaces/types), not concrete implementations
- Inject dependencies — NEVER hardcode imports to specific implementations inside business logic
- Use factory functions or DI containers for wiring
- Side effects (DB, API, filesystem) behind interfaces — makes testing trivial

## Code Quality Best Practices

### Naming

- Names reveal intent — if you need a comment to explain what a variable is, rename it
- Avoid abbreviations except universally understood ones (`id`, `url`, `api`)
- Booleans: `is/has/can/should` prefix
- Functions: verb + noun (`fetchUser`, `validateEmail`, `calculateTotal`)
- Avoid generic names: `data`, `info`, `item`, `thing`, `result` — be specific

### Functions

- Max 20–30 lines — if longer, extract sub-steps
- Max 3 parameters — use an options object beyond that
- Pure functions by default — isolate side effects at the edges
- Early returns over nested conditionals — fail fast, happy path last
- NEVER use boolean parameters to toggle behavior — use separate functions or an enum/union

### Modules & Files

- One concept per file — `UserService` in `user-service.ts`, not mixed with `OrderService`
- Group by feature/domain, not by technical layer when possible
- Keep coupling low: a module change should not cascade to unrelated modules
- Circular dependencies = architectural smell — refactor immediately

### Error Handling

- Handle errors at the appropriate level — not too early (loses context), not too late (crashes)
- Use Result/Either pattern for expected failures — reserve exceptions for truly exceptional cases
- NEVER silently swallow errors — at minimum log them
- Error messages must be actionable: what happened, why, and what to do about it

### Comments & Documentation

- Code should be self-documenting — extract well-named functions instead of adding comments
- Comments explain **why**, never **what** (the code says what)
- Delete commented-out code — version control exists
- Document public APIs, complex algorithms, and non-obvious business rules only

### Refactoring Signals

Extract or refactor when you see:

- **Long parameter lists** (4+) — group into an object or rethink the design
- **Feature envy** — a function uses more data from another module than its own
- **Shotgun surgery** — one change requires edits in 5+ files
- **Divergent change** — one file changes for multiple unrelated reasons
- **Primitive obsession** — using strings/numbers where a domain type adds safety
- **Large conditionals** — switch/if chains with 4+ branches → polymorphism or strategy pattern
- **Dead code** — delete it, do not comment it out

### Performance Awareness

- Prefer `Map`/`Set` for lookups in loops — O(1) vs O(n)
- Avoid unnecessary allocations in hot paths
- Lazy evaluation: compute only when needed
- Cache expensive computations — but invalidate correctly
- Measure before optimizing — premature optimization is the root of all evil
