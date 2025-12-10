# Development Workflow Rules

## Mandatory Pipeline

Every code change must follow this pipeline:

```
Develop → Lint → Typecheck → Test → Review → Commit
```

## Step-by-Step Process

### 1. Development Phase

Write code following project conventions.

### 2. Linting

**Always run linter before commit:**

```bash
# For monorepo/package-specific
pnpm lint

# For npm projects
npm run lint

# Auto-fix if available
pnpm lint --fix
```

**Requirements:**
- Zero linting errors
- Zero linting warnings (unless explicitly allowed)
- Code style consistent

### 3. Type Checking

**For TypeScript projects:**

```bash
# Run type checker
pnpm type-check

# Or
pnpm tsc --noEmit
```

**Requirements:**
- Zero type errors
- No `any` types (use `unknown` or proper types)
- Strict mode enabled

### 4. Testing

**Run tests before commit:**

```bash
# All tests
pnpm test

# Watch mode during development
pnpm test:watch

# Coverage report
pnpm test:coverage
```

**Requirements:**
- All existing tests pass
- New code has test coverage
- Critical paths tested

### 5. Code Review (Self)

Before committing, review your changes:

```bash
# See what changed
git diff

# See staged changes
git diff --cached

# Review file by file
git diff --cached -- path/to/file
```

**Check for:**
- Debug statements removed (`console.log`, `debugger`)
- TODO comments addressed or tracked
- Comments explain "why", not "what"
- No commented-out code
- Formatting is consistent

### 6. Commit

**Format:** Conventional Commits

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Tests
- `chore` - Maintenance
- `perf` - Performance improvement

**Examples:**
```bash
git commit -m "feat(auth): add email verification"
git commit -m "fix(api): handle null response from database"
git commit -m "refactor(utils): extract validation logic"
```

## Pre-commit Hooks

**NEVER bypass pre-commit hooks:**

```bash
# ❌ NEVER DO THIS
git commit --no-verify

# ✅ ALWAYS DO THIS
git commit
```

If pre-commit fails:
1. Fix the issues
2. Stage the fixes
3. Retry commit

## Package Manager

**Detection Priority:**
1. If `pnpm-lock.yaml` exists → Use **pnpm**
2. If `package-lock.json` exists → Use **npm**
3. If `yarn.lock` exists → Use **yarn**
4. Default (no lockfile) → Use **pnpm**

**Why this order?**
- Respect the project's existing package manager choice
- Lockfiles ensure reproducible builds - don't mix package managers
- pnpm is preferred for new projects (faster, disk efficient)

```bash
# ✅ Detect and use correct package manager
# Check for lockfile first:
ls pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null

# pnpm project (pnpm-lock.yaml)
pnpm install
pnpm add package-name
pnpm run build

# npm project (package-lock.json)
npm install
npm add package-name
npm run build

# ❌ NEVER mix package managers
# Don't run `pnpm install` in a project with package-lock.json
# Don't run `npm install` in a project with pnpm-lock.yaml
```

## Pull Request Workflow

### Before Creating PR

```bash
# Update from base branch
git fetch origin
git rebase origin/main

# Final checks
pnpm lint
pnpm type-check
pnpm test
pnpm build

# All pass? Create PR
gh pr create
```

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- Bullet list of changes

## Testing
How was this tested?

## Screenshots (if UI changes)
[Add screenshots]

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Documentation updated
```

## Monorepo Considerations

For monorepos (pnpm workspaces, Turborepo):

```bash
# Run in specific package
pnpm --filter @scope/package-name lint
pnpm --filter @scope/package-name test

# Run for all affected packages
pnpm -r lint
pnpm -r test
```

## Emergency Hotfix

For critical production bugs:

1. Create hotfix branch from production:
   ```bash
   git checkout -b hotfix/critical-bug production
   ```

2. Fix the issue (still run tests!)

3. Fast-track review

4. Merge to production AND main

## Enforcement

These workflow rules are **MANDATORY**.
