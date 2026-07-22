# Multi-service deploys

`[deploy.services.<name>]` accepts **N entries** for `hetzner-vps`. Routing (DNS, Caddy, host ports), env isolation (`.env.<name>` per service + symmetric URL injection), and image refs (`Record<service, ImageRef>`) are all wired per service. A single bake call produces every `build` image, a single deploy step rotates every container. The compose renderer keys everything off `Object.entries(services)` — there is no `resolveSoleService` anymore (dropped in commit `688f187`); any literal `"app"` reaching for the service slot is a bug.

## Schema rules enforced at parse time

All in `config/validation/`:

| Rule | Location | Failure message gist |
|------|----------|---------------------|
| At least one `[deploy.services.<name>]` for hetzner-vps | `validation/deploy.ts` | `at least one service required` |
| Each service name is a KEBAB identifier | `validation/deploy.ts` | `service name must be a kebab identifier` |
| All services share the same `source` (all `build` or all `upstream`) | `validation/providers/hetzner.ts` | `mixing build and upstream services is not supported` |
| Each declared `url` is unique across services | `validation/providers/hetzner.ts` | `url must be unique across services` |
| Each declared `url` belongs to `project.domain` (equal or subdomain) | `validation/providers/hetzner.ts` | `url must be within project.domain` |
| GLOBAL `[deploy].secrets` folded into every service; hetzner pull pool = global ∪ each service's own `secrets` | `resolveSecrets` + `expandServiceSecrets` (`validation/deploy.ts`) | duplicate name / unknown generator / length out of 8–256 |
| Every `needs` reference is a declared `[services.<name>]` backing service | `validateServiceNeedsRefs` (`validation/deploy.ts`) | `needs references "X" but no [services.X] is declared` |
| Every `depends_on` reference exists in `[deploy.services]` | `validateServiceDependsOnRefs` (`validation/deploy.ts`) | `unknown service reference` |
| `build`-only fields (`context`, `dockerfile`, `target`, `build_args`) forbidden under `source = "upstream"`, and `ref`/`registry_auth_secret` forbidden under `source = "build"` | `validation/deploy.ts` | `field <X> is only allowed when source = "<Y>"` |
| `[deploy.image]` is rejected with a migration hint | `validation/deploy.ts` | `deploy.image is an unknown field — migrate to [deploy.services.<name>]` |

## Per-service primitives at runtime

### DNS (one record per routed service)

`computeVpsDnsRecords` (`domain/hetzner/dns-records.ts`) emits **one A record per service that declares a `url`**. The hostname is `resolveDeployDomain(service.url, environment)`. Proxying depends on subdomain depth (`isCoveredByUniversalSsl`): Cloudflare's free Universal SSL covers only the zone apex + a single-level wildcard (`*.<zone>`), so a host two+ labels below the apex gets no edge cert and must stay grey-clouded (DNS-only) for Caddy's origin Let's Encrypt cert (valid at any depth) to serve it:

- Internal (`project.internal = true`) → tailnet CGNAT IP, never proxied
- Public production, apex / one-label subdomain → VPS public IP, Cloudflare-proxied (TTL=1)
- Public production, two+ label subdomain → VPS public IP, grey-clouded (DNS-only, TTL=300, Caddy origin cert)
- Public development (any depth) → VPS public IP, unproxied (TTL=300)

Example: under zone `nextnode.fr`, `fleurs.nextnode.fr` is proxied (covered by `*.nextnode.fr`) but `admin.fleurs.nextnode.fr` is grey-clouded.

Services without `url` get no DNS record — they're internal-only, reachable by siblings as `<service-name>:<port>` on the compose network.

### Caddy (one upstream per routed service)

`buildServiceUpstreams` (`domain/hetzner/service-upstreams.ts`) emits one entry per routed service:

```
{ hostname: resolveDeployDomain(service.url, env), dial: "localhost:<host-port>" }
```

Each upstream becomes a Caddy reverse-proxy block with its own ACME cert (or internal-TLS cert when `project.internal = true`). The merged Caddy config is rendered by `domain/caddy/compose.ts`.

### Host ports (per-service, VPS-wide)

`allocateHostPort` (`domain/hetzner/host-port.ts`):

- Range: `[8080, 8200)` — portable across projects sharing the VPS
- One port per **routed** service (services with no `url` never get a host port)
- State: nested map `hostPorts[projectName][serviceName] = port` persisted in R2 state (`adapters/hetzner/state/types.ts`)
- Idempotent: existing ports reused on redeploy; only new url-services trigger a fresh allocation

### Per-service env files (cross-service URL injection + secret projection)

`domain/hetzner/service-env.ts` builds the per-service runtime env; `stageRollout` writes one `.env.<service>` per declared service: `PORT`, `SITE_URL`, the symmetric sibling `<NAME>_URL`s, the target + backing-service public env, and the projected (least-privilege) secrets. Separately, a bare `.env` (`selectBackingSecrets` — BACKING secrets only) feeds the postgres sidecar, backup sidecar and migrate container. Full contents + projection rules in [deploy-env.md](deploy-env.md).

### Build args (per build service)

`compute-image-ref` resolves docker-bake build args per `build` service into `BakeTarget.args`: auto-injected `SITE_URL` + dev-declared `build_args` (fail-loud against `ALL_VARS`); forbidden on `upstream`, secrets never. See [deploy-env.md](deploy-env.md) → "Build args".

### Image refs (Record per declared service)

Plan outputs (`adapters/github/plan-outputs.ts`):

