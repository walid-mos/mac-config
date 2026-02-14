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

## When This Skill Runs

- **Auto-load**: runs automatically when working in a NextNode/SaaS project directory
- **Manual**: user invokes `/nextnode-standards` to get a full report

### Auto-load behavior

On auto-load, run the audit **silently** — only speak up if there are FAIL or MISSING items. If everything passes, do NOT print anything. This keeps the experience clean.

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
| `.github/workflows/ci.yml` | reusable pipeline reference |
| `oxlint.json` | extends from `@nextnode-solutions/standards/oxlint` |
| `oxfmt.json` | extends from `@nextnode-solutions/standards/oxfmt` |
| `tsconfig.json` | extends from `@nextnode-solutions/standards/typescript/*` |
| `commitlint.config.js` | re-exports from `@nextnode-solutions/standards/commitlint` |
| `lint-staged.config.js` | re-exports from `@nextnode-solutions/standards/lint-staged` |
| `.husky/pre-commit` | contains `lint-staged` |
| `.husky/commit-msg` | contains `commitlint` |
| `vitest.config.ts` | extends from standards (only if vitest in deps) |
| main CSS file (e.g., `app.css`) | `@import "@nextnode-solutions/standards/tailwind"` (only if tailwindcss in deps) |

---

## Check Definitions

### 1. `nextnode.toml`

**Canonical template** (reference for what a complete nextnode.toml looks like):

```toml
[project]
name = "my-app"                    # REQUIRED — no default
type = "app"                       # REQUIRED — "app" | "package" | "monitoring"
description = "Description"        # Optional
domain = "app.nextnode.fr"         # App-only — required when type = "app"
redirect_domains = ["www.app.fr"]  # Optional — domains that 301→canonical (prod only, auto-adds www)

[scripts]                          # Optional — defaults shown
lint = "lint"
test = "test"
build = "build"

# === Package-only ===
[package]
scope = "@nextnode"
access = "public"                  # "public" | "restricted"
canary_on_label = true

# === App-only: Server ===
[server]                           # No [server] = shared VPS (Tier 1)
type = "cpx22"                     # Hetzner server type (default: cpx22)
location = "nbg1"                  # Hetzner datacenter (default: nbg1)
internal = false                   # true = grey cloud / Tailscale-only

[volume]
enabled = false                    # Default: false
size = 20                          # GB

[deploy]
port = 4321                        # Container port (auto-injected as APP_PORT)
file = "docker-compose.yml"        # Explicit compose path (auto-detected if omitted)
zero_downtime = false              # Blue-green zero-downtime deployment

[health]
type = "http"                      # "http" | "tcp"
path = "/health"                   # HTTP health check path
interval = "30s"
timeout = "10s"
retries = 3

[sablier]                          # Idle container auto-stop (non-prod only)
enabled = true                     # Default: true
session_duration = "15m"           # Idle timeout before stopping containers
display_name = "My App"            # Display name on waiting page (default: project.name)

[environment.dev]
enabled = true                     # Default: true — set false to skip dev deployment

[environment.prod]
enabled = true                     # Default: true — set false to skip prod deployment

# Per-env server overrides (Tier 3/4)
# [environment.dev.server]
# type = "cx22"
# [environment.prod.server]
# type = "cpx22"
```

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

Check `devDependencies` for:

| Dependency | Status |
|------------|--------|
| `@nextnode-solutions/standards` | **MANDATORY** |
| `oxlint` | **MANDATORY** |
| `oxfmt` | **MANDATORY** |
| `husky` | **MANDATORY** |
| `lint-staged` | **MANDATORY** |
| `@commitlint/cli` | **MANDATORY** |
| `@commitlint/config-conventional` | **MANDATORY** |
| `better-sort-package-json` | **MANDATORY** |

Check `dependencies` or `devDependencies` for optional packages — report as INFO (not FAIL):

