---
name: nextnode-infra
description: >-
  NextNode core monorepo overview and entry point. Audits any NextNode
  project for compliance with standards, logger, and infrastructure
  conventions, then dispatches to per-package sub-skills
  (nextnode-standards, nextnode-logger, nextnode-deploy). Load when the user
  asks to audit a NextNode project, when working in a repo of the GitHub
  `NextNodeSolutions` org, or when any @nextnode-solutions/* package appears
  in package.json.
user-invocable: true
synced-at: a755da5
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

All publishable packages use **tsdown** (no tsup remaining). All run on Node >=24, pnpm 10.11.0, ESM-only.

## Instructions

### Compliance audit (default behavior)

1. **Read the project** - `package.json`, config files, `nextnode.toml`, existing imports
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

#### NextNode package versions (MANDATORY - check first)
For every `@nextnode-solutions/*` dep in `package.json`, compare the **installed** version (from `pnpm-lock.yaml` or `node_modules/<pkg>/package.json`) against the **latest** on npm via `npm view <pkg> version`. Flag any mismatch as **outdated**, even if the package.json range (`^1.5.1`) would allow the newer version - what matters is what's actually installed.

- [ ] `@nextnode-solutions/standards` - installed version == npm latest
- [ ] `@nextnode-solutions/logger` - installed version == npm latest
- [ ] `@nextnode-solutions/infrastructure` - installed version == npm latest (if used)
- [ ] Any other `@nextnode-solutions/*` dep - installed version == npm latest

**Why**: Outdated installs = CI failures that don't reproduce locally.

**How to resolve**: `pnpm update <pkg>` (or `pnpm update @nextnode-solutions/*` for all).

#### Standards / Testing / Commits / Publishing
For the detailed setup of `@nextnode-solutions/standards` (oxlint, oxfmt, TypeScript, vitest, commitlint, lint-staged, semantic-release configs and their required scripts), see `/nextnode-standards` "Complete project setup checklist". Audit ALL items from that checklist as part of compliance.

#### CI/CD
- [ ] `nextnode.toml` exists with `[project]` section (name + type + optional `internal`)
- [ ] `project.internal` set to `true` for VPS apps reachable only via Tailscale (defaults to `false`). Controls DNS (tailnet IP vs. public), firewall (tailscale0-only vs. open HTTP/S), Caddy cert strategy, and UFW rules. See `/nextnode-deploy` for details.
- [ ] GitHub workflow calls the correct reusable workflow from `NextNodeSolutions/core` - `deploy-static.yml` for Astro/Cloudflare-Pages sites (auto-provisions per-env Pages project + custom domains + DNS), `deploy.yml` for Hetzner VPS containerized apps (runs `plan → quality → provision → dns → build-image → deploy`, pushes to GHCR, SSH-deploys to the VPS), `publish-package.yml` for packages
- [ ] For `type=app` (Hetzner): `Dockerfile` at root, minimal `docker-compose.yml` with `services.app.build.context: .` (no `image:`/`ports:`/`env_file:`/`restart:`), app respects `$PORT` (12-factor). See `/nextnode-deploy` → `hetzner-caller.md` for the full caller convention.
- [ ] Monorepo: per-package workflow with `paths:` filter + `filter` in nextnode.toml
- [ ] `SITE_URL` is **never hardcoded** - Astro `astro.config.ts` MUST set `site: process.env.SITE_URL` (same for any other framework that needs a canonical URL). The infrastructure pipeline auto-computes and injects `SITE_URL` at build + runtime via the target's `contributeEnv()`; hardcoding a domain breaks dev/prod URL resolution and bypasses the config-as-code flow.

#### Backing services (if used)
- [ ] R2 buckets declared in `[services.r2] buckets = ["uploads", ...]` (alias names, kebab-case)
- [ ] App reads bucket names via `R2_BUCKET_<ALIAS>` env vars + creds via `R2_ENDPOINT` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (provisioned and injected by infra; never hardcoded)

#### Logger (if used)
- [ ] `@nextnode-solutions/logger` imported (not `console.log`)
- [ ] Logger injected via constructor/parameter (not global import in business logic)
- [ ] Tests use `createSpyLogger()` or `createNoopLogger()` from `logger/testing`

#### Date handling (if used)
- [ ] No `date-fns`, `luxon`, `dayjs`, or `moment` in `dependencies`/`devDependencies`
- [ ] If date/time code exists, `@js-temporal/polyfill` is the dep and `Temporal` is used (not raw `Date` arithmetic)
- [ ] Project code imports `Temporal` from `@js-temporal/polyfill` (e.g. `Temporal.Instant.from(iso)`, `Temporal.PlainDate`, `.since()`, `.total('minute')`) instead of `new Date()` math or `Date.parse()`

## Sub-skills

| Skill | What it covers |
|-------|----------------|
| `/nextnode-standards` | oxlint, oxfmt, TypeScript, Vitest, commitlint, lint-staged, semantic-release |
| `/nextnode-logger` | Logger API, transports, testing utilities |
| `/nextnode-deploy` | nextnode.toml, CI pipeline, deployment |
| `/nextnode-design` | Brand colors, typography, logos, UI conventions |

## Rules

1. **pnpm only** - never npm or yarn
2. **ESM only** - `import`, not `require`
3. **Standards first** - every project MUST use `@nextnode-solutions/standards`
4. **Config-driven** - behavior from `nextnode.toml`, not hardcoded
5. **Always check NextNode package freshness** - before any audit or CI debug, run `npm view <pkg> version` for each installed `@nextnode-solutions/*` package and compare against the installed version. Outdated NextNode packages are the #1 cause of CI-only failures that don't reproduce locally.
6. **Dates go through Temporal, never `Date` or date libraries** - use TC39 Temporal via `@js-temporal/polyfill`. BAN `date-fns`, `luxon`, `dayjs`, `moment`, and raw `Date` arithmetic for new code. Install per-package: `pnpm add @js-temporal/polyfill`. Use `Temporal.Instant.from(iso)`, `Temporal.PlainDate`, `.since()`, `.total('minute')` instead of `new Date()` math or `getTime()` subtraction. `Date.now()` is acceptable only as epoch-ms input to `Temporal.Instant.fromEpochMilliseconds(Date.now())`.
