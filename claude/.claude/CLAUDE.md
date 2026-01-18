# Global Claude Code Instructions

Universal instructions for Claude Code across all projects.

## Communication Style

- Concise and direct
- No emojis unless explicitly requested
- Focus on technical accuracy over validation
- **English ONLY** - All responses, code, comments, commits in English
- User may write in French, but Claude responds in English always

---

## CORE PRINCIPLES (MANDATORY)

These principles are MANDATORY and must be applied to ALL code development.

### Development Philosophy: Simplest but Never Easiest

Always choose the simplest solution that maintains code quality and type safety. NEVER choose the easiest solution that compromises quality.

**Decision Framework** - Before implementing, ask:
1. Does this solution maintain type safety?
2. Does this solution solve the exact problem without over-engineering?
3. Is this solution maintainable and readable?
4. Will this solution scale appropriately with the codebase?

### DRY and SOLID

**DRY**: Apply only when it provides real value, not just to reduce lines.
- Repeated business logic with same behavior → Extract
- Configuration-specific code → Don't extract
- Similar-looking code with different semantics → Don't extract

**SOLID**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.

See @~/.claude/guidelines/refactoring.md for detailed guidance.

### Composition Over Inheritance

Composition is the PRIMARY pattern for code reuse. Inheritance ONLY for shallow, true "is-a" relationships.

**Use Composition When:**
- Need code reuse without "is-a" relationship
- Want runtime flexibility or behavior swapping
- Components share behavior but aren't subtypes

**Use Inheritance Only When:**
- Genuine "is-a" relationship exists
- Hierarchy stays shallow (1-2 levels max)
- Base class designed for extension

### Function Extraction Guidelines

Functions exist to implement FEATURES through composition, not to wrap trivial operations.

**Extract When:**
- Feature implementation with real business logic
- Required for DI, interfaces, or composition
- Encapsulates complex logic (3+ meaningful lines)
- Used in 3+ places with identical behavior
- Function name adds significant semantic clarity

**Don't Extract:**
- Simple 1-2 line wrappers
- Configuration getters
- Single-use "helper" functions

### Early Returns & No Else

**Early Returns**: Handle simple/edge cases first with early returns. Keep main logic at base indentation.

**No Else**: Almost NEVER use `else`. Early returns eliminate the need for `else` in virtually all cases.

---

## CRITICAL RULES

### Security

@~/.claude/rules/security.md

### Branch Protection

@~/.claude/rules/branch-protection.md

### No Fallbacks (MANDATORY)

**RULE**: NEVER add fallback values, default behaviors, or defensive defaults unless EXPLICITLY requested.

**FORBIDDEN without explicit request:**
- Default values for missing data (`?? 'default'`, `|| fallback`)
- Fallback UI states ("No data available", placeholder content)
- Alternative paths when primary fails
- Graceful degradation logic
- "Safe" defaults that mask potential issues

**When to PROPOSE (not implement):**
- API response could legitimately be empty
- External dependency might be unavailable
- User input could be missing

**How to propose:**
```
Note: This could fail if X is missing. Should I add a fallback for that case?
```

**Why this matters:**
- Fallbacks hide bugs and configuration issues
- Unexpected defaults create silent failures
- User should decide failure behavior, not Claude

### Git Workflow

@~/.claude/rules/workflow.md

### Context7 Integration

@~/.claude/rules/context7.md

---

## QUICK REFERENCE

**Before ANY work:**
- [ ] Not on main/develop branch?
- [ ] Pre-commit hooks enabled?

**During development:**
- [ ] Strong typing (no `any`)
- [ ] Tests written
- [ ] Functions for features, not wrappers
- [ ] Composition over inheritance
- [ ] Early returns for simple cases
- [ ] No fallbacks without explicit request

**Before commit:**
- [ ] Lint passed
- [ ] Type-check passed (if TypeScript)
- [ ] Tests passed
- [ ] No secrets exposed
- [ ] Conventional commit message

---

## CODE STANDARDS

Detailed coding standards are maintained in separate guideline files:

### Universal Standards
- **Agent Design**: @~/.claude/guidelines/agents.md
- **Naming Conventions**: @~/.claude/guidelines/naming-conventions.md
- **Refactoring Guidelines**: @~/.claude/guidelines/refactoring.md

### Language/Framework-Specific Standards
- **TypeScript/JavaScript**: @~/.claude/guidelines/typescript.md
- **TypeScript Anti-Patterns**: @~/.claude/guidelines/typescript-antipatterns.md
- **Tailwind CSS**: @~/.claude/guidelines/tailwind.md
- **React Anti-Patterns**: @~/.claude/guidelines/react-antipatterns.md
- **Vitest Testing**: @~/.claude/guidelines/vitest.md
- **NextNode Logger**: @~/.claude/guidelines/nextnode-logger.md
- **Data Fetching & Error Handling**: @~/.claude/guidelines/typescript-data-fetching.md

### Brand-Specific Standards
- **NextNode Brand Guidelines**: @~/.claude/guidelines/nextnode-brand.md

---

## Development Contexts

Context files for different project categories. These are loaded automatically and provide awareness of the full development environment.

### Root Context

@~/.claude/contexts/development.md

### Category Contexts

@~/.claude/contexts/nextnode.md

@~/.claude/contexts/saas.md

@~/.claude/contexts/clients.md

@~/.claude/contexts/apps.md

@~/.claude/contexts/personal.md

---

## Configuration

### Structure

```
~/.claude/
├── CLAUDE.md           # This file (global)
├── settings.json       # Permissions, env, sandbox
├── contexts/           # Development contexts
│   ├── development.md
│   ├── nextnode.md
│   ├── saas.md
│   ├── clients.md
│   ├── apps.md
│   └── personal.md
├── rules/              # Enforcement rules
│   ├── workflow.md
│   ├── security.md
│   ├── branch-protection.md
│   └── context7.md
└── guidelines/         # Detailed coding standards
```

### Stow Deployment

This file is managed by GNU Stow:
- Source: `~/.stow_repository/claude/.claude/CLAUDE.md`
- Target: `~/.claude/CLAUDE.md`

Deploy: `cd ~/.stow_repository && stow claude`
