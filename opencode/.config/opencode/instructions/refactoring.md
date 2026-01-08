# Refactoring Guidelines

## Core Principle

Apply DRY only when it provides real value, not just to reduce lines.

## When TO Apply DRY

- **Repeated business logic** with same behavior
- **Complex calculations/transformations** used in multiple places
- **Error handling patterns** with consistent behavior

## When NOT to Apply DRY

- **Configuration-specific code** (env vars, paths)
- **Similar-looking code with different semantics** (user vs product validation)
- **Platform-specific implementations** (server vs client)
- **Temporary/transitional code** during migration

## Decision Framework

1. **Semantic**: Is the code truly doing the same thing?
2. **Evolution**: Will these pieces evolve together or separately?
3. **Context**: Are dependencies and constraints the same?
4. **Maintenance**: Does abstraction reduce or increase complexity?

## Quality Gates Before Extraction

1. Used in **3+ different contexts** with identical behavior?
2. Pattern stable for **2+ weeks**?
3. Extraction **simplifies** the codebase?
4. Can be **unit tested** in isolation?
5. Purpose explained in **one sentence**?

## Forbidden Abstractions

- Generic utilities for one use case
- Config/env wrappers without transformation logic
- Path/routing abstractions (just string concat)
- Type-only modules without semantic value
- Over-parameterized functions with boolean flags
- Premature abstractions for changing code

## KISS Implementation

**Keep functions:**

- Single-purpose (one responsibility)
- Small (generally < 20 lines)
- Readable (self-documenting names)
- Testable (easy to unit test)

**Avoid:**

- Deep nesting (use early returns)
- Complex conditionals (break into named functions)
- Magic numbers (use named constants)
- Unclear variable names
