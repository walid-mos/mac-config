---
name: nextnode-standards
description: "Audit a NextNode/SaaS project against all NextNode standards — produces a compliance report with pass/fail/missing status for every required item."
user-invocable: true
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# NextNode Standards Audit

Full compliance checker for NextNode projects. Reads project files and produces a structured report showing what's compliant, what's missing, and what needs fixing.

> **Source of truth:** This audit references the `standards`, `logger`, `email-manager`, and `nextnode` skills for expected values. When those skills are updated via `/learn`, this audit automatically uses the latest information. **Do NOT hardcode package-specific details here — always defer to the package skills.**

## When This Skill Runs

- **Auto-load**: runs automatically when working in a NextNode/SaaS project directory
- **Manual**: user invokes `/nextnode-standards` to get a full report

### Auto-load behavior

On auto-load, run the audit **silently** — only speak up if there are FAIL or MISSING items. If everything passes, do NOT print anything.

### Manual invocation behavior

On `/nextnode-standards`, always print the **full report** regardless of status.

---

## Audit Procedure

Read the following files from the project root (in parallel for speed). If a file doesn't exist, mark it as MISSING.

### Files to read

| File | Check |
|------|-------|
| `package.json` | dependencies, devDependencies, scripts, packageManager |
| `nextnode.toml` | `[project]` section (name, type, domain) |
| `Dockerfile` | multi-stage build, non-root user (apps only) |
| `docker-compose.yml` | service structure (apps only, optional if Dockerfile exists) |
| `.github/workflows/deploy-dev.yml` | reusable pipeline reference (deploy dev) |
| `.github/workflows/deploy-prod.yml` | reusable pipeline reference (deploy prod) |
| `oxlint.json` | extends from standards (refer to `standards` skill, section "oxlint") |
| `oxfmt.json` | extends from standards (refer to `standards` skill, section "oxfmt") |
| `tsconfig.json` | extends from standards (refer to `standards` skill, section "TypeScript") |
| `commitlint.config.js` | re-exports from standards (refer to `standards` skill, section "Commitlint") |
| `lint-staged.config.js` | re-exports from standards (refer to `standards` skill, section "lint-staged") |
| `.husky/pre-commit` | contains `lint-staged` |
| `.husky/commit-msg` | contains `commitlint` |
| `vitest.config.ts` | extends from standards (only if vitest in deps — refer to `standards` skill, section "Vitest") |
| main CSS file (e.g., `app.css`) | imports standards Tailwind theme (only if tailwindcss in deps — refer to `standards` skill, section "Tailwind") |

---

## Check Definitions

### 1. `nextnode.toml`

Refer to the `nextnode` skill for the canonical template and valid keys.

**Checks:**

- **PASS**: file exists with `[project]` containing `name` and `type`
- **PASS**: if `type = "app"`, `domain` is set (or project is internal-only via `[server].internal = true`)
- **PASS**: all present sections use valid keys (no unknown keys)
- **FAIL**: file exists but missing `name` or `type`
- **FAIL**: `[health].endpoint` used instead of `[health].path` (renamed)
- **WARN**: `[deploy].zero_downtime = true` without health check configured
- **WARN**: `[sablier].enabled = true` (default) but app is internal — Sablier only works with public Caddy
- **MISSING**: file does not exist

### 2. `package.json` — Core Dependencies

Check `devDependencies` for mandatory packages. Refer to the `standards` skill (section "Installation") for the required list:

- `@nextnode-solutions/standards` — **MANDATORY**
- Required peer deps from the `standards` skill — **MANDATORY**
- `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`, `better-sort-package-json` — **MANDATORY**

Check `dependencies` or `devDependencies` for optional packages — report as INFO (not FAIL):

- Packages documented in the `logger` skill — recommended for apps
- Packages documented in the `email-manager` skill — only if app sends emails
- `vitest` — recommended
- `tailwindcss` — only if project uses Tailwind

### 3. `package.json` — Scripts

Required scripts are defined in the `standards` skill (section "Required `package.json` Scripts"). Check that they exist and contain the expected commands.

Conditional scripts (only required if vitest in deps):
- `test` must contain `vitest`

### 4. `package.json` — Package Manager

- **PASS**: no `package-lock.json` or `yarn.lock` in project root
- **FAIL**: `package-lock.json` or `yarn.lock` exists (must use pnpm)

### 5. Config Files — Extends Standards

For each config file, verify it extends from `@nextnode-solutions/standards`. The exact extends paths are documented in the `standards` skill (section "Configuration Setup Per Tool"):

- `oxlint.json` must extend from the oxlint base config
- `oxfmt.json` must extend from the oxfmt base config
- `tsconfig.json` must extend from the appropriate TypeScript variant (library/nextjs/astro)
- `commitlint.config.js` must re-export from the commitlint config
- `lint-staged.config.js` must re-export from the lint-staged config

If the file exists but does NOT extend from standards: **FAIL**.
If the file does not exist: **MISSING**.

### 6. Husky Hooks

