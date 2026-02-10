---
name: nextnode
description: NextNode project hub. Auto-load when working on any NextNode or SaaS project — dynamic project discovery, conventions, and quick references.
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# NextNode Project Hub

Lightweight hub that auto-loads on every NextNode/SaaS project. For detailed references, see sibling skills:
- **`/nextnode-infra`** — CI/CD pipeline, Dagger modules, Terraform, VPS, monitoring, DNS/SSL
- **`/nextnode-brand`** — color palette, typography, logos, branding rules
- **`/email-manager`** — template-first email sending with React Email (auto-loaded when `@nextnode-solutions/email-manager` is in `package.json`)

## Project Discovery (Dynamic)

When this skill auto-loads, Claude MUST dynamically discover all local projects by scanning the two development directories. **Never maintain a hardcoded project list** — always discover at runtime.

### Discovery procedure

1. **List subdirectories** in `/Users/walid/Development/nextnode/` and `/Users/walid/Development/saas/` (skip hidden dirs, `node_modules`, `docs`)
2. **For each subdirectory**, read whichever of these files exist (in parallel for speed):
   - `package.json` — extract `name`, `version`, `description`, `dependencies`, `devDependencies`
   - `nextnode.toml` — extract `[project]` (name, type, domain) and `[package]` (scope, access)
3. **Build a mental registry** of every discovered project with:
   - **Directory path** — absolute path to the repo
   - **Package name** — from `package.json` `name` field (e.g. `@nextnode-solutions/standards`, `@nextnode/logger`)
   - **Project type** — `package` or `app` (from `nextnode.toml` or inferred from `package.json`)
   - **Key deps** — notable dependencies that hint at the project's tech stack

### When to run discovery

- **On first relevant question** — when the user asks about a project, references a package name, or needs cross-repo context
- **When resolving imports** — if the user references `@nextnode/*` or `@nextnode-solutions/*`, discover which local repo provides that package
- **When checking compatibility** — to find which projects depend on a package being modified

### How to use the registry

- **Cross-reference dependencies:** when editing a package, check which other local projects consume it
- **Resolve local packages:** map `@nextnode/logger` to `/Users/walid/Development/nextnode/logger/` etc.
- **Suggest impact:** when changing a shared package, list local consumers that may be affected
- **Navigate quickly:** when the user says "go to the logger" or "check infrastructure", resolve to the right directory

## Key Conventions

- **VPS naming:** `<app>-<tier>` (e.g., `plane-worker`, `monitoring`)
- **Domain pattern:** `<app>.nextnode.fr` (public) or `<app>.nextnode.fr` grey cloud (internal)
- **Branch strategy:** single `main` branch, PRs for development
- **No barrel exports** — direct imports only
- **Conventional Commits** required for semantic-release
- **@nextnode-solutions/standards** — MANDATORY in every project (oxlint + oxfmt + TypeScript + Tailwind + Vitest + commitlint). See `/standards` skill for full details.
- **pnpm ONLY** — ALWAYS use `pnpm`, NEVER `npm` or `yarn`. This applies to all commands: install, add, remove, run, exec, dlx, etc.

## Default Scripts

All NextNode projects use these standard pnpm scripts unless the project's `CLAUDE.md` explicitly overrides them:

| Command        | Purpose          |
|----------------|------------------|
| `pnpm lint`    | Lint the codebase |
| `pnpm test`    | Run tests         |
| `pnpm build`   | Build the project |
| `pnpm dev`     | Start dev server  |

> **Override rule:** If the project's `CLAUDE.md` defines different script names or flags, use those instead. The project-level `CLAUDE.md` always takes precedence.

## Quick Reference: Adding a New App

1. Create repo in `NextnodeSolutions` org
2. Add `nextnode.toml` with `[project]`, `[routing]`, `[vps]`, `[deploy]` sections
3. Add `.github/workflows/ci.yml` (10-line reusable workflow caller)
4. Add `docker-compose.yml` and `Dockerfile`
5. Push to main — infrastructure auto-provisions VPS, DNS, deploys
6. Approve prod deployment in GitHub Actions when ready

## Quick Reference: Adding a New Package

1. Create repo in `NextnodeSolutions` org
2. Add `nextnode.toml` with `type = "package"`, `[package]` section
3. Add `.github/workflows/ci.yml` (10-line reusable workflow caller)
4. Use Conventional Commits — semantic-release handles versioning + publishing
5. Add `canary` label to PRs for pre-release testing

## Cost Structure

| Component | Monthly |
|-----------|---------|
| Prod VPS (cpx22) | ~8EUR |
| Dev VPS (cx22) | ~4EUR |
| Monitoring VPS (cpx21) | ~6EUR |
| Hetzner Volumes (20GB) | ~1.60EUR |
| GitHub Actions | Free (public repos) |
| **Total** | **~20EUR** |
