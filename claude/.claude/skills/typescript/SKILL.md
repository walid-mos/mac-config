---
name: typescript
description: TypeScript coding standards. Use when writing TypeScript code, reviewing types, or discussing type safety.
allowed-tools: Read
---

# TypeScript Coding Standards

Complete TypeScript/JavaScript standards for all projects.

## Quick Rules

- **ALWAYS use `import`** - NEVER `require()`
- **ALWAYS use arrow functions**: `const fn = () => {}` not `function fn() {}`
- **NEVER use `any`** - use proper types or `unknown` with type guards
- **Avoid `as` casting** - use type guards, generics, or Zod (`as const` is acceptable)
- **Separate `import` and `import type`** - types at end
- **NEVER import React entirely** - use `import { useState }` not `import React`
- **Prioritize destructuring** and early returns
- **Use `@/` prefix** when path has more than `../`

## Type System

```typescript
// BAD - any
function process(data: any) { return data.value }

// GOOD - Proper types
function process(data: DataItem[]) { return data.map(d => d.value) }

// GOOD - unknown with type guard
function handle(data: unknown) {
  if (typeof data === 'string') console.log(data.toUpperCase())
}
```

```typescript
// BAD - Type assertion
const user = apiResponse as User

// GOOD - Type guard
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj
}

// GOOD - Generic
const el = document.querySelector<HTMLDivElement>('#app')

// GOOD - Zod validation
const data = UserSchema.parse(JSON.parse(response))
```

## Imports

```typescript
// BAD - Mixed types with values
import { User, type UserRole, fetchUser } from './user'

// GOOD - Separated, types at end
import { User, fetchUser } from './user'
import type { UserRole } from './user'
```

```typescript
// BAD - Barrel files in app code
import { Button } from '@/components'

// GOOD - Direct import
import { Button } from '@/components/Button'
```

## Code Structure

```typescript
// BAD - Deep nesting
if (user) {
  if (user.isActive) {
    if (user.permissions.includes('admin')) {
      return doSomething()
    }
  }
}

// GOOD - Early returns
if (!user) return null
if (!user.isActive) return null
if (!user.permissions.includes('admin')) return null
return doSomething()
```

## Data Fetching - Result Pattern

**NEVER throw errors in APIs. Return structured results.**

```typescript
type Result<T, E = Error> = [E, null] | [null, T];

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findById(id);
    if (!user) return [new NotFoundError('User not found'), null];
    return [null, user];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}

// Usage
const [error, user] = await fetchUser('123');
if (error) {
  showError(error.message);
  return;
}
console.log(user.name);
```

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| `require()` | `import` |
| `any` | Proper types or `unknown` |
| Untyped catch | `instanceof Error` |
| `as` casting | Type guards, generics, Zod |
| `import *` | Named imports |
| Barrel files | Direct imports |
| Deep nesting | Early returns |
| `enabled` | `isEnabled` (boolean prefix) |
| `Array.find` in loop | Build Map, O(1) lookups |
| `sort()` mutation | `toSorted()` or spread |
