---
name: typescript
description: TypeScript code standards. Use when writing or reviewing TypeScript code (.ts, .tsx files).
user-invocable: false
---

# TypeScript Standards

## Imports

- ALWAYS `import`, NEVER `require()`
- Separate value imports and `import type` — types last
- Use `@/` path alias when relative path has more than one `../`
- NEVER import an entire namespace (`import * as X`) — destructure

## Functions

- ALWAYS arrow functions: `const fn = () => {}` — NEVER `function` declarations
- Exception: exported module-level functions that need hoisting are acceptable

## Types

- NEVER `any` — use proper types or `unknown` + type guards
- NEVER `as` casting — prefer type guards, generics, or Zod parsing (`as const` is OK)
- Prefer `interface` for object shapes, `type` for unions/intersections/utilities
- Discriminated unions over optional fields for variant types

## Patterns

- Result pattern for data fetching: `type Result<T, E = Error> = [E, null] | [null, T]` — NEVER throw for expected errors
- Early returns over nested conditionals
- Destructure function params and object access
- `Array.find` inside a loop = build a `Map` first, O(1) lookups
- `sort()` mutates — use `toSorted()` or spread + sort
- Nullish coalescing (`??`) over logical OR (`||`) for defaults
- Optional chaining (`?.`) — but NEVER more than 3 levels deep; refactor the type instead
- `const` by default, `let` only when reassignment is necessary, NEVER `var`
- Prefer `satisfies` over `as` for type-checking without widening
- Use `Map`/`Set` over plain objects when keys are dynamic
- Enums: prefer `as const` objects over TypeScript `enum`
