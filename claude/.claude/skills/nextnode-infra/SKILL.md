---
name: nextnode-infra
description: >-
  NextNode core monorepo overview. Audits any NextNode project for compliance
  with standards, logger, and infrastructure conventions. Dispatches to
  sub-skills per package.
user-invocable: true
synced-at: 1bd49ff
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

#### Standards (`@nextnode-solutions/standards`)
- [ ] Installed as devDependency
- [ ] `oxlint` and `oxfmt` installed as devDependencies
- [ ] `.oxlintrc.json` exists and extends `@nextnode-solutions/standards/oxlint`
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
- [ ] `nextnode.toml` exists with `[project]` section (name + type)
- [ ] GitHub workflow calls the correct reusable workflow from `NextNodeSolutions/core` — `deploy-static.yml` for Astro/Cloudflare-Pages sites (auto-provisions per-env Pages project + custom domains + DNS), `deploy.yml` for generic deploys, `publish-package.yml` for packages
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

## Sub-skills

| Skill | What it covers |
|-------|----------------|
| `/nextnode-standards` | oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged, semantic-release |
| `/nextnode-logger` | Logger API, transports, testing utilities |
| `/nextnode-deploy` | nextnode.toml, CI pipeline, deployment |

## Rules

1. **pnpm only** — never npm or yarn
2. **ESM only** — `import`, not `require`
3. **Standards first** — every project MUST use `@nextnode-solutions/standards`
4. **Config-driven** — behavior from `nextnode.toml`, not hardcoded
