# Global Gemini Code Instructions

Universal instructions for Gemini Code across all projects.

## Communication Style

- Concise and direct
- No emojis unless explicitly requested
- Focus on technical accuracy over validation
- **English ONLY** - All responses, code, comments, commits in English
- User may write in French, but Gemini responds in English always

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

## BRAND-SPECIFIC STANDARDS

### NextNode Brand Guidelines

@~/.gemini/guidelines/nextnode-brand.md

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

---

## Configuration

```
~/.gemini/
├── GEMINI.md           # This file (global)
├── settings.json       # Permissions, hooks
├── hooks/              # Hook scripts
└── guidelines/         # Brand-specific standards
```

## Stow Deployment

Source: `~/.stow_repository/gemini/.gemini/GEMINI.md`
Target: `~/.gemini/GEMINI.md`

Deploy: `cd ~/.stow_repository && stow gemini`
