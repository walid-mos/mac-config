# Branch Protection Rules

## Critical Rule

**NEVER work directly on protected branches (main, master, develop)**

## Detection

Check current branch before any file modification:
```bash
git branch --show-current
```

## Protected Branches

- `main`
- `master`
- `develop`
- Any branch matching `production/*`

## Required Actions

If current branch is protected:

1. **Stop immediately** - Do not make any edits
2. **Ask user** which base branch to use
3. **Create feature branch**:
   ```bash
   git checkout -b feature/description-here
   ```
4. **Verify switch**:
   ```bash
   git branch --show-current
   ```
5. **Proceed** with changes only after verification

## Feature Branch Naming

Use descriptive names with prefixes:
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions/updates
- `chore/` - Maintenance tasks

Examples:
- `feature/user-authentication`
- `fix/memory-leak-in-parser`
- `refactor/extract-validation-logic`

## Pre-commit Hook Integration

If pre-commit hooks are configured, they should block edits on protected branches.

## Exceptions

**NONE** - This rule has no exceptions.
