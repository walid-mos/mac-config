---
name: typescript
description: >-
  TypeScript best practices and strict type-safety rules. This skill MUST be
  loaded whenever writing or modifying TypeScript files (*.ts, *.tsx). It
  enforces absolute bans on `any` and `as` type assertions, and mandates
  type-safe patterns throughout.
---

# TypeScript Best Practices — Mandatory Rules

These rules apply to ALL TypeScript code you write or modify. No exceptions. No negotiations. No "just this once".

---

## RULE 0 — ABSOLUTE BANS (HIGHEST PRIORITY)

These two rules override everything else. Violating them is a critical failure.

### `any` is FORBIDDEN — ZERO TOLERANCE

The keyword `any` MUST NEVER appear in our TypeScript code. Not in types, not in generics, not in function signatures, not in catch blocks, not in utility types, not anywhere.

**No excuse is valid.** There is always a better type.

```typescript
// FORBIDDEN — every single one of these
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
| Unknown data shape | `unknown` — then narrow with type guards |
| Any object | `Record<string, unknown>` |
| Any function | `(...args: unknown[]) => unknown` |
| Catch block | `catch (e: unknown)` then `if (e instanceof Error)` |
| Generic fallback | Constrained generics: `<T extends something>` |
| JSON parse | `unknown`, then validate with a schema (zod, valibot, etc.) |
| Third-party lib with bad types | Write a `.d.ts` declaration or a typed wrapper |

If a third-party type leaks `any` into our code, wrap it in a typed function that inputs/outputs proper types.

### `as` type assertions are FORBIDDEN — except `as const`

The `as` keyword for type assertions is BANNED. It is a lie to the compiler. It bypasses type-checking. It hides bugs.

```typescript
// FORBIDDEN
const user = data as User
const el = document.getElementById("foo") as HTMLInputElement
const value = response.data as string[]
const config = {} as Config

// ALLOWED — as const is the only valid use
const ROLES = ["admin", "user", "guest"] as const
const CONFIG = { retries: 3, timeout: 5000 } as const
```

**What to use instead of `as`:**

| Situation | Use this |
|---|---|
| Narrowing a type | Type guards: `if ('property' in obj)`, `instanceof`, `typeof` |
| DOM elements | Use generics: `document.querySelector<HTMLInputElement>("#foo")` |
| API responses | Validate with a runtime schema (zod, valibot), or use type predicates |
| Discriminated unions | Check the discriminant field: `if (result.type === "success")` |
| Const assertions | `as const` is fine and encouraged |

If you feel the need to write `as`, it means the types are wrong — fix the types, don't lie to the compiler.

---

## Type Inference — Let TypeScript Work

- **Do NOT annotate when TypeScript infers correctly.** Don't write `const x: number = 5` or `const arr: string[] = ["a", "b"]`. TypeScript knows.
- **DO annotate function signatures.** Parameters and return types should be explicit — this is documentation and a contract.
- **DO annotate when inference is too broad.** If TypeScript infers `string` but you need a specific literal union, annotate it.

```typescript
// BAD — redundant annotation
const count: number = items.length
const name: string = user.name
const doubled: number[] = nums.map(n => n * 2)

// GOOD — let inference work
const count = items.length
const name = user.name
const doubled = nums.map(n => n * 2)

// GOOD — explicit function signatures
function getUser(id: string): Promise<User> { ... }

// GOOD — inference is too broad without annotation
const status: "active" | "inactive" = computeStatus()
```

## Strict Null Handling

- **Prefer null checks, early returns, `??`, and `?.` over `!`** in most cases.
- **`!` is acceptable** when the non-null condition is guaranteed by surrounding logic but TypeScript's control flow can't see it (e.g. after a `.filter()`, in a loop that only runs when the value exists, or when a prior check already covers it).
- **`!` is NOT acceptable** as a lazy shortcut to skip proper null handling. If you're using `!` because you don't want to think about the null case, that's wrong.

```typescript
// BAD — lazy, no guarantee user exists
const name = user!.name

// GOOD — handle it
if (!user) throw new Error("User not found")
const name = user.name

// GOOD
const name = user?.name ?? "Unknown"

// ACCEPTABLE — guaranteed by .has() check above
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

// PREFERRED — when you need runtime access to values
const ROLES = ["admin", "user", "guest"] as const
type Role = (typeof ROLES)[number]

// AVOID unless you have a specific reason
enum Role { Admin, User, Guest }
```

## Discriminated Unions for Variants

Use discriminated unions instead of optional fields or type assertions.

```typescript
// BAD — unclear which fields exist
type Result = {
  success?: boolean
  data?: Data
  error?: Error
}

// GOOD — the compiler enforces correctness
type Result =
  | { type: "success"; data: Data }
  | { type: "error"; error: Error }
```

## Generics

- Use generics when a function/type genuinely works with multiple types.
- Always constrain generics: `<T extends Base>` not just `<T>`.
- Don't use generics for single-type functions — just use the concrete type.

```typescript
// BAD — generic for no reason
function getName<T extends { name: string }>(obj: T): string {
  return obj.name
}

// GOOD — just use the concrete type
function getName(obj: { name: string }): string {
  return obj.name
}

// GOOD — generic is justified (preserves input type)
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

// Usage — no `as` needed
const data: unknown = await response.json()
if (isUser(data)) {
  // data is User here, fully typed
  console.log(data.email)
}
```

## Readonly by Default

- Use `readonly` for properties that shouldn't change after creation.
- Use `Readonly<T>`, `ReadonlyArray<T>`, `ReadonlyMap`, `ReadonlySet` for collections that shouldn't be mutated.
- Prefer `as const` for literal objects/arrays that should be deeply readonly.

## Utility Types

Use built-in utility types instead of reinventing the wheel:

- `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`
- `Record<K, V>`, `Exclude<T, U>`, `Extract<T, U>`
- `NonNullable<T>`, `ReturnType<T>`, `Parameters<T>`

## Imports

- Use `import type` for type-only imports — this ensures they're erased at runtime and prevents circular dependency issues.

```typescript
import type { User } from "./types"
import { createUser } from "./users"
```

## Summary of Forbidden Patterns

| Pattern | Verdict | Alternative |
|---|---|---|
| `any` | NEVER | `unknown` + narrowing |
| `as Type` | NEVER | Type guards, generics, schema validation |
| `as const` | ALLOWED | Use it freely |
| `// @ts-ignore` | NEVER | Fix the type error |
| `// @ts-expect-error` | Only in tests | Must have a comment explaining why |
| `!` (non-null assertion) | OK if guaranteed | Prefer null checks, but fine when logic guarantees non-null |
| `enum` | AVOID | String literal unions, `as const` objects |
