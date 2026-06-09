---
name: typescript
user-invocable: false
description: >-
  MUST be loaded whenever writing or modifying TypeScript (*.ts, *.tsx).
  Enforces absolute bans on `any` and `as` type assertions; mandates type-safe
  patterns throughout.
---

# TypeScript Best Practices - Mandatory Rules

These rules apply to ALL TypeScript code you write or modify.

---

## RULE 0 - ABSOLUTE BANS (HIGHEST PRIORITY)

These two rules override everything else. Violating them is a critical failure.

### `any` is FORBIDDEN - ZERO TOLERANCE

The keyword `any` MUST NEVER appear in our TypeScript code. Not in types, not in generics, not in function signatures, not in catch blocks, not in utility types, not anywhere.

**No excuse is valid.** There is always a better type.

```typescript
// FORBIDDEN - every single one of these
let x: any
function foo(data: any): any
const bar = value as any
type Broken = Record<string, any>
catch (e: any)
Array<any>
Promise<any>
// @ts-ignore to hide an any
```

**What to use instead:**

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

### `as` type assertions are FORBIDDEN - except `as const`

The `as` keyword for type assertions is BANNED. It is a lie to the compiler. It bypasses type-checking. It hides bugs.

```typescript
// FORBIDDEN
const user = data as User
const el = document.getElementById("foo") as HTMLInputElement
const value = response.data as string[]
const config = {} as Config

// ALLOWED - as const, and satisfies (TS 4.9+)
const ROLES = ["admin", "user", "guest"] as const
const CONFIG = { retries: 3, timeout: 5000 } as const

// ALLOWED - satisfies checks conformance WITHOUT widening or lying
const config = { retries: 3, timeout: 5000 } satisfies Config
const palette = { primary: "#000", accent: "#fff" } as const satisfies Record<string, string>
```

**What to use instead of `as`:**

| Situation | Use this |
|---|---|
| Narrowing a type | Type guards: `if ('property' in obj)`, `instanceof`, `typeof` |
| DOM elements | Use generics: `document.querySelector<HTMLInputElement>("#foo")` |
| API responses | Validate with a runtime schema (zod, valibot), or use type predicates |
| Discriminated unions | Check the discriminant field: `if (result.type === "success")` |
| Conforming a literal to a type | `satisfies Type` - checks the shape but keeps the narrow inferred type (use `const x = {…} satisfies Config`, never `const x = {…} as Config`) |
| Const assertions | `as const` is fine and encouraged |

The difference: `as Config` *forces* a value to a type and silences errors; `satisfies Config` *verifies* the value matches the type while preserving its precise inferred shape. Reach for `satisfies` wherever you were tempted to write `as`.

If you feel the need to write `as`, it means the types are wrong - fix the types, don't lie to the compiler.

---

## Type Inference - Let TypeScript Work

- **Do NOT annotate when TypeScript infers correctly.** Don't write `const x: number = 5` or `const arr: string[] = ["a", "b"]`. TypeScript knows.
- **DO annotate function signatures.** Parameters and return types should be explicit - this is documentation and a contract.
- **DO annotate when inference is too broad.** If TypeScript infers `string` but you need a specific literal union, annotate it.

```typescript
const count: number = items.length   // BAD - redundant, TS infers number
const count = items.length           // GOOD - let inference work

function getUser(id: string): Promise<User> { ... }   // GOOD - explicit signature
const status: "active" | "inactive" = computeStatus() // GOOD - inference too broad
```

## Strict Null Handling

Prefer null checks, early returns, `??`, and `?.` over `!`. Prefer type-system fixes (non-empty tuples, discriminated unions, type guards) when available. `!` is acceptable only when a runtime invariant guarantees non-null but TS can't see it (`Map.has()`+`Map.get()`, `expect().toBeDefined()`, etc.) - the bar is provability in one sentence. `if (!x) throw …` already narrows; no `!` needed after.

```typescript
// BAD - lazy
const name = user!.name

// GOOD
if (!user) throw new Error("User not found")
const name = user.name

// ACCEPTABLE - TS doesn't connect .has() and .get()
if (map.has(key)) {
  const value = map.get(key)!
}
```

## Unions Over Enums

- Prefer **string literal unions** over `enum` for simple value sets.
- Use `as const` objects when you need both runtime values and a type.

```typescript
// PREFERRED
type Role = "admin" | "user" | "guest"

// PREFERRED - when you need runtime access to values
const ROLES = ["admin", "user", "guest"] as const
type Role = (typeof ROLES)[number]

// AVOID unless you have a specific reason
enum Role { Admin, User, Guest }
```

## Discriminated Unions for Variants

Use discriminated unions instead of optional fields or type assertions.

```typescript
// BAD - unclear which fields exist
type Result = {
  success?: boolean
  data?: Data
  error?: Error
}

// GOOD - the compiler enforces correctness
type Result =
  | { type: "success"; data: Data }
  | { type: "error"; error: Error }
```

