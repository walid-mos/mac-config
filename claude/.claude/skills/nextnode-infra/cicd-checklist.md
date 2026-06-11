# CI/CD and Backing Services — Compliance Checklist

> Load this file on demand when auditing CI/CD or infrastructure items.
> For rule definitions and invariants, see `/nextnode-deploy`.

## CI/CD

- [ ] `nextnode.toml` exists with `[project]` section (name + type + optional `internal`)
- [ ] `project.internal` set to `true` for VPS apps reachable only via Tailscale (defaults to `false`). Controls DNS (tailnet IP vs. public), firewall (tailscale0-only vs. open HTTP/S), Caddy cert strategy, and UFW rules. See `/nextnode-deploy` for details.
- [ ] GitHub workflow calls the correct reusable workflow from `NextNodeSolutions/core` - `deploy-static.yml` for Astro/Cloudflare-Pages sites (auto-provisions per-env Pages project + custom domains + DNS), `deploy.yml` for Hetzner VPS containerized apps (runs `plan → quality → provision → dns → build-image → deploy`, pushes to GHCR, SSH-deploys to the VPS), `publish-package.yml` for packages
- [ ] For `type=app` (Hetzner): `Dockerfile` at root, minimal `docker-compose.yml` with one compose service key per declared `[deploy.services.<name>]` (e.g. `services.web.build.context: .`, never `services.app` unless `app` is the declared name). Forbidden compose keys: `image:`/`ports:`/`env_file:`/`environment:`/`restart:`/`healthcheck:`/`volumes:` (all infra-owned). App respects `$PORT` (12-factor). See `/nextnode-deploy` → `hetzner-caller.md` + `multi-service.md` for the full caller convention.
- [ ] Monorepo: per-package workflow with `paths:` filter + `filter` in nextnode.toml
- [ ] `SITE_URL` is **never hardcoded** — Astro `astro.config.ts` MUST set `site: process.env.SITE_URL` (same for any other framework that needs a canonical URL). The infrastructure auto-computes `SITE_URL` from `project.domain` and injects it as a build arg AND at runtime. The dev never declares it.
- [ ] `[deploy.services.<name>]` declares one entry per workload (N services per project accepted). All services MUST share the same `source` (`build` XOR `upstream` — mixing is rejected). Each routed service declares a unique `url` within `project.domain`.
- [ ] **Secrets: global pool + per-service projection** — `[deploy].secrets` is the GLOBAL pool (injected into every service; entries are must-exist GitHub secret names OR `{ name, generate, length }` auto-generated tables); `[deploy.services.<name>].secrets` is the per-service least-privilege channel, projected into ONLY that service's `.env.<name>`. A backing service's secrets reach a service only when it declares `needs = ["postgres"]`. See `/nextnode-deploy` rules 25–26.
- [ ] **Build-time-inlined config goes through `build_args`, NOT secrets** — for values a framework bakes into the image at build time (Astro `site`, `NEXT_PUBLIC_*`, `VITE_*`), declare `build_args = ["NAME", ...]` on the `build` service. `SITE_URL` is auto-injected and must NOT be listed. **NEVER put a secret in `build_args`**. `build_args` is forbidden on `upstream` services.
- [ ] Cross-service URLs are NEVER hardcoded in app code — the infra injects `<SIBLING_NAME_UPPER_SNAKE>_URL=https://<resolved-hostname>` into every `.env.<service>`. Apps read `process.env.<SIBLING>_URL` instead of building hostnames.
- [ ] For VPS apps consuming a prebuilt upstream image: `[deploy.services.<name>]` set with `source = "upstream"`, `ref = "ghcr.io/org/img:tag"`, and `registry_auth_secret = "GH_SECRET_NAME"` when the image is private. All upstream services MUST share the SAME `registry_auth_secret`. The legacy `[deploy.image]` table was removed.
- [ ] For VPS apps with persistent state: `[deploy.volumes]` declares named Docker volumes by alias. **Volumes attach to the PRIMARY (first declared) service** — multi-service per-volume mounts not supported. Volumes preserved by default; pass `wipeBackups` explicitly to drop them.

## Backing services

### R2

- [ ] R2 buckets declared as a table-array `[[services.r2.buckets]]` of `{ name, cdn }` (alias `name` kebab-case; `cdn` optional, default `false` = private). `cdn = true` attaches a public custom domain `<alias>.cdn.<domain>` and injects `R2_BUCKET_<ALIAS>_URL`
- [ ] App reads bucket names via `R2_BUCKET_<ALIAS>` env vars + creds via `R2_ENDPOINT` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (provisioned and injected by infra; never hardcoded)

### Postgres

- [ ] `[services.postgres]` declared with `mode` (`embedded` or `external`). `embedded` runs a sidecar container on the same VPS; `external` expects an externally managed DB
- [ ] **Exactly one `[deploy.services.<name>]` declares `needs = ["postgres"]`** — zero or multiple claimants both throw at deploy time
- [ ] App reads `DATABASE_URL` from env (injected by infra at deploy) — never hardcoded, never built from parts in app code
- [ ] Migrations tooling configured (Drizzle by default): optional `migrations_folder` (defaults to `drizzle/`), optional `migrate_command` (defaults to `pnpm drizzle-kit migrate`), optional `check_command` (defaults to `pnpm drizzle-kit check`)
- [ ] Migrations run via the CI `migrate-remote` job between `provision` and `deploy` — NOT from inside the app entrypoint
- [ ] No raw `pg_dump` / `pg_restore` / cron logic in app code — the postgres service auto-provisions a backup sidecar that pushes daily dumps to R2 (retention 7d/4w/3m)
- [ ] An on-demand backup snapshot is taken automatically before each `migrate-remote` run (no extra config needed)

### Supabase (self-hosted stack)

- [ ] `[services.supabase]` declared as an empty TOML table (declarative gate; no fields today)
- [ ] `project.domain` set in `nextnode.toml` (REQUIRED when supabase is declared — baked into `API_EXTERNAL_URL` and `SITE_URL`)
- [ ] Project does NOT also declare `[services.postgres]` (Supabase ships its own pinned Postgres image)
- [ ] Operator has set `DASHBOARD_PASSWORD` as a per-env GitHub secret (`gh secret set DASHBOARD_PASSWORD --repo <owner>/<repo> --env <environment>`) — provision fails loud otherwise
- [ ] App reads `ANON_KEY`, `SERVICE_ROLE_KEY`, `API_EXTERNAL_URL`, `SITE_URL` from env (injected by infra at deploy) — never derived in app code
- [ ] For the full Supabase service spec (auto-injected `backups` R2 alias, Caddy vhosts, JWT-derived keys, `rotate-pg-exporter-password` runbook), see `/nextnode-deploy` → `supabase-service.md`
