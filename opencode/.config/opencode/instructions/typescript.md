# TypeScript Standards

## Module System

- **ALWAYS** use `import` - NEVER use `require()`
- Use `@/` paths when imports have more than `../`

## Functions

- **Arrow functions**: `const fn = () => {}` not `function fn() {}`
- **FORBIDDEN**: IIFE syntax `;(function() { ... })()`

## Type System

- **NEVER** use `any` - completely forbidden
- Prioritize strong typing over `unknown`
- Avoid `as` casting (except `as const`)
- Use type imports: `import type { X }` at end of imports

## React Imports

- **NEVER** import React entirely
- Import only what you use: `import { useState, useEffect }`
- Use `import type { ComponentRef }` not `React.ComponentRef`

## Code Structure

- Prioritize destructuring
- Use early returns to minimize nesting
- Prefer simple `if` over nested conditions
- Use `switch` only as last resort

## Error Handling

```typescript
// BAD
const data: any = await response.json()

// BAD - over-engineered
type ApiResponse<T, K extends keyof T, U = Pick<T, K>> = { ... }

// GOOD - minimal, typed
type UserResponse = { data: User; meta: { total: number } }
```

## Import Organization

1. External packages
2. Internal modules (`@/`)
3. Relative imports
4. Type imports (last)

## Maintenance

- Remove unused variables (don't workaround)
- No comments when removing code
- Delete unused code, don't deprecate internal APIs

## Comments

- Sparingly, only for complex features
- Concise and comprehensible
- **English ONLY**
- **NEVER** in JSON files