## Generics

- Use generics when a function/type genuinely works with multiple types.
- Always constrain generics: `<T extends Base>` not just `<T>`.
- Don't use generics for single-type functions - just use the concrete type.

```typescript
// BAD - generic for no reason
function getName<T extends { name: string }>(obj: T): string {
  return obj.name
}

// GOOD - just use the concrete type
function getName(obj: { name: string }): string {
  return obj.name
}

// GOOD - generic is justified (preserves input type)
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  // ...
}
```

## Type Guards and Narrowing

Write proper type guards instead of casting.

```typescript
// Type predicate
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  )
}

// Usage - no `as` needed
const data: unknown = await response.json()
if (isUser(data)) {
  // data is User here, fully typed
  console.log(data.email)
}
```

## `type` vs `interface`

One choice per situation - do not mix styles arbitrarily within a module.

- Prefer **`type`** for unions, intersections, tuples, mapped/conditional types, and function signatures (`type` can express all of these; `interface` cannot).
- Prefer **`interface`** only when you need declaration merging (augmenting a third-party type) or are modelling an open object contract meant to be extended via `extends`.
- Default to `type` when in doubt - it covers more cases and stays consistent.

## Type Reuse Over Copy-Paste (DRY at the type level)

Derive types from existing ones with utility/mapped types instead of hand-rolling a near-duplicate shape. (DRY itself is /coding RULE 12 - this is its type-level application.)

```typescript
type User = { id: string; name: string; email: string; passwordHash: string }

// FORBIDDEN - hand-rolled partial clone that silently drifts when User changes
type PublicUser = { id: string; name: string; email: string }

// GOOD - derive it, stays in sync with User
type PublicUser = Omit<User, "passwordHash">
type UserUpdate = Partial<Pick<User, "name" | "email">>
type FetchUserReturn = ReturnType<typeof fetchUser>
type FetchUserArgs = Parameters<typeof fetchUser>
```

Reach for `Pick`, `Omit`, `Partial`, `Required`, `Record`, `ReturnType`, `Parameters`, and mapped types (`{ [K in keyof T]: … }`) before writing a new shape by hand. If a type becomes a deeply nested conditional/mapped knot, that is a smell - simplify it, or move the constraint to a runtime validator (zod) and infer the type from the schema.

## Type Modules - SRP and Layering

(SRP / clean file-splitting is /coding RULE 13; architecture seams are /coding architecture.md ARCH 0. This is their type-specific application.)

- A type module owns **one domain concept**. Do not pile unrelated domain types into a single `types.ts` grab-bag.
- **Do not mix infrastructure types with domain types** in the same module. A DB row, an ORM model, an HTTP request/response payload, or a wire DTO is an infrastructure type - keep it out of the domain type that models the concept. Map between them at the boundary; never let an ORM or HTTP-client type leak into domain code.
- Keep shared/cross-cutting types in a dedicated shared module that depends on no layer above it.

## Typed Error Handling

- Catch as `unknown`, then narrow with `instanceof` before touching the value:

```typescript
try {
  await save(user)
} catch (e: unknown) {
  if (e instanceof ValidationError) return { ok: false, error: e.message }
  throw e
}
```

- For expected, recoverable failures prefer a **Result/discriminated-union return** over throwing - the caller is forced by the compiler to handle both branches:

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

- Make switches over a union **exhaustive** with a `never` guard so a new variant becomes a compile error, not a silent fall-through:

```typescript
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.r ** 2
    case "square": return shape.side ** 2
    default: {
      const _exhaustive: never = shape
      throw new Error(`Unhandled shape: ${String(_exhaustive)}`)
    }
  }
}
```

## Imports

- Use `import type` for type-only imports - this ensures they're erased at runtime and prevents circular dependency issues.

```typescript
import type { User } from "./types"
import { createUser } from "./users"
```

## Summary of Forbidden Patterns

| Pattern | Verdict | Alternative |
|---|---|---|
| `any` | NEVER | `unknown` + narrowing |
| `as Type` | NEVER | Type guards, generics, schema validation, `satisfies` |
| `as const` | ALLOWED | Use it freely |
| `satisfies Type` | ALLOWED | Conformance check that keeps the narrow inferred type - prefer over `as Type` |
| `// @ts-ignore` | NEVER | Fix the type error |
| `// @ts-expect-error` | Tests or typed declaration stubs for poorly-typed third-party libs | Must have a comment explaining why |
| `!` (non-null assertion) | OK if provable | Prefer type-system fixes / null checks; bang is fine when a runtime check or test assertion guarantees non-null but TS can't see it |
| `enum` | AVOID | String literal unions, `as const` objects |
| Hand-rolled clone of an existing type | AVOID | Derive with `Pick`/`Omit`/`Partial`/`ReturnType` |
| Domain type mixed with DB/HTTP/ORM type | AVOID | Separate modules; map at the boundary |