| Dependency | Note |
|------------|------|
| `@nextnode-solutions/logger` | Recommended for apps |
| `@nextnode-solutions/email-manager` | Only if app sends emails |
| `vitest` | Recommended |
| `tailwindcss` | Only if project uses Tailwind |

### 3. `package.json` — Scripts

Required scripts:

| Script | Expected command |
|--------|-----------------|
| `lint` | must contain `oxlint` |
| `format` | must contain `oxfmt --write` |
| `format:check` | must contain `oxfmt --check` |
| `prepare` | must contain `husky` |
| `build` | must exist (any value) |

Conditional scripts (only required if vitest in deps):

| Script | Expected command |
|--------|-----------------|
| `test` | must contain `vitest` |

### 4. `package.json` — Package Manager

- **PASS**: no `package-lock.json` or `yarn.lock` in project root
- **FAIL**: `package-lock.json` or `yarn.lock` exists (must use pnpm)

### 5. Config Files — Extends Standards

For each config file, verify it extends from `@nextnode-solutions/standards`:

| File | Must contain |
|------|-------------|
| `oxlint.json` | `"extends"` includes `"@nextnode-solutions/standards/oxlint"` |
| `oxfmt.json` | `"extends"` includes `"@nextnode-solutions/standards/oxfmt"` |
| `tsconfig.json` | `"extends"` contains `"@nextnode-solutions/standards/typescript/"` |
| `commitlint.config.js` | references `@nextnode-solutions/standards/commitlint` |
| `lint-staged.config.js` | references `@nextnode-solutions/standards/lint-staged` |

If the file exists but does NOT extend from standards: **FAIL**.
If the file does not exist: **MISSING**.

### 6. Husky Hooks

- `.husky/pre-commit` must exist and contain `lint-staged`
- `.husky/commit-msg` must exist and contain `commitlint`

### 7. CI Pipeline (`.github/workflows/ci.yml`)

- **PASS**: file exists and contains `NextNodeSolutions/infrastructure/.github/workflows/pipeline.yml@main`
- **FAIL**: file exists but uses custom CI logic instead of the reusable pipeline
- **MISSING**: no CI workflow

### 8. Docker (Apps Only)

Skip these checks if `type = "package"` in `nextnode.toml`.

**`Dockerfile`:**
- **PASS**: file exists with multi-stage build (`FROM ... AS builder` + `FROM ... AS runtime`)
- **WARN**: file exists but no multi-stage build
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
| 12 | CI pipeline | PASS | Uses reusable workflow |
| 13 | Dockerfile | WARN | No multi-stage build |
| 14 | docker-compose.yml | SKIP | Not needed — Dockerfile present, infra auto-generates compose |
| 15 | Barrel exports | PASS | None found |

### Issues to Fix

1. **FAIL** — `package.json` scripts: add `"format:check": "oxfmt --check ."` to scripts
2. **WARN** — `Dockerfile`: consider using multi-stage build for smaller image

### Optional Packages

- `@nextnode-solutions/logger` — not installed (recommended for apps)
```

### Status legend

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

1. **Install missing dependencies** — single `pnpm add -D` command
2. **Create missing config files** — generate from templates (see `/nextnode` skill, Full App Compliance Kit)
3. **Fix existing config files** — add missing `extends` or re-export
4. **Add missing scripts** — patch `package.json`
5. **Set up husky** — init + create hook files
6. **Create Docker files** — generate `Dockerfile` from template if missing (apps only). Do NOT create `docker-compose.yml` when only a `Dockerfile` exists — the infrastructure auto-generates compose at deploy time
7. **Create CI workflow** — copy reusable pipeline template
8. **Create nextnode.toml** — prompt for project name/type/domain, generate using the canonical template from check #1. Minimal app example:

```toml
[project]
name = "my-app"
type = "app"
domain = "app.nextnode.fr"

[deploy]
port = 4321
```

Minimal package example:

```toml
[project]
name = "my-package"
type = "package"
```

Never auto-fix without asking first.
