# Development Workflow Rules

## Mandatory Pipeline

```
Develop -> Lint -> Typecheck -> Test -> Review -> Commit
```

## Step-by-Step Process

### 1. Linting
```bash
pnpm lint        # or npm run lint
pnpm lint --fix  # auto-fix
```
Zero errors, zero warnings, consistent style.

### 2. Type Checking
```bash
pnpm type-check  # or pnpm tsc --noEmit
```
Zero type errors. No `any`. Strict mode enabled.

### 3. Testing
```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```
All tests pass. New code has coverage.

### 4. Self Review
```bash
git diff --cached
```
Check: debug statements removed, TODOs addressed, no commented code.

### 5. Commit
**Format:** Conventional Commits
```
type(scope): description
```

**Types:** feat, fix, refactor, docs, test, chore, perf

---

## Pre-commit Hooks

**NEVER bypass:**
```bash
# FORBIDDEN
git commit --no-verify

# ALWAYS
git commit
```

---

## Package Manager Detection

1. `pnpm-lock.yaml` -> pnpm
2. `package-lock.json` -> npm
3. `yarn.lock` -> yarn
4. Default -> pnpm

**NEVER mix package managers.**

---

## YAML Validation (CRITICAL)

**The ONLY way to validate `.yml` or `.yaml` files is `yamllint`.**

```bash
yamllint file.yml
yamllint .github/workflows/
```

**FORBIDDEN:**
- Using Python to parse/validate YAML
- Using other YAML parsers for validation
- Assuming YAML is valid without explicit check

---

## TOML Validation (CRITICAL)

**The ONLY way to validate `.toml` files is `toml-test`.**

```bash
toml-test <decoder>
```

**FORBIDDEN:**
- Using Python to parse/validate TOML
- Using other TOML parsers for validation
- Assuming TOML is valid without explicit check

---

## Atomic Commits for Multi-Phase Plans

Ask: "Should I commit atomically after each phase?"

If yes: Complete phase -> lint/test -> commit -> next phase.

---

## Interactive Commands (CRITICAL)

Claude's subshells do NOT support interactive input.

**Protocol:**
1. Check Context7 for non-interactive flags (`--yes`, `-y`, `--no-input`)
2. If exists: use it
3. If truly interactive: ask user to run manually

**FORBIDDEN:**
- Forcing interactive commands through subshells
- Retrying interactive commands
- Bypassing tools by writing code manually

**Common CLIs with non-interactive modes:**
- `npm init -y`
- `npx create-next-app my-app --typescript --tailwind --use-pnpm`
- `gh` commands with `--yes`

---

## Plan Mode Workflow (MANDATORY)

**ALWAYS read existing plan file first.**

Decision framework:
1. New task unrelated -> CLEAN (replace)
2. New task supersedes old -> UPDATE (rewrite)
3. New task adds phases -> APPEND

**FORBIDDEN:**
- Writing plan without reading first
- Blindly appending to existing plan
- Leaving stale content mixed with new plan

---

## Infrastructure Fixes (CRITICAL)

**A manual fix on deployed infrastructure is NOT a fix.**

Any change made directly on:
- Terraform-managed resources
- GitHub Actions workflows
- VPS/servers (SSH, console)
- Docker containers/Swarm
- Cloud provider consoles

**Is only a temporary workaround until the fix is in code.**

**MANDATORY Protocol:**
1. Apply manual fix if urgent (to restore service)
2. **Immediately** reproduce the fix in source (Terraform, workflow, Packer, etc.)
3. Deploy via proper pipeline to validate
4. Document the incident if recurrent

**FORBIDDEN:**
- Claiming an issue is "fixed" after manual intervention only
- Closing tickets without code-level fix
- Forgetting to backport manual changes to IaC

**The only real fix is a committed, deployed change.**
