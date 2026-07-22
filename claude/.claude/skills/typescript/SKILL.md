---
name: typescript
user-invocable: false
description: >-
  What to write instead of the linted TypeScript bans (any, as, enum,
  @ts-ignore), plus type-design and typed-error-handling judgment. MUST be
  loaded whenever writing or modifying *.ts or *.tsx files.
---

# TypeScript - Mandatory Rules

The bans (`any`, `as` except `as const`, `enum`, `@ts-ignore`, missing return types on declarations, `!` as warn, type-aware promise/exhaustiveness checks) are linted - see `nextnode-standards/oxlint.md`. The linter flags the violation; this skill is how you fix it WITHOUT cheating. Never silence a rule.

References: [type-design.md](type-design.md) (unions over enums, discriminated unions, generics, type guards, type reuse with `Pick`/`Omit`, domain/infra layering), [error-handling.md](error-handling.md) (catch as `unknown`, Result returns, exhaustive switches with `never`).

## Instead of `any` - there is always a better type

| Situation | Use this |
|---|---|
| Unknown data shape | `unknown` - then narrow with type guards |
| Any object | `Record<string, unknown>` |
| Any function | `(...args: unknown[]) => unknown` |
| Catch block | `catch (e: unknown)` then `if (e instanceof Error)` |
| Generic fallback | Constrained generics: `<T extends something>` |
| JSON parse | `unknown`, then validate with a schema (zod, valibot, etc.) |
| Third-party lib with bad types | Write a `.d.ts` declaration or a typed wrapper |

If a third-party type leaks `any` into our code, wrap it in a typed function that inputs/outputs proper types.

## Instead of `as` - verify, don't force

| Situation | Use this |
|---|---|
| Narrowing a type | Type guards: `if ('property' in obj)`, `instanceof`, `typeof` |
| DOM elements | Generics: `document.querySelector<HTMLInputElement>("#foo")` |
| API responses | Runtime schema validation (zod, valibot), or type predicates |
| Discriminated unions | Check the discriminant: `if (result.type === "success")` |
| Conforming a literal to a type | `satisfies Type` - checks the shape, keeps the narrow inferred type |
| Const assertions | `as const` is fine and encouraged (also `as const satisfies T`) |

`as Config` *forces* and silences errors; `satisfies Config` *verifies* while preserving the precise inferred shape. Reach for `satisfies` wherever you were tempted to write `as`. If you still feel the need for `as`, the types are wrong - fix the types, don't lie to the compiler.

## Type inference

- Don't annotate what TypeScript infers (`const count = items.length`).
- DO annotate function parameters and return types - documentation and a contract.
- DO annotate when inference is too broad: `const status: "active" | "inactive" = computeStatus()`.

## Strict null handling

Prefer null checks, early returns, `??`, `?.` over `!`; prefer type-system fixes (non-empty tuples, discriminated unions, type guards) when available. `!` is acceptable only when a runtime invariant guarantees non-null but TS can't see it - the bar is provability in one sentence (e.g. `map.get(key)!` right after `if (map.has(key))`). `if (!x) throw ...` already narrows; no `!` needed after.

## Indexed access under `noUncheckedIndexedAccess`

`arr[i]` is `T | undefined` - that is a proof-of-presence obligation, not noise to launder. Decide by *where* non-emptiness is known:

- **Known at compile time** (literal array, statically-built collection): type it as a non-empty tuple `type NonEmptyArray<T> = readonly [T, ...T[]]`. Then `arr[0]` and `const [head] = arr` are `T`, and emptying the array fails to compile. No helper, no throw, no assertion.
- **Known only at runtime** (fetch, `.filter()`, a parameter, user input): narrow the *value*, not the length. `if (arr[i] === undefined) ...` (or bind first: `const el = arr[i]; if (el === undefined) ...`) narrows to `T`. Never `!arr[i]` - a truthy check is falsy-unsafe, it rejects a present `0` / `''` / `false`. The length never narrows the element; `arr[i]!` only when a runtime invariant proves presence in one sentence.

Do not write a `first()`-style helper that `throw`s to strip `| undefined` off a statically-known-non-empty array: that trades a compile-time truth for a runtime throw. Use the tuple.

## `type` vs `interface`

Default to `type` (unions, intersections, tuples, mapped/conditional types, function signatures). `interface` only for declaration merging (augmenting a third-party type) or an open contract meant to be extended via `extends`. Don't mix styles arbitrarily within a module.

## Summary - Judgment Beyond the Linter

| Pattern | Verdict | Alternative |
|---|---|---|
| `// @ts-expect-error` | Tests or stubs for badly-typed third-party libs only | Must carry a comment explaining why |
| `!` (non-null assertion) | OK if provable in one sentence | Prefer type-system fixes / null checks |
| Optional-fields bag for variants | AVOID | Discriminated union ([type-design.md](type-design.md)) |
| Unconstrained or pointless generic | AVOID | Constrain, or use the concrete type ([type-design.md](type-design.md)) |
| Hand-rolled clone of an existing type | AVOID | Derive with `Pick`/`Omit`/`Partial`/`ReturnType` ([type-design.md](type-design.md)) |
| Domain type mixed with DB/HTTP/ORM type | AVOID | Separate modules; map at the boundary ([type-design.md](type-design.md)) |
| Throwing for expected, recoverable failures | AVOID | Result / discriminated-union return ([error-handling.md](error-handling.md)) |
| `first()`/throw to strip `\| undefined` off a statically-non-empty array | AVOID | Non-empty tuple `type NonEmptyArray<T> = readonly [T, ...T[]]` |
| `!arr[i]` to guard an indexed access | AVOID | Narrow the value: `arr[i] === undefined` (falsy-safe) |