- `image_source = "build" | "upstream" | ""`
- `upstream_image_refs` = JSON Record `{<service>: {registry, repository, tag}}` (one entry per service when `image_source = "upstream"`)

Build path: `compute-image-ref` renders `docker-bake.json` from `nextnode.toml` (one bake target per `build` service, carrying each target's `context` / `dockerfile` / optional stage `target` / `tags` / two-layer `cache-from` + `cache-to`: a fast ephemeral GHA scope (`type=gha,scope=<name>`, listed first) **plus** a durable registry scope (`type=registry,ref=ghcr.io/<owner>/<repo>-<service>:buildcache`, exported `mode=max,ignore-error=true`) that survives GHA's ~10GB eviction and keeps layers warm across runs) at the workspace root and writes `image_refs` (same JSON Record shape, one entry per `build` service) + `bake_file` (its basename). A single `docker/bake-action` (`source: .`, `files: <bake_file>`) builds + pushes every service image to `ghcr.io/<owner>/<repo>-<service>:sha-<7>`.

Both paths feed the deploy job via `IMAGE_REFS` → `parseImageRefsEnv` (consumer is identical on either path). The legacy single-string `IMAGE_REF` / `image_ref` output was removed (`refactor(infrastructure): drop legacy deploy.image schema and image_ref output`), and the `bake_targets` CSV + `bake_set` multiline outputs were replaced by the rendered `bake_file` (`feat(infrastructure): render docker-bake.json from nextnode.toml as the single build source`) — re-introducing a bare ref breaks `parseImageRefsEnv` and the upstream path.

### Registry token (one per deploy)

`resolveRegistryToken` (`cli/deploy/resolve-deploy-context.ts`):

- Any service is `build` → use `GHCR_TOKEN` (forwarded by the workflow)
- All services are `upstream` → resolve the shared `registryAuthSecret` across them. **All upstream services must reference the same secret name (or none).** Mixing different auth secrets is rejected at deploy-context resolution.
- All services upstream + no auth secret → no token (public images)

One token is forwarded to the deploy SSH session; `docker login` is only issued for the registries that token actually covers (commit `66e19c9`).

### Postgres-owning service

`selectMigrationService` (`domain/deploy/migration-service.ts`) — only invoked when `[services.postgres]` is declared:

- Finds the single service that declares `needs = ["postgres"]`
- Throws if zero services claim it (nobody owns the schema)
- Throws if multiple services claim it (ambiguous — multi-db is M3+)

The migrate-remote job runs the migrate command in an ephemeral container built from that service's image, joined to the project network.

### Healthcheck (build services only)

`renderComposeFile` (`domain/hetzner/compose-file.ts`):

- Each `build` service gets `healthcheck: wget -q -O- http://localhost:<port>/healthz` (interval 10s, timeout 3s, retries 6)
- `upstream` services get **no forced healthcheck** — their base image may answer neither `/healthz` nor ship `wget`

### depends_on gating

For each service X with `depends_on = ["Y"]`:

- Y is a `build` service → `X.depends_on.Y.condition = service_healthy`
- Y is an `upstream` service → `X.depends_on.Y.condition = service_started` (no probe to wait on)
- Postgres sidecar is always health-gated (the postgres image has a built-in healthcheck)

Primary user service (the first declared one) additionally depends on postgres when embedded.

## What's still single-service

Documented here so additions don't accidentally drift into multi-service territory before the runtime supports it:

| Concern | Current behavior | Where it lives |
|---------|------------------|----------------|
| `[deploy.volumes]` mounts | Attached to the PRIMARY (first declared) service only | `domain/hetzner/compose-file.ts` (volumes block) |
| Postgres database | One DB per project; `selectMigrationService` enforces exactly one owner | `domain/deploy/migration-service.ts` |
| Healthcheck command | Hardcoded wget probe on `<port>/healthz` — no per-service override yet | `domain/hetzner/compose-file.ts` |

Anything new in these areas needs a runtime change first (validation, rendering, teardown), not just a schema addition.

## Multi-service teardown

`teardownProject` (`adapters/hetzner/teardown-project.ts`):

- **Containers**: project-wide `docker compose down --remove-orphans` on the rendered compose file (rotates all services down in one shot)
- **DNS**: one Cloudflare DNS removal per routed service (looped over `computeVpsDnsLookups`)
- **Caddy**: per-service upstream + route + cert subject scrubbed from the shared Caddy config (commits `f28710e`, `53c3a45`); if this was the last project on the VPS, Caddy is reset to an empty config
- **Volumes**: preserved by default (`--remove-orphans` only). Pass `--wipe-backups` to also `docker compose down -v` (drops named volumes) + delete BOTH R2 backup buckets (`<project>-backups` wal-g + `<project>-backups-dump` pg_dump). A planned teardown first captures a final wal-g backup (see [postgres-service.md](postgres-service.md) Teardown).
- **Bind mount**: `/opt/apps/<project>/<environment>` removed (compose file + every `.env.<service>` gone with it)

## Cross-phase compose identity

Phase 1 (`stageRollout` → `bringUpDb`) and phase 2 (`bringUpApp`) BOTH render the compose file with the same inputs. Phase 2 is `docker compose up -d --remove-orphans` (no positional service args): every user service rotates to its new image while the backing services (postgres, observability, cron) stay untouched because their compose entries are byte-identical across phases.

Any change that makes a backing-service block differ across phases would recreate the DB phase 1 just `--wait`-ed healthy. Keep backing-service rendering deterministic.
