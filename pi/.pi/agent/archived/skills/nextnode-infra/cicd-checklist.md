# CI/CD and Backing Services — Compliance Checklist

> Load this file on demand when auditing CI/CD or infrastructure items.
> For rule definitions and invariants, see the skill `nextnode-deploy`.

## CI/CD

- [ ] `nextnode.toml` exists with `[project]` section (name + type + optional `internal`)
- [ ] `project.internal` set to `true` for VPS apps reachable only via Tailscale (defaults to `false`). Controls DNS (tailnet IP vs. public), firewall (tailscale0-only vs. open HTTP/S), Caddy cert strategy, and UFW rules. See the skill `nextnode-deploy` for details.
- [ ] GitHub workflow calls the correct reusable workflow from `NextNodeSolutions/core` - `deploy-static.yml` for Astro/Cloudflare-Pages sites (auto-provisions per-env Pages project + custom domains + DNS), `deploy.yml` for Hetzner VPS containerized apps (runs `plan → quality → check-secrets → provision → dns → build-image → detect-migrations → migrate → deploy`, pushes to GHCR, SSH-deploys to the VPS), `deploy-workers.yml` for Cloudflare Workers apps, `publish-package.yml` for packages
- [ ] For `type=app` (Hetzner): `Dockerfile` at root, and **NO `docker-compose.yml`** — the compose file is rendered by the infrastructure from `nextnode.toml` (a caller-shipped compose is rejected). App respects `$PORT` (12-factor). See the skill `nextnode-deploy` → `hetzner-caller.md` + `multi-service.md` for the full caller convention.
- [ ] Monorepo: per-package workflow with `paths:` filter + `filter` in nextnode.toml
- [ ] `SITE_URL` is **never hardcoded** — Astro `astro.config.ts` MUST set `site: process.env.SITE_URL` (same for any other framework that needs a canonical URL). The infrastructure auto-computes `SITE_URL` from `project.domain` and injects it as a build arg AND at runtime. The dev never declares it.
- [ ] `[deploy.services.<name>]` declares one entry per workload (N services per project accepted). All services MUST share the same `source` (`build` XOR `upstream` — mixing is rejected). Each routed service declares a unique `url` within `project.domain`.
- [ ] **Secrets: global pool + per-service projection** — `[deploy].secrets` is the GLOBAL pool (injected into every service; entries are must-exist GitHub secret names OR `{ name, generate, length }` auto-generated tables); `[deploy.services.<name>].secrets` is the per-service least-privilege channel, projected into ONLY that service's `.env.<name>`. A backing service's secrets reach a service only when it declares `needs = ["postgres"]`. See the skill `nextnode-deploy` rules 25–26.
- [ ] **Build-time-inlined config goes through `build_args`, NOT secrets** — for values a framework bakes into the image at build time (Astro `site`, `NEXT_PUBLIC_*`, `VITE_*`), declare `build_args = ["NAME", ...]` on the `build` service. `SITE_URL` is auto-injected and must NOT be listed. **NEVER put a secret in `build_args`**. `build_args` is forbidden on `upstream` services.
- [ ] Cross-service URLs are NEVER hardcoded in app code — the infra injects `<SIBLING_NAME_UPPER_SNAKE>_URL=https://<resolved-hostname>` into every `.env.<service>`. Apps read `process.env.<SIBLING>_URL` instead of building hostnames.
- [ ] For VPS apps consuming a prebuilt upstream image: `[deploy.services.<name>]` set with `source = "upstream"`, `ref = "ghcr.io/org/img:tag"`, and `registry_auth_secret = "GH_SECRET_NAME"` when the image is private. All upstream services MUST share the SAME `registry_auth_secret`. The legacy `[deploy.image]` table was removed.
- [ ] For VPS apps with persistent state: `[deploy.volumes]` declares named Docker volumes by alias. **Volumes attach to the PRIMARY (first declared) service** — multi-service per-volume mounts not supported. Volumes preserved by default; pass `--wipe-backups` to `teardown` explicitly to drop them.

## Backing services

### R2

- [ ] R2 buckets declared as a table-array `[[services.r2.buckets]]` of `{ name, cdn }` (alias `name` kebab-case; `cdn` optional, default `false` = private). `cdn = true` attaches a public custom domain `<alias>.cdn.<domain>` and injects `R2_BUCKET_<ALIAS>_URL`
- [ ] On the **Hetzner VPS** target, the app reads bucket names via `R2_BUCKET_<ALIAS>` env vars + creds via `R2_ENDPOINT` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (provisioned and injected by infra; never hardcoded)
- [ ] On the **Cloudflare Workers** target, no R2 credentials are projected — Workers access buckets through wrangler R2 bindings. Only `R2_BUCKET_<ALIAS>`, `R2_BUCKET_<ALIAS>_URL` (when `cdn = true`) and `R2_ENDPOINT` are injected as vars

### Postgres

- [ ] `[services.postgres]` declared with `mode` (`embedded` or `external`). `embedded` runs a sidecar container on the same VPS; `external` expects an externally managed DB
- [ ] **Exactly one `[deploy.services.<name>]` declares `needs = ["postgres"]`** — zero or multiple claimants both throw at deploy time
- [ ] App reads `DATABASE_URL` from env (injected by infra at deploy) — never hardcoded, never built from parts in app code
- [ ] Migrations tooling configured (Drizzle by default): optional `migrations_folder` (defaults to `drizzle`), optional `migrate_command` (defaults to `pnpm drizzle-kit migrate`), optional `check_command` (defaults to `pnpm drizzle-kit check`)
- [ ] Migrations run via the CI `migrate-remote` job between `provision` and `deploy` — NOT from inside the app entrypoint
- [ ] No raw `pg_dump` / `pg_restore` / cron logic in app code — embedded postgres runs dual prod backups (daily pg_dump with GFS retention + continuous wal-g WAL archiving & base backups, both in R2)
- [ ] **No pre-migrate snapshot is taken** — continuous wal-g archiving covers point-in-time recovery, so `migrate-remote` needs no extra backup config
