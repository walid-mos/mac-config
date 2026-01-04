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

## Atomic Commits for Multi-Phase Plans

When implementing a plan with multiple phases or significant complexity:

1. **Ask the user**: "Should I commit atomically after each phase?"

2. **If user says yes**:
   - Complete each phase fully
   - Run lint/type-check/test for that phase
   - Create a focused, atomic commit
   - Move to next phase

3. **Benefits**:
   - Easy to review changes incrementally
   - Easy to revert specific phases if needed
   - Clear git history showing logical progression
   - Smaller, focused commits are easier to understand

**Example workflow:**
```bash
# Phase 1: Add data models
git commit -m "feat(models): add user and role entities"

# Phase 2: Add service layer
git commit -m "feat(services): add user authentication service"

# Phase 3: Add API endpoints
git commit -m "feat(api): add auth endpoints"

# Phase 4: Add tests
git commit -m "test(auth): add unit and integration tests"
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

## Quick Fix Exception

For small, trivial changes (typos, formatting), use `/quick-fix` command:
- Auto-fixes linting
- Skips tests
- **Only for non-functional changes**

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

These workflow rules are **MANDATORY** unless explicitly overridden by `/quick-fix` command for trivial changes.

## Interactive Commands (CRITICAL)

**RULE**: Claude's subshells do NOT support interactive input. Handle this properly.

### Mandatory Protocol

When a command requires interactivity:

1. **First**: Check with Context7 if the CLI supports non-interactive flags/configs
   - Many CLIs have `--yes`, `--no-input`, `--batch`, `-y` flags
   - Some support config files or environment variables

2. **If non-interactive mode exists**: Use it

3. **If truly interactive**: IMMEDIATELY ask the user to run it manually
   - Provide the exact command to run
   - Explain what inputs are needed
   - Wait for user to complete it

### FORBIDDEN Behaviors

**NEVER:**
- Attempt to force interactive commands through subshells
- Retry interactive commands hoping they'll work
- Create workarounds that bypass the intended tool (e.g., writing code from scratch instead of using a generator CLI)
- Pipe fake input to interactive prompts
- Try to "solve" the interactivity problem with hacks

### Examples

```bash
# ❌ FORBIDDEN - Trying to run interactive CLI
npx create-next-app  # Interactive prompts - won't work

# ✅ CORRECT - Check for non-interactive flags first
npx create-next-app my-app --typescript --tailwind --eslint --app --use-pnpm

# ❌ FORBIDDEN - Retrying or working around
# "The CLI is interactive so I'll just write the boilerplate manually"

# ✅ CORRECT - Ask user to run it
# "This CLI requires interactive input. Please run:
#    npx create-next-app
#  and follow the prompts. Let me know when done."
```

### Common CLIs with Non-Interactive Modes

- `npm init`: Use `npm init -y`
- `pnpm create`: Often has `--yes` or specific flags
- `npx create-*`: Usually has flags for all options
- `gh`: Most commands support `--yes` or input via flags
- `glab`: Similar to gh

**Always check Context7 first for the specific CLI's documentation.**

---

## Plan Mode Workflow (MANDATORY)

**RULE**: ALWAYS check existing plan file before writing a new plan.

### Plan File Management Protocol

When entering plan mode:

1. **ALWAYS read the plan file first** (if it exists)
2. **Compare** existing plan content vs new task requirements
3. **Decide action:**
   - **CLEAN**: If new task is completely unrelated → Delete old content, write new plan
   - **UPDATE**: If new task modifies/extends existing plan → Update relevant sections
   - **APPEND**: If new task adds to existing plan (multi-part work) → Append new section

### Decision Framework

Before writing to plan file, ask:

1. Does the existing plan relate to the current task?
   - NO → **CLEAN** (replace entirely)
   - YES → Continue to step 2

2. Does the new task supersede/replace the old plan?
   - YES → **UPDATE** (rewrite with new approach)
   - NO → Continue to step 3

3. Does the new task add additional phases/steps?
   - YES → **APPEND** (add new section)
   - NO → **UPDATE** (modify existing)

### FORBIDDEN Behaviors

**NEVER:**
- Write to plan file without reading it first
- Blindly append to existing plan (causes mixed/confusing content)
- Leave stale plan content mixed with new plan
- Assume plan file is empty

### Example

```
# Scenario: User had plan for "add authentication"
# Now user asks for "refactor database schema"

1. Read existing plan file → Contains auth implementation steps
2. Compare → New task (database) is unrelated to auth
3. Decision → CLEAN: Delete auth plan, write new database plan
```
