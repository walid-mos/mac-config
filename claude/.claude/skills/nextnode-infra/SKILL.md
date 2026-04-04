---
name: nextnode-infra
description: >-
  NextNode core monorepo overview. Audits any NextNode project for compliance
  with standards, logger, and infrastructure conventions. Dispatches to
  sub-skills per package.
user-invocable: true
---

# NextNode Core Monorepo

`@nextnode/core` — pnpm workspaces + Turborepo, ESM only, Node >=24.

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
- [ ] `oxlint.json` exists and extends `@nextnode-solutions/standards/oxlint`
- [ ] `.oxfmt.json` exists and extends `@nextnode-solutions/standards/oxfmt`
- [ ] `tsconfig.json` exists and extends one of `standards/typescript/{library,nextjs,astro}`
- [ ] Scripts: `lint` (oxlint), `format` (oxfmt --write .), `format:check` (oxfmt --check .), `type-check` (tsc --noEmit)

#### Testing (if applicable)
- [ ] `vitest` installed as devDependency
- [ ] `vitest.config.ts` imports from `standards/vitest/{backend,frontend}`
- [ ] Script: `test` (vitest run)

#### Commit conventions (if applicable)
- [ ] `@commitlint/cli` + `@commitlint/config-conventional` installed
- [ ] `commitlint.config.js` imports from `standards/commitlint`
- [ ] `husky` + `lint-staged` installed
- [ ] `lint-staged.config.js` imports from `standards/lint-staged`

#### Publishing (if `type=package`)
- [ ] `.releaserc.json` extends `standards/semantic-release`
- [ ] `nextnode.toml` has `[package]` section with `access`

#### CI/CD
- [ ] `nextnode.toml` exists with `[project]` section (name + type)
- [ ] GitHub workflow calls the correct reusable workflow from `NextNodeSolutions/core`
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
