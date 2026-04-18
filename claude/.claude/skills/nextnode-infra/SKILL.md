---
name: nextnode-infra
description: >-
  NextNode core monorepo overview. Audits any NextNode project for compliance
  with standards, logger, and infrastructure conventions. Dispatches to
  sub-skills per package.
user-invocable: true
synced-at: 50e2bbd
---

# NextNode Core Monorepo

`@nextnode/core` — pnpm workspaces + Turborepo, ESM only, Node >=24.

## Company context

NextNode is the user's consulting business. Keep this in mind when suggesting architecture, packaging, or tooling trade-offs.

- **Owner**: freelance software engineer growing NextNode into a structured agency
- **Tech stack**: Node.js, Astro, React
- **Target clientele**: French PME/ETI (SMBs and mid-caps)
- **Product positioning**: externalized CTO — owns the full IT scope, small projects to large ones
- **Freelance clients** (personal, billed outside NextNode): large enterprises — Hermès, Certigo, Allianz Trade. These inform quality standards but are not the NextNode target.
- **Current NextNode clients**: early-stage, low-stakes work (florist, friend's static site). Not representative of the target — the business is in a ramp-up phase.

**How to apply**: favor solutions that scale from solo-operator to small-team delivery, prioritize developer-ergonomics and reusability across client projects, and pitch recommendations at a PME/ETI budget and maturity level (not enterprise, not toy project).

## Arguments

- No argument: **run full compliance audit** (default behavior)
- `standards` -> `/nextnode-standards`
- `logger` -> `/nextnode-logger`
- `deploy` or `infra` -> `/nextnode-deploy`
- `design` -> `/nextnode-design`

## Instructions

### When called without argument: compliance audit

1. **Read the project** — `package.json`, config files, `nextnode.toml`, existing imports
2. **Run the checklist** below against the project state
3. **Present the results** as a table: item, status (pass/missing/misconfigured), detail
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

#### NextNode package versions (MANDATORY — check first)
For every `@nextnode-solutions/*` dep in `package.json`, compare the **installed** version (from `pnpm-lock.yaml` or `node_modules/<pkg>/package.json`) against the **latest** on npm via `npm view <pkg> version`. Flag any mismatch as **outdated**, even if the package.json range (`^1.5.1`) would allow the newer version — what matters is what's actually installed.

- [ ] `@nextnode-solutions/standards` — installed version == npm latest
- [ ] `@nextnode-solutions/logger` — installed version == npm latest
- [ ] `@nextnode-solutions/infrastructure` — installed version == npm latest (if used)
- [ ] Any other `@nextnode-solutions/*` dep — installed version == npm latest

**Why**: NextNode packages evolve fast and older versions carry real bugs. Example: `@nextnode-solutions/standards@1.5.1` exports `./oxlint` as a raw JSON file, which breaks under Node 22.12+ without `with { type: 'json' }` import attribute — fixed in 1.9.x where the export is a JS module. Outdated installs = CI failures that don't reproduce locally. Recent projects especially should never be more than a minor behind.

**How to resolve**: `pnpm update <pkg>` (or `pnpm update @nextnode-solutions/*` for all).

#### Standards (`@nextnode-solutions/standards`)
- [ ] Installed as devDependency
- [ ] `oxlint` and `oxfmt` installed as devDependencies
- [ ] `oxlint.config.ts` exists and extends `@nextnode-solutions/standards/oxlint` (requires oxlint >=1.58.0)
- [ ] `oxfmt.config.ts` exists and extends `@nextnode-solutions/standards/oxfmt` (requires oxfmt >=0.43.0)
- [ ] `tsconfig.json` exists and extends one of `standards/typescript/{library,nextjs,astro}`
- [ ] Scripts: `lint` (oxlint), `format` (oxfmt --write .), `format:check` (oxfmt --check .), `type-check` (tsc --noEmit)

#### Testing (if applicable)
- [ ] `vitest` installed as devDependency
- [ ] `vitest.config.ts` composes the base via `mergeConfig(baseConfig, defineConfig({...}))` where `baseConfig` is imported from `@nextnode-solutions/standards/vitest/{backend,frontend}`
- [ ] Script: `test` (vitest run)

#### Commit conventions (if applicable)
- [ ] `@commitlint/cli` + `@commitlint/config-conventional` installed
- [ ] `commitlint.config.js` imports from `standards/commitlint`
- [ ] `husky` + `lint-staged` installed
- [ ] `lint-staged.config.js` imports from `standards/lint-staged`

#### Publishing (if `type=package`)
- [ ] `.releaserc.json` extends both `semantic-release-monorepo` and `@nextnode-solutions/standards/semantic-release`, with a `tagFormat` per package
- [ ] `nextnode.toml` has `[package]` section with `access` (+ optional `canary_on_label`)

#### CI/CD
- [ ] `nextnode.toml` exists with `[project]` section (name + type + optional `internal`)
- [ ] `project.internal` set to `true` for VPS apps reachable only via Tailscale (defaults to `false`). Controls DNS (tailnet IP vs. public), firewall (tailscale0-only vs. open HTTP/S), Caddy cert strategy, and UFW rules. See `/nextnode-deploy` for details.
- [ ] GitHub workflow calls the correct reusable workflow from `NextNodeSolutions/core` — `deploy-static.yml` for Astro/Cloudflare-Pages sites (auto-provisions per-env Pages project + custom domains + DNS), `deploy.yml` for Hetzner VPS containerized apps (runs `plan → quality → provision → dns → build-image → deploy`, pushes to GHCR, SSH-deploys to the VPS), `publish-package.yml` for packages
- [ ] For `type=app` (Hetzner): `Dockerfile` at root, minimal `docker-compose.yml` with `services.app.build.context: .` (no `image:`/`ports:`/`env_file:`/`restart:`), app respects `$PORT` (12-factor). See `/nextnode-deploy` → `hetzner-caller.md` for the full caller convention.
- [ ] Monorepo: per-package workflow with `paths:` filter + `filter` in nextnode.toml

#### Logger (if used)
- [ ] `@nextnode-solutions/logger` imported (not `console.log`)
- [ ] Logger injected via constructor/parameter (not global import in business logic)
- [ ] Tests use `createSpyLogger()` or `createNoopLogger()` from `logger/testing`

### When called with a sub-skill argument

Redirect immediately:
- `standards` -> invoke `/nextnode-standards`
- `logger` -> invoke `/nextnode-logger`
- `deploy` or `infra` -> invoke `/nextnode-deploy`
- `design` -> invoke `/nextnode-design`

## Sub-skills

| Skill | What it covers |
|-------|----------------|
| `/nextnode-standards` | oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged, semantic-release |
| `/nextnode-logger` | Logger API, transports, testing utilities |
| `/nextnode-deploy` | nextnode.toml, CI pipeline, deployment |
| `/nextnode-design` | Brand colors, typography, logos, UI conventions |

## Rules

1. **pnpm only** — never npm or yarn
2. **ESM only** — `import`, not `require`
3. **Standards first** — every project MUST use `@nextnode-solutions/standards`
4. **Config-driven** — behavior from `nextnode.toml`, not hardcoded
5. **Always check NextNode package freshness** — before any audit or CI debug, run `npm view <pkg> version` for each installed `@nextnode-solutions/*` package and compare against the installed version. Outdated NextNode packages are the #1 cause of CI-only failures that don't reproduce locally.
