---
triggers:
  project: ["typescript", "react", "next", "node"]
description: TypeScript anti-patterns to avoid
---

# TypeScript/JavaScript Anti-Patterns

## Module System

### ⛔ Using require()
```typescript
// BAD
const express = require('express')

// GOOD - ES6 import
import express from 'express'
```

---

## Type System

### ⛔ Using 'any'
```typescript
// BAD - No type safety
function process(data: any) { return data.value }

// GOOD - Proper types
function process(data: DataItem[]) { return data.map(d => d.value) }

// GOOD - unknown with type guard
function handle(data: unknown) {
  if (typeof data === 'string') console.log(data.toUpperCase())
}
```

### ⛔ Untyped Error Catching
```typescript
// BAD - error is any
catch (error) { console.log(error.message) }

// GOOD - Type guard
catch (error) {
  if (error instanceof Error) console.log(error.message)
}
```

### ⛔ Excessive Type Assertions
```typescript
// BAD - Bypasses type checking
const user = apiResponse as User

// GOOD - Type guard
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj
}
if (isUser(apiResponse)) console.log(apiResponse.name)

// GOOD - Generic
const el = document.querySelector<HTMLDivElement>('#app')

// GOOD - Zod validation
const data = UserSchema.parse(JSON.parse(response))
```
**Exception**: `as const` is acceptable.

### ⛔ Object Mutation with Type Assertions
```typescript
// BAD - Mutation with as
;(entry as { scope: string }).scope = scope

// GOOD - Conditional spread
const entry: LogEntry = {
  level,
  message,
  ...(scope !== undefined && { scope }),
}

// GOOD - Optional properties
interface LogEntry {
  level: Level
  message: string
  scope?: string
}
```

---

## Imports

### ⛔ Importing Entire Libraries
```typescript
// BAD - Imports everything
import * as _ from 'lodash'
import React from 'react'

// GOOD - Named imports
import { map } from 'lodash'
import { useState, useEffect } from 'react'
```

### ⛔ Mixed Import Types
```typescript
// BAD - Mixed
import { User, type UserRole, fetchUser } from './user'

// GOOD - Separated, types at end
import { User, fetchUser } from './user'
import type { UserRole } from './user'
```

### ⛔ Barrel Files in Application Code
```typescript
// BAD - Forces bundler to process all exports
import { Button } from '@/components'  // from index.ts

// GOOD - Direct import
import { Button } from '@/components/Button'
```
**Exception**: Library entry points (package.json main) are acceptable.

---

## Code Structure

### ⛔ Deep Nesting
```typescript
// BAD
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

### ⛔ Complex Boolean Logic
```typescript
// BAD - Hard to read
if (user && user.isActive && !user.isDeleted && user.role === 'admin') {}

// GOOD - Named function
function canEditContent(user: User): boolean {
  return user && user.isActive && !user.isDeleted && user.role === 'admin'
}
if (canEditContent(user)) {}
```

---

## Performance

### ⛔ Functions in Render
```typescript
// BAD - New function every render
<button onClick={() => doSomething()}>

// GOOD - useCallback
const handleClick = useCallback(() => doSomething(), [])
<button onClick={handleClick}>

// GOOD - Define outside component
const handleClick = () => doSomething()
```

---

## Naming

### ⛔ Unclear Names
```typescript
// BAD
const data = fetchUser()
const temp = processData(data)

// GOOD
const user = fetchUser()
const validatedUser = processData(user)
```

### ⛔ Boolean Names Without Prefix
```typescript
// BAD
const enabled = false
const active = user.status

// GOOD - is/has/can/should prefix
const isFeatureEnabled = false
const isUserActive = user.status === 'active'
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
| Inline functions | useCallback or external |
| Generic names | Descriptive names |
| enabled, active | isEnabled, isActive |
