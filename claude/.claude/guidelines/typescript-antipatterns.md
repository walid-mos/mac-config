# TypeScript/JavaScript Anti-Patterns

Language-specific anti-patterns and common mistakes to avoid when writing TypeScript and JavaScript code.

---

## Module System Anti-Patterns

### ⛔ Using require() in TypeScript

**Anti-Pattern**:
```typescript
const express = require('express')
const { someUtil } = require('./utils')
```

**Why It's Wrong**:
- CommonJS syntax in ES modules codebase
- Loses TypeScript type inference
- No static analysis for imports
- Can't tree-shake effectively

**✅ Correct Approach**:
```typescript
import express from 'express'
import { someUtil } from './utils'

// For dynamic imports
const module = await import('./dynamic-module')
```

**Rule**: Always use ES6 import/export syntax in TypeScript.

---

## Type System Anti-Patterns

### ⛔ Using 'any' Type

**Anti-Pattern**:
```typescript
function processData(data: any) {
  return data.map((item: any) => item.value)
}

const config: any = { port: 3000 }
```

**Why It's Wrong**:
- Defeats TypeScript's type safety
- No autocomplete or IntelliSense
- Runtime errors not caught at compile time
- Makes refactoring dangerous

**✅ Correct Approach**:
```typescript
interface DataItem {
  value: string
  id: number
}

function processData(data: DataItem[]) {
  return data.map(item => item.value)
}

interface Config {
  port: number
  host?: string
}

const config: Config = { port: 3000 }

// If truly unknown, use 'unknown' instead of 'any'
function handleUnknown(data: unknown) {
  if (typeof data === 'string') {
    console.log(data.toUpperCase())
  }
}
```

**Rule**: Never use `any`. Use proper types or `unknown` with type guards.

---

### ⛔ Untyped Error Catching

**Anti-Pattern**:
```typescript
try {
  await fetchData()
} catch (error) {
  console.log(error.message)  // error is 'any'
}
```

**Why It's Wrong**:
- `error` is implicitly `any`
- No guarantee error has a message property
- Can crash with "Cannot read property 'message' of undefined"

**✅ Correct Approach**:
```typescript
try {
  await fetchData()
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log('Unknown error occurred')
  }
}

// OR with helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

try {
  await fetchData()
} catch (error) {
  console.log(getErrorMessage(error))
}
```

**Rule**: Always handle caught errors with proper type guards.

---

### ⛔ Excessive Type Assertions

**Anti-Pattern**:
```typescript
const user = apiResponse as User
const element = document.querySelector('#app') as HTMLDivElement
const data = JSON.parse(response) as MyData
```

**Why It's Wrong**:
- Bypasses TypeScript's type checking
- No runtime validation
- Can lead to runtime errors
- Makes code fragile and unsafe

**✅ Correct Approach**:
```typescript
// Use type guards for validation
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  )
}

const apiResponse = await fetch('/api/user').then(r => r.json())
if (isUser(apiResponse)) {
  // Type-safe usage
  console.log(apiResponse.name)
}

// Use proper typing from the start
const element = document.querySelector<HTMLDivElement>('#app')
if (element) {
  element.style.display = 'block'
}

// Use validation libraries for complex types
import { z } from 'zod'

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email()
})

const data = UserSchema.parse(JSON.parse(response))
```

**Rule**: Avoid `as` casting. Use type guards, proper generics, or validation libraries.

**Exception**: `as const` for literal types is acceptable.

---

## Import Organization Anti-Patterns

### ⛔ Importing Entire Libraries

**Anti-Pattern**:
```typescript
import * as _ from 'lodash'
import React from 'react'

const result = _.map(array, fn)
const element = <div>{React.createElement('span', null, 'text')}</div>
```

**Why It's Wrong**:
- Imports entire library even if using one function
- Increases bundle size
- Prevents tree-shaking
- Slower builds and runtime

**✅ Correct Approach**:
```typescript
import { map } from 'lodash'
import { useState, useEffect } from 'react'

const result = map(array, fn)
```

**Rule**: Import only what you need. Never `import React` or `import *` unless absolutely necessary.

---

### ⛔ Mixed Import Types

**Anti-Pattern**:
```typescript
import { User, type UserRole, fetchUser } from './user'
import type { Config } from './config'
import { ApiClient } from './api'
```

**Why It's Wrong**:
- Inconsistent import organization
- Harder to scan and understand
- Mixed value and type imports

