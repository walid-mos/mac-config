---
triggers:
  project: ["typescript", "react", "next", "node"]
description: TypeScript coding standards
---

# TypeScript/JavaScript Coding Standards

## Core Language Rules

### Module System
- **ALWAYS use `import`** - NEVER use `require()`
- **Always prioritize ES6/ESNext over CommonJS**
- **TypeScript imports**: When importing in TypeScript, if there are more than `../` in the path, use TypeScript paths with `@/` prefix instead

### Function Declaration Style
- **Always use arrow functions**: `const functionName = () => {}` instead of `function functionName() {}`
- **FORBIDDEN**: Never use IIFE syntax like `;(function() { ... })()`

### Code Structure
- **Prioritize destructuring** whenever possible for cleaner code
- **Control flow priority**: Use early returns to minimize indentation and simplify functions
- **Code structure**: Avoid excessive nesting and indentation. Keep functions flat and readable through early returns and guard clauses
- Prefer simple `if` statements over complex nested conditions
- Use `switch` statements only as a last resort when multiple conditions need to be evaluated

### TypeScript Type System
- **NEVER use any in TypeScript** - any is completely forbidden, there is no case where any should be used
- **Always prioritize strong typing over unknown** - use unknown as last resort only
- **Avoid `as` casting** - use as casting as last resort, always try to avoid `as` (`as const` is acceptable)
- **Always prioritize reusability** - strong typed hardcoded values are only for specific use cases

### Import Organization Rules
- **Always separate import and import type** - Put type imports at the end of imports section
- **NEVER import React entirely** - Import only what you use: `import { useState, useEffect }` instead of `import React`
- Use specific imports like `import type { ComponentRef }` instead of `React.ComponentRef`

### Code Maintenance
- **Unused variables**: Always remove unused variables that generate warnings rather than using workarounds to keep them
- **Comments policy**: Do not add comment when remove useless code or variable, keep comments for useful tasks like TODO:
- **Deprecation policy**: Only deprecate APIs used by external applications. For internal code, remove unused code instead of deprecating

## Solution Philosophy: Simplest but Never Easiest

**Core Principle**: Always choose the simplest solution that maintains code quality and type safety. NEVER choose the easiest solution that compromises quality.

### TypeScript Type Issues
- ❌ **EASIEST (FORBIDDEN)**: Remove types, use `any`, or ignore TypeScript errors
- ❌ **TOO COMPLEX**: Over-engineered generics with multiple constraints and complex utility types
- ✅ **SIMPLEST**: Add minimal, functional, strongly-typed solution that solves the exact problem

**Example - API Response Typing**:
```typescript
// ❌ EASIEST (FORBIDDEN)
const data: any = await response.json()

// ❌ TOO COMPLEX
type ApiResponse<T, K extends keyof T, U = Pick<T, K>> = {
  data: U extends infer R ? R : never
  meta: Record<string, unknown>
}

// ✅ SIMPLEST
type UserResponse = {
  data: User
  meta: { total: number }
}
```

### Error Handling
- ❌ **EASIEST (FORBIDDEN)**: Ignore errors, use empty catch blocks, or suppress warnings
- ❌ **TOO COMPLEX**: Complex error hierarchies with multiple inheritance levels
- ✅ **SIMPLEST**: Proper error handling with clear, actionable error messages and appropriate error types

### State Management
- ❌ **EASIEST (FORBIDDEN)**: Global variables, direct DOM manipulation, or uncontrolled mutations
- ❌ **TOO COMPLEX**: Over-abstracted state machines for simple boolean flags
- ✅ **SIMPLEST**: Use appropriate state management for the scope (local state for components, context for shared state, proper state managers for complex apps)

### Function Design
- ❌ **EASIEST (FORBIDDEN)**: Huge functions that do everything, copy-paste code
- ❌ **TOO COMPLEX**: Micro-functions for every operation, over-abstracted utilities
- ✅ **SIMPLEST**: Single-responsibility functions with clear names and proper abstraction level

### Import Management
- ❌ **EASIEST (FORBIDDEN)**: Import entire libraries for one function (`import * as _`)
- ❌ **TOO COMPLEX**: Create elaborate barrel exports for simple utilities
- ✅ **SIMPLEST**: Import only what you need with clear, descriptive imports

### Performance Optimization
- ❌ **EASIEST (FORBIDDEN)**: Ignore performance issues, use `setTimeout` hacks
- ❌ **TOO COMPLEX**: Premature optimization with complex memoization everywhere
- ✅ **SIMPLEST**: Profile first, optimize bottlenecks with appropriate techniques (useMemo, useCallback only when needed)

### Testing
- ❌ **EASIEST (FORBIDDEN)**: Skip tests, mock everything to avoid real testing
- ❌ **TOO COMPLEX**: Test every internal implementation detail with complex mocks
- ✅ **SIMPLEST**: Test behavior and public APIs, mock external dependencies only

## Decision Framework

Before implementing any solution, ask:
1. Does this solution maintain type safety? (If no, it's easiest, not simplest)
2. Does this solution solve the exact problem without over-engineering?
3. Is this solution maintainable and readable?
4. Will this solution scale appropriately with the codebase?

## Comments Guidelines
- Add comments sparingly, only for complex features requiring explanation
- Comments should be concise and comprehensible
- **Comments MUST be in English only** - never use other languages
- **NEVER add comments in JSON files** - JSON does not support comments and they will make the file invalid