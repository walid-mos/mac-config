# Type Design - TypeScript

## Unions Over Enums (`enum` is linted)

```typescript
// PREFERRED
type Role = "admin" | "user" | "guest"

// PREFERRED - when you need runtime access to values
const ROLES = ["admin", "user", "guest"] as const
type Role = (typeof ROLES)[number]
```

## `as const` / `satisfies` - the allowed forms

```typescript
const ROLES = ["admin", "user", "guest"] as const
const config = { retries: 3, timeout: 5000 } satisfies Config
const palette = { primary: "#000" } as const satisfies Record<string, string>
```

## Discriminated Unions for Variants

```typescript
// BAD - unclear which fields exist
type Result = { success?: boolean; data?: Data; error?: Error }

// GOOD - the compiler enforces correctness
type Result =
  | { type: "success"; data: Data }
  | { type: "error"; error: Error }
```

## Generics

Use generics only when a function/type genuinely works with multiple types - and always constrain them (`<T extends Base>`). Single-type functions take the concrete type.

```typescript
// BAD - generic for no reason
function getName<T extends { name: string }>(obj: T): string { return obj.name }

// GOOD - concrete type
function getName(obj: { name: string }): string { return obj.name }

// GOOD - generic justified (preserves input type)
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { ... }
```

## Type Guards and Narrowing

Write proper type guards instead of casting.

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  )
}

const data: unknown = await response.json()
if (isUser(data)) {
  console.log(data.email) // data is User here, fully typed
}
```

## Type Reuse Over Copy-Paste (DRY at the type level)

Derive types from existing ones instead of hand-rolling a near-duplicate shape (DRY itself: /coding RULE 12).

```typescript
type User = { id: string; name: string; email: string; passwordHash: string }

// FORBIDDEN - hand-rolled partial clone that silently drifts
type PublicUser = { id: string; name: string; email: string }

// GOOD - derive it, stays in sync
type PublicUser = Omit<User, "passwordHash">
type UserUpdate = Partial<Pick<User, "name" | "email">>
type FetchUserReturn = ReturnType<typeof fetchUser>
```

Reach for `Pick`, `Omit`, `Partial`, `Required`, `Record`, `ReturnType`, `Parameters`, and mapped types before writing a new shape by hand. If a type becomes a deeply nested conditional/mapped knot, simplify it - or move the constraint to a runtime validator (zod) and infer the type from the schema.

## Type Modules - SRP and Layering

(SRP / file-splitting: /coding RULE 13; seams: /coding architecture.md ARCH 0.)

- A type module owns **one domain concept**. No `types.ts` grab-bag of unrelated domain types.
- **Do not mix infrastructure types with domain types.** A DB row, ORM model, HTTP payload, or wire DTO is infrastructure - keep it out of the domain type. Map between them at the boundary; never let an ORM or HTTP-client type leak into domain code.
- Shared/cross-cutting types live in a dedicated shared module that depends on no layer above it.