- `.husky/pre-commit` must exist and contain `lint-staged`
- `.husky/commit-msg` must exist and contain `commitlint`

### 7. CI Pipelines (`.github/workflows/`)

Check both workflow files:

**`deploy-dev.yml`**:
- **PASS**: file exists and contains `NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main`
- **FAIL**: file exists but uses custom logic instead of the reusable pipeline
- **MISSING**: file does not exist

**`deploy-prod.yml`**:
- **PASS**: file exists and contains `NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main` with `action: deploy-prod`
- **FAIL**: file exists but uses custom logic instead of the reusable pipeline
- **MISSING**: file does not exist

### 8. Docker (Apps Only)

Skip these checks if `type = "package"` in `nextnode.toml`.

**`Dockerfile`:**
- **PASS**: file exists with multi-stage build (`FROM ... AS builder` + `FROM ... AS runtime`)
- **WARN**: file exists but no multi-stage build
- **WARN**: build-only variables (`HUSKY`, `CI`) declared as `ENV` — the infra CLI's `parseDockerfileEnv()` treats all `ENV` declarations as required runtime secrets. Inline them in `RUN` commands instead (e.g., `RUN HUSKY=0 CI=true pnpm install ...`)
- **MISSING**: file does not exist — **FAIL** if `docker-compose.yml` also missing (no deploy strategy)

**`docker-compose.yml`:**
- **PASS**: file exists with a `services` block
- **SKIP**: file does not exist but `Dockerfile` exists — infrastructure auto-generates compose at deploy time
- **FAIL**: neither `docker-compose.yml` nor `Dockerfile` exist (no deploy strategy at all)

### 9. No Barrel Exports

Quick scan: check if any `src/**/index.ts` files exist that only re-export (barrel pattern). Report as **WARN** if found.

---

## Report Format

Output the report using this exact format:

```
## NextNode Standards Audit — <project-name>

Type: <app|package> | Domain: <domain or n/a>

### Summary: X/Y checks passed

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | nextnode.toml | PASS | [project] name=foo, type=app |
| 2 | @nextnode-solutions/standards | PASS | v1.2.3 in devDependencies |
| 3 | oxlint + oxfmt | PASS | Both in devDependencies |
| 4 | oxlint.json extends standards | PASS | |
| 5 | oxfmt.json extends standards | PASS | |
| 6 | tsconfig.json extends standards | PASS | typescript/astro |
| 7 | commitlint.config.js | PASS | Re-exports from standards |
| 8 | lint-staged.config.js | PASS | Re-exports from standards |
| 9 | Husky hooks | PASS | pre-commit + commit-msg |
| 10 | package.json scripts | FAIL | Missing: format:check |
| 11 | pnpm enforced | PASS | No package-lock.json or yarn.lock |
| 12 | CI pipeline (deploy-dev.yml) | PASS | Uses reusable workflow |
| 13 | CI pipeline (deploy-prod.yml) | PASS | Uses reusable workflow |
| 14 | Dockerfile | WARN | No multi-stage build |
| 15 | docker-compose.yml | SKIP | Not needed — Dockerfile present, infra auto-generates compose |
| 16 | Barrel exports | PASS | None found |

### Issues to Fix

1. **FAIL** — `package.json` scripts: add the missing script (refer to `standards` skill for expected command)
2. **WARN** — `Dockerfile`: consider using multi-stage build for smaller image

### Optional Packages

- `@nextnode-solutions/logger` — not installed (recommended for apps, see `logger` skill)
```

### Status Legend

| Status | Meaning |
|--------|---------|
| PASS | Compliant |
| FAIL | Non-compliant — must fix |
| MISSING | Required file/dep not found — must add |
| WARN | Not mandatory but recommended |
| SKIP | Not applicable (e.g., Docker checks for packages) |

---

## After the Report

If there are FAIL or MISSING items, **ask the user** if they want Claude to fix them automatically. Group fixes by type:

1. **Install missing dependencies** — single `pnpm add -D` command (use versions from the `standards` skill)
2. **Create missing config files** — generate from the patterns documented in the `standards` skill
3. **Fix existing config files** — add missing `extends` or re-export (use paths from `standards` skill)
4. **Add missing scripts** — patch `package.json` (use commands from `standards` skill)
5. **Set up husky** — init + create hook files
6. **Create Docker files** — generate `Dockerfile` from template if missing (apps only). Do NOT create `docker-compose.yml` when only a `Dockerfile` exists — the infrastructure auto-generates compose at deploy time. **Important:** never declare build-only variables (`HUSKY`, `CI`) as `ENV` — inline them in `RUN` commands (e.g., `RUN HUSKY=0 CI=true pnpm install ...`) so the infra CLI doesn't treat them as required runtime secrets
7. **Create CI workflow** — copy reusable pipeline template (from `nextnode` skill)
8. **Create nextnode.toml** — prompt for project name/type/domain, generate using the canonical template from the `nextnode` skill

Never auto-fix without asking first.
