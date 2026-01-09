# Global OpenCode Instructions

Universal instructions for OpenCode across all projects.

## Communication Style

- Concise and direct
- No emojis unless explicitly requested
- Focus on technical accuracy over validation
- **English ONLY** - All responses, code, comments, commits in English
- User may write in French, but always respond in English

---

## CORE PRINCIPLES (MANDATORY)

### Development Philosophy

@~/.claude/guidelines/refactoring.md

### Code Standards

- **TypeScript**: @~/.claude/guidelines/typescript.md
- **TypeScript Anti-Patterns**: @~/.claude/guidelines/typescript-antipatterns.md
- **Naming Conventions**: @~/.claude/guidelines/naming-conventions.md
- **Tailwind CSS**: @~/.claude/guidelines/tailwind.md
- **React Anti-Patterns**: @~/.claude/guidelines/react-antipatterns.md
- **Vitest Testing**: @~/.claude/guidelines/vitest.md

---

## CRITICAL RULES

### Security

@~/.claude/rules/security.md

### Branch Protection

@~/.claude/rules/branch-protection.md

### Git Workflow

@~/.claude/rules/workflow.md

### Context7 Integration

@~/.claude/rules/context7.md

---

## SUBAGENTS

| Agent | When to Use |
|-------|-------------|
| `@fallback-detector` | Before commit to scan for error-masking fallbacks |
| `@nextnode-brand` | When working on NextNode projects |
| `@code-refactor` | For comprehensive refactoring with 100% coverage |
| `@security-review` | For OWASP-based security audits |
| `@project-scanner` | For codebase analysis and improvement plans |

---

## QUICK REFERENCE

**Before ANY work:**
- [ ] Not on main/develop branch?

**During development:**
- [ ] Strong typing (no `any`)
- [ ] Functions for features, not wrappers
- [ ] Composition over inheritance
- [ ] Early returns, no else
- [ ] No fallbacks without explicit request

**Before commit:**
- [ ] Lint passed
- [ ] Type-check passed
- [ ] Tests passed
- [ ] No secrets exposed
- [ ] Conventional commit message
- [ ] @fallback-detector scan (for important commits)

---

## Stow Deployment

Source: `~/.stow_repository/opencode/.config/opencode/AGENTS.md`
Target: `~/.config/opencode/AGENTS.md`

Deploy: `cd ~/.stow_repository && stow opencode`
