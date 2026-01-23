# Global Claude Code Instructions

## Communication
- Concise and direct, no emojis
- **English ONLY** - All responses, code, comments, commits
- User may write in French, Claude responds in English

---

## CORE PRINCIPLES (MANDATORY)

### Simplest but Never Easiest
Choose the simplest solution that maintains quality and type safety. NEVER choose the easiest solution that compromises quality.

**Decision Framework:**
1. Does this maintain type safety?
2. Does it solve the exact problem without over-engineering?
3. Is it maintainable and readable?
4. Will it scale appropriately?

### DRY - Apply Intelligently
- Repeated business logic with same behavior -> Extract
- Configuration-specific code -> Don't extract
- Similar-looking code with different semantics -> Don't extract

### Composition Over Inheritance
Composition is PRIMARY. Inheritance ONLY for shallow (1-2 levels), true "is-a" relationships.

### Function Extraction
Extract when: real business logic, DI/interfaces, 3+ meaningful lines, used in 3+ places.
Don't extract: simple 1-2 line wrappers, config getters, single-use helpers.

### Early Returns & No Else
Handle edge cases first with early returns. Almost NEVER use `else`.

---

## CRITICAL RULES

### Security
@~/.claude/rules/security.md

### Branch Protection
@~/.claude/rules/branch-protection.md

### No Fallbacks (MANDATORY)
NEVER add fallback values or defensive defaults without explicit request.
- FORBIDDEN: `?? 'default'`, `|| fallback`, placeholder content
- PROPOSE instead: "This could fail if X is missing. Should I add a fallback?"

### Git Workflow
@~/.claude/rules/workflow.md

### Context7 Integration
Use Context7 PROACTIVELY for library/framework documentation:
1. `resolve-library-id` to get Context7-compatible ID
2. `get-library-docs` to fetch documentation
NEVER claim Context7 is unavailable without actually calling the tool.

---

## NAMING CONVENTIONS

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Pages | kebab-case | `user-profile.tsx` |
| Variables/const | camelCase | `userName`, `isActive` |
| Global constants | UPPER_CASE | `API_BASE_URL` |
| Functions | camelCase | `fetchUserData` |
| Event handlers | handle + Action | `handleClick` |
| Classes/Interfaces | PascalCase | `UserService` |
| Booleans | is/has/can/should | `isEnabled`, `hasPermission` |
| Arrays | plural nouns | `users`, `products` |

---

## QUICK REFERENCE

**Before ANY work:**
- [ ] Not on main/develop branch?
- [ ] Pre-commit hooks enabled?

**During development:**
- [ ] Strong typing (no `any`)
- [ ] Tests written
- [ ] Early returns for simple cases
- [ ] No fallbacks without explicit request

**Before commit:**
- [ ] Lint passed
- [ ] Type-check passed
- [ ] Tests passed
- [ ] No secrets exposed
- [ ] Conventional commit message

---

## CONTEXT-AWARE GUIDELINES

Claude auto-detects context via hooks and injects relevant rules:
- **TypeScript/React/Tailwind** -> Hooks inject summaries
- **NextNode projects** -> Brand guidelines activated
- **Testing keywords** -> Vitest best practices injected

For full details on any topic, use the corresponding skill:
- `/typescript` - Full TS coding standards
- `/react` - React anti-patterns
- `/tailwind` - Tailwind guidelines
- `/vitest` - Testing best practices
- `/nextnode-brand` - Brand colors and typography
- `/nextnode-logger` - Logger usage
- `/infrastructure` - Server and deployment context
- `/linear-specs` - Linear issue format

---

## AGENT DESIGN

Agents that crawl large codebases MUST spawn subagents:
1. Include `Task` in tools list
2. Partition by directory or file count
3. Threshold: > 20 files -> parallelize
4. Aggregate results before reporting

---

## CONFIGURATION

```
~/.claude/
├── CLAUDE.md           # This file
├── settings.json       # Permissions, env, hooks
├── commands/           # Skills (/typescript, etc.)
├── hooks/              # Detection hooks
└── rules/              # Critical rules
    ├── workflow.md
    ├── security.md
    └── branch-protection.md
```

Managed by GNU Stow:
- Source: `~/.stow_repository/claude/.claude/CLAUDE.md`
- Deploy: `cd ~/.stow_repository && stow claude`
