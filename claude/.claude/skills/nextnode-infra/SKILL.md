---
name: nextnode-infra
description: >-
  NextNode core monorepo overview and entry point. Audits any NextNode
  project for compliance with standards, logger, and infrastructure
  conventions. Load when the user asks to audit a NextNode project, when
  working in a repo of the GitHub `NextNodeSolutions` org, or when any
  @nextnode-solutions/* package appears in package.json.
user-invocable: true
synced-at: 444e619
---

# NextNode Core Monorepo

`@nextnode/core` - pnpm workspaces + Turborepo, ESM only, Node >=24.

## Packages

| Package | Type | Purpose |
|---------|------|---------|
| `@nextnode-solutions/standards` | config | oxlint, oxfmt, TypeScript, Tailwind, Vitest, commitlint, lint-staged, semantic-release, tsdown configs |
| `@nextnode-solutions/logger` | library | Zero-dep TS logger, transports (console + HTTP), testing utilities |
| `@nextnode-solutions/email-manager` | library | Template-first email sending (React Email + Resend), Result-pattern API |
| `@nextnode-solutions/brand-assets` | static | SVG/PNG logos, icons, favicons, social avatars (subpath wildcard exports) |
| `@nextnode-solutions/infrastructure` | CLI (private) | Config-driven CI/CD CLI - never published, consumed from monorepo by Actions |
| `@nextnode-solutions/monitoring` | app (private) | Internal Astro 5 dashboard at `monitoring.nextnode.fr`, Tailscale-only, Navy design language |

All publishable packages use **tsdown** (no tsup remaining). All run on Node >=24, ESM-only. Check the monorepo root `package.json` `packageManager` field for the authoritative pnpm version before enforcing on client projects.

## Instructions

### Compliance audit (default behavior)

1. **Read the project** - `package.json`, config files, `nextnode.toml`, existing imports
2. **Run the checklist** below against the project state
3. **Present the results** as a table: item, status (pass/missing/misconfigured), detail

   | Item | Status | Detail |
   |------|--------|--------|
   | `pnpm-lock.yaml` exists | pass | - |
   | `@nextnode-solutions/standards` version | misconfigured | installed 1.4.0, npm latest 1.6.2 |
   | `nextnode.toml` `[project]` section | missing | file not found |
   | Tests use `createSpyLogger()` | pass | - |

4. **Ask the user**:
   > "Want me to bring the project to 100% compliance, or pick specific items to fix?"
   - If 100%: fix everything
   - If selective: list the missing/misconfigured items and let the user choose

### Compliance checklist

#### Package manager & runtime
- [ ] `pnpm-lock.yaml` exists (not npm/yarn/bun)
- [ ] `package.json` has `"packageManager": "pnpm@<version>"` (exact version)
- [ ] `package.json` has `"type": "module"`
- [ ] `engines.node` >= 24

#### NextNode package versions (MANDATORY - check first)
For every `@nextnode-solutions/*` dep in `package.json`, compare the **installed** version (from `pnpm-lock.yaml` or `node_modules/<pkg>/package.json`) against the **latest** on npm via `npm view <pkg> version`. Flag any mismatch as **outdated**, even if the package.json range (`^1.5.1`) would allow the newer version - what matters is what's actually installed.

- [ ] `@nextnode-solutions/standards` - installed version == npm latest
- [ ] `@nextnode-solutions/logger` - installed version == npm latest
- [ ] `@nextnode-solutions/infrastructure` - installed version == npm latest (if used)
- [ ] Any other `@nextnode-solutions/*` dep - installed version == npm latest

**Why**: Outdated installs = CI failures that don't reproduce locally.

**How to resolve**: `pnpm update <pkg>` (or `pnpm update @nextnode-solutions/*` for all).

#### Standards / Testing / Commits / Publishing
For the detailed setup of `@nextnode-solutions/standards` (oxlint, oxfmt incl. import sorting, TypeScript, vitest, commitlint, lint-staged, semantic-release configs and their required scripts), see `/nextnode-standards` "Complete project setup checklist". Audit ALL items from that checklist as part of compliance.

#### CI/CD and Backing services

For the full CI/CD and backing-services checklist (nextnode.toml structure, Dockerfile/compose rules, SITE_URL, secrets vs build_args, cross-service URLs, upstream images, volumes, R2, Postgres, Supabase), load `cicd-checklist.md` on demand. The audit item names below are the top-level pass/fail gates; consult `cicd-checklist.md` for the detail rules before proposing any fix.

- [ ] `nextnode.toml` `[project]` section — see `cicd-checklist.md`
- [ ] Correct reusable GitHub workflow — see `cicd-checklist.md`
- [ ] `Dockerfile` / `docker-compose.yml` / `$PORT` (for `type=app`) — see `cicd-checklist.md`
- [ ] `SITE_URL` — see `cicd-checklist.md`
- [ ] Secrets: global pool in `[deploy].secrets` + per-service least-privilege `secrets` — see `/nextnode-deploy` rules 25–26
- [ ] `build_args` vs `secrets` — see `cicd-checklist.md`
- [ ] Cross-service URLs — see `cicd-checklist.md`
- [ ] R2/Postgres/Supabase backing services — see `cicd-checklist.md`

#### Logger (if used)
- [ ] `@nextnode-solutions/logger` imported (not `console.log`)
- [ ] Logger injected via constructor/parameter (not global import in business logic)
- [ ] Tests use the testing utilities from `logger/testing` — see `/nextnode-logger` for the full API (`createSpyLogger`, `createNoopLogger`, `createMockLogger`)

#### Date handling (if used)
- [ ] No date lib (`date-fns`, `luxon`, `dayjs`, `moment`) in deps — see Rule 6 (flag to user before touching app code)
- [ ] Date/time code uses `Temporal` from `@js-temporal/polyfill` — see Rule 6

## Sub-skills

| Skill | What it covers |
|-------|----------------|
| `/nextnode-standards` | oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged, semantic-release |
| `/nextnode-logger` | Logger API, transports, testing utilities |
| `/nextnode-deploy` | nextnode.toml, CI pipeline, deployment |
| `/nextnode-design` | Brand colors, typography, logos, UI conventions |

### MANDATORY dispatch

**When a compliance gap is found, load the owning sub-skill BEFORE proposing any fix. Never fix from memory.**

| Gap category | Load before fixing |
|---|---|
| Standards / Testing / Commits / Publishing | `/nextnode-standards` |
| CI/CD / deploy / Dockerfile / nextnode.toml | `/nextnode-deploy` |
| Logger usage or testing utilities | `/nextnode-logger` |
| Brand colors / typography / logos | `/nextnode-design` |

## FORBIDDEN (audit agent)

| FORBIDDEN | Why |
|---|---|
| Running `pnpm install` or making destructive file changes without user confirmation | Audit is read-only; user opts in to fixes |
| Inferring compliance from `package.json` version ranges alone | Ranges lie; always check the lockfile or `node_modules/<pkg>/package.json` |
| Asserting the pnpm version without checking the monorepo `packageManager` field | Version stales; the field is the source of truth |

## Rules

1. **Standards first** - every project MUST use `@nextnode-solutions/standards`
2. **Config-driven** - behavior from `nextnode.toml`, not hardcoded
3. **Always check NextNode package freshness** - see "NextNode package versions (MANDATORY)" above; outdated installs are the #1 cause of CI-only failures.
6. **Dates go through Temporal, never `Date` or date libraries** - use TC39 Temporal via `@js-temporal/polyfill`. BAN `date-fns`, `luxon`, `dayjs`, `moment`, and raw `Date` arithmetic for new code. Install per-package: `pnpm add @js-temporal/polyfill`. Use `Temporal.Instant.from(iso)`, `Temporal.PlainDate`, `.since()`, `.total('minute')` instead of `new Date()` math or `getTime()` subtraction. `Date.now()` is acceptable only as epoch-ms input to `Temporal.Instant.fromEpochMilliseconds(Date.now())`.