**✅ Correct Approach**:
```typescript
import { User, fetchUser } from './user'
import { ApiClient } from './api'
import type { UserRole } from './user'
import type { Config } from './config'
```

**Rule**: Separate type imports and value imports. Put type imports at the end.

---

## Code Structure Anti-Patterns

### ⛔ Deeply Nested Code

**Anti-Pattern**:
```typescript
function processUser(user: User) {
  if (user) {
    if (user.isActive) {
      if (user.permissions) {
        if (user.permissions.includes('admin')) {
          // Deep nesting
          return doSomething()
        }
      }
    }
  }
  return null
}
```

**Why It's Wrong**:
- Hard to read and understand
- Increases cognitive load
- Difficult to test
- Error-prone

**✅ Correct Approach**:
```typescript
function processUser(user: User) {
  // Early returns
  if (!user) return null
  if (!user.isActive) return null
  if (!user.permissions) return null
  if (!user.permissions.includes('admin')) return null

  return doSomething()
}
```

**Rule**: Use early returns and guard clauses. Keep code flat and readable.

---

### ⛔ Complex Boolean Logic

**Anti-Pattern**:
```typescript
if (user && user.isActive && !user.isDeleted && user.role === 'admin' && user.permissions.includes('write')) {
  // Complex condition
}
```

**Why It's Wrong**:
- Hard to understand intent
- Difficult to test individual conditions
- Not reusable

**✅ Correct Approach**:
```typescript
function canEditContent(user: User): boolean {
  return (
    user &&
    user.isActive &&
    !user.isDeleted &&
    user.role === 'admin' &&
    user.permissions.includes('write')
  )
}

if (canEditContent(user)) {
  // Clear intent
}
```

**Rule**: Extract complex conditionals into well-named functions.

---

## Performance Anti-Patterns

### ⛔ Creating Functions in Render

**Anti-Pattern**:
```typescript
// React component
function MyComponent() {
  return (
    <button onClick={() => {
      console.log('clicked')
      doSomething()
    }}>
      Click
    </button>
  )
}
```

**Why It's Wrong** (in React):
- Creates new function on every render
- Can cause child component re-renders
- Memory overhead

**✅ Correct Approach**:
```typescript
function MyComponent() {
  const handleClick = useCallback(() => {
    console.log('clicked')
    doSomething()
  }, [])

  return <button onClick={handleClick}>Click</button>
}

// OR for simple cases, define outside component
const logClick = () => console.log('clicked')

function MyComponent() {
  return <button onClick={logClick}>Click</button>
}
```

**Rule**: Use `useCallback` for functions passed to child components or define functions outside component when possible.

---

## Naming Anti-Patterns

### ⛔ Unclear Variable Names

**Anti-Pattern**:
```typescript
const data = fetchUser()
const temp = processData(data)
const x = temp.map(t => t.value)
```

**Why It's Wrong**:
- Unclear intent
- Hard to search
- Difficult to understand

**✅ Correct Approach**:
```typescript
const user = fetchUser()
const validatedUser = processData(user)
const userEmails = validatedUser.map(user => user.email)
```

**Rule**: Use descriptive, searchable names. Avoid generic names like `data`, `temp`, `x`.

---

### ⛔ Misleading Boolean Names

**Anti-Pattern**:
```typescript
const enabled = false
const active = user.status
const valid = validateForm()
```

**Why It's Wrong**:
- Not clear what the boolean represents
- Hard to read conditionals

**✅ Correct Approach**:
```typescript
const isFeatureEnabled = false
const isUserActive = user.status === 'active'
const isFormValid = validateForm()

// Usage is clearer
if (isFeatureEnabled) { /* ... */ }
if (isUserActive) { /* ... */ }
```

**Rule**: Boolean variables should start with `is`, `has`, `can`, or `should`.

---

## Summary

**Key TypeScript/JavaScript Anti-Patterns to Avoid**:

1. ⛔ Using `require()` → Use `import`
2. ⛔ Using `any` type → Use proper types or `unknown`
3. ⛔ Untyped error catching → Use type guards
4. ⛔ Excessive `as` casting → Use type guards or generics
5. ⛔ Importing entire libraries → Import specific exports
6. ⛔ Deep nesting → Use early returns
7. ⛔ Complex boolean logic → Extract to named functions
8. ⛔ Creating functions in render → Use `useCallback` or define outside
9. ⛔ Unclear variable names → Use descriptive names
10. ⛔ Misleading boolean names → Use `is/has/can/should` prefix

**Remember**: Type safety and code clarity are not optional. They prevent bugs and make code maintainable.
