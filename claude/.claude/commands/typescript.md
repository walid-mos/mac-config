---
allowed-tools: Read
description: TypeScript coding standards, anti-patterns, and data fetching patterns
---

# /typescript

Complete TypeScript/JavaScript coding standards for all projects.

---

## Core Language Rules

### Module System
- **ALWAYS use `import`** - NEVER use `require()`
- **Always prioritize ES6/ESNext over CommonJS**
- **TypeScript imports**: Use `@/` prefix when path has more than `../`

### Function Declaration Style
- **Always use arrow functions**: `const fn = () => {}` instead of `function fn() {}`
- **FORBIDDEN**: Never use IIFE syntax `;(function() { ... })()`

### Code Structure
- **Prioritize destructuring** for cleaner code
- **Early returns** to minimize indentation
- **Avoid excessive nesting** - use guard clauses
- Prefer simple `if` over complex nested conditions
- Use `switch` as last resort

### TypeScript Type System
- **NEVER use `any`** - completely forbidden
- **Strong typing over `unknown`** - use unknown as last resort
- **Avoid `as` casting** - use type guards, generics, or Zod (`as const` is acceptable)
- **Prioritize reusability** - strong typed hardcoded values for specific use cases only

### Import Organization
- **Separate import and import type** - types at end
- **NEVER import React entirely** - use `import { useState }` not `import React`
- Use `import type { ComponentRef }` instead of `React.ComponentRef`

### Code Maintenance
- Remove unused variables (no workarounds)
- Comments for useful tasks only (TODO:), not removed code
- Deprecate only external APIs - remove internal unused code

---

## Anti-Patterns Reference

### Module System

```typescript
// BAD
const express = require('express')

// GOOD
import express from 'express'
```

### Type System

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
// BAD - Untyped catch
catch (error) { console.log(error.message) }

// GOOD - Type guard
catch (error) {
  if (error instanceof Error) console.log(error.message)
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

### Imports

```typescript
// BAD - Imports everything
import * as _ from 'lodash'
import React from 'react'

// GOOD - Named imports
import { map } from 'lodash'
import { useState, useEffect } from 'react'
```

```typescript
// BAD - Mixed
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

### Code Structure

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

### Naming

```typescript
// BAD - Boolean without prefix
const enabled = false

// GOOD - is/has/can/should prefix
const isFeatureEnabled = false
```

### Performance Micro-Optimizations

```typescript
// BAD - O(n) lookup in loop = O(n^2)
users.forEach(user => {
  const role = roles.find(r => r.userId === user.id)
})

// GOOD - Map for O(1) lookups = O(n)
const roleMap = new Map(roles.map(r => [r.userId, r]))
users.forEach(user => {
  const role = roleMap.get(user.id)
})
```

```typescript
// BAD - Mutates original
const sorted = items.sort((a, b) => a.name.localeCompare(b.name))

// GOOD - toSorted() or spread
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name))
const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
```

---

## Data Fetching & Error Handling

### Core Principle

**NEVER throw errors in APIs and libraries. Return structured results instead.**
Error handling belongs at the **client/UI boundary**, not in business logic.

### Discriminated Union State Pattern

```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### Result Pattern (Tuple - Recommended)

```typescript
type Result<T, E = Error> = [E, null] | [null, T];

// API/service
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findById(id);
    if (!user) return [new NotFoundError('User not found'), null];
    return [null, user];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}

// Client usage
const [error, user] = await fetchUser('123');
if (error) {
  showError(error.message);
  return;
}
console.log(user.name);
```

### Error Boundary Rules

| Layer | Throw? | Return Result? |
|-------|--------|----------------|
| Database/External API | Catch & wrap | Yes |
| Service/Business Logic | Never | Yes |
| API Route Handler | Never | Yes |
| React Component | Handle Result | Display error UI |
| Global Error Boundary | Catch unexpected | Last resort |

### Custom Error Classes

```typescript
class NotFoundError extends Error {
  readonly type = 'not-found';
}

class ValidationError extends Error {
  readonly type = 'validation';
  constructor(public fields: Record<string, string>) {
    super('Validation failed');
  }
}

type AppError = NotFoundError | ValidationError | UnauthorizedError;

function handleError(error: AppError) {
  switch (error.type) {
    case 'not-found': return { status: 404, message: error.message };
    case 'validation': return { status: 400, fields: error.fields };
    case 'unauthorized': return { status: 401, message: 'Please login' };
  }
}
```

---

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| require() | import |
| any | Proper types or unknown |
| Untyped catch | instanceof Error |
| as casting | Type guards, generics, Zod |
| import * | Named imports |
| Barrel files | Direct imports |
| Deep nesting | Early returns |
| Complex conditions | Named functions |
| Generic names | Descriptive names |
| enabled, active | isEnabled, isActive |
| Array.find in loop | Build Map, O(1) lookups |
| `sort()` mutation | `toSorted()` or spread |

**Decision Framework:**
1. Does this maintain type safety? (If no, it's easiest, not simplest)
2. Does it solve the exact problem without over-engineering?
3. Is it maintainable and readable?
4. Will it scale appropriately?
