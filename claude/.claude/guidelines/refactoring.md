# Intelligent Refactoring Guidelines

> For detailed refactoring analysis, use `@agent-code-refactor`

## Core Principle: Intelligent DRY Application

**Apply DRY only when it provides real value, not just for the sake of reducing lines.**

## When TO Apply DRY

### ✅ Repeated Business Logic with Same Behavior
```typescript
// ✅ GOOD - Same validation logic used everywhere
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
```

### ✅ Complex Calculations or Transformations
```typescript
// ✅ GOOD - Complex date formatting logic
const formatUserDate = (date: Date, timezone: string) => { /* complex logic */ }
```

### ✅ Error Handling Patterns with Consistent Behavior
```typescript
// ✅ GOOD - Consistent API error handling
const handleApiError = (error: ApiError) => { /* standardized handling */ }
```

## When NOT to Apply DRY

### ❌ Configuration-Specific Code
```typescript
// ❌ BAD - Don't create "lib/env.ts" for Dockerfile-specific env vars
// Dockerfile env vars ≠ Node.js env vars ≠ Browser env vars

// ❌ BAD - Don't create "lib/paths.ts" for import paths
// Import paths are context-specific and not reusable logic
```

### ❌ Similar-Looking Code with Different Semantics
```typescript
// ❌ BAD - User validation vs Product validation
// They might look similar now but will diverge with business requirements

// ❌ BAD - Development configs vs Production configs
// Similar structure but completely different purposes and lifecycles
```

### ❌ Platform or Environment-Specific Implementations
```typescript
// ❌ BAD - Sharing code between server-side and client-side
// Different execution contexts require different approaches

// ❌ BAD - Mobile vs Desktop UI components that look similar
// Different interaction patterns and constraints
```

### ❌ Temporary or Transitional Code
```typescript
// ❌ BAD - Extracting utilities during migration periods
// Code in transition should not be abstracted until the migration is complete
```

## Smart Refactoring Decision Framework

1. **Semantic Analysis**: Is the code truly doing the same thing, or just looking similar?
2. **Evolution Prediction**: Will these pieces likely evolve together or separately?
3. **Context Dependency**: Are the dependencies and constraints the same?
4. **Maintenance Burden**: Does the abstraction reduce or increase complexity?
5. **Team Boundaries**: Are these used by the same team or different teams?

## Refactoring Priorities (in order)

1. **Remove actual duplication** - Same logic, same purpose, same context
2. **Improve code clarity** - Extract meaningful abstractions with clear names
3. **Optimize performance** - Only if there are measurable bottlenecks
4. **Enhance type safety** - Strengthen TypeScript types without compromising readability
5. **Update patterns** - Apply modern patterns only if they improve maintainability

## Forbidden Abstractions

- **Generic utilities** that serve one specific use case
- **Config/environment wrappers** unless there's complex transformation logic
- **Path/routing abstractions** that are just string concatenation
- **Type-only modules** that don't add semantic value
- **Over-parameterized functions** with multiple boolean flags
- **Premature abstractions** for code that might change

## Quality Gates Before Extraction

Before extracting any code, verify:

1. **Usage Count**: Is it used in 3+ different contexts with identical behavior?
2. **Stability**: Has the pattern been stable for at least 2 weeks?
3. **Complexity**: Does the extraction simplify or complicate the codebase?
4. **Testing**: Can the extracted code be easily unit tested in isolation?
5. **Documentation**: Can the purpose be explained in one clear sentence?

## KISS Principle Implementation

Keep functions:
- **Single-purpose**: One clear responsibility
- **Small**: Generally under 20 lines
- **Readable**: Self-documenting with clear names
- **Testable**: Easy to unit test in isolation

Avoid:
- **Deep nesting**: Use early returns and guard clauses
- **Complex conditionals**: Break them into named functions
- **Magic numbers**: Use named constants
- **Unclear variable names**: Be descriptive over concise

## Quick Refactoring Checklist

Before committing refactored code:
- [ ] Does this solve a real duplication problem?
- [ ] Are the abstractions meaningful and clear?
- [ ] Will this code likely evolve together?
- [ ] Does this reduce or increase overall complexity?
- [ ] Can this be easily tested and maintained?
- [ ] Is the naming clear and searchable?