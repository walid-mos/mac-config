# `@nextnode-solutions/infrastructure` — code layout

Four-layer architecture (cli → domain + adapters + config, all sitting on top of a layer-agnostic kernel). Layer rules are STRICT and enforced in `packages/infrastructure/CLAUDE.md`.

## Layers

```
src/
  index.ts     # command registry + argv dispatch (no business logic)
  cli/         # CLI command orchestrators (read env, call domain + adapters, log milestones)
  domain/      # pure logic. NO IO, NO env, NO logger
  adapters/    # IO boundary (cloudflare/, hetzner/, r2/, github/, build-output/, services/, tailscale/)
  config/      # nextnode.toml schema + loader, valibot-based (see config.md)
  kernel/      # layer-agnostic floor: pure primitives, stdlib only, ZERO in-app imports
```

### Rules

1. **`domain/` is pure** — no `fetch`, no `process.env`, no logger, no FS. Pure functions only. Decision logic lives here so it's trivially testable.
2. **`adapters/` never make business decisions** — they execute what `domain/` decided. One adapter per provider (`adapters/hetzner/`, `adapters/cloudflare/`).
3. **`cli/` orchestrates** — reads config, calls domain for decisions, hands decisions to adapters for IO, prints summaries.
4. **`config/` is self-contained** — stdlib + smol-toml + valibot + `kernel/*` only. No domain, no adapters, no cli.
5. **`kernel/` is the floor** — pure primitives importable at runtime by EVERY layer (index, cli, domain, adapters, config). Stdlib only, no in-app deps. It exists so a runtime helper (`isRecord`, `parseJsonOrThrow`) can be shared across the `config`↔`domain` boundary the "types only" import rule otherwise blocks. Anything provider- or domain-specific does NOT belong here — it stays in its layer.

Imports flow inward and downward: `cli` → `domain` + `adapters` + `config` + `kernel`; `adapters` → `domain` (types) + `kernel`; `domain` → other `domain` + `kernel`; `config` → `kernel` + stdlib + smol-toml + valibot; `kernel` → stdlib only.

## Where to find what

Use `ls` / `find` for the current file map — it drifts. The full rules and architectural justification are in `packages/infrastructure/CLAUDE.md`.

Cross-cutting sub-skills:
- `config.md` — `nextnode.toml` schema and loader
- `multi-service.md` — N services per project: routing (DNS/Caddy/host ports), env isolation (`.env.<name>` + symmetric URL injection), source homogeneity, registry auth, depends_on gating, teardown
- `deploy-env.md` — `DeployEnv`, `TargetEnv`, `DeployInput`, env merge order
- `r2-service.md` — provider-agnostic services layer (currently R2 only)
- `golden-image.md` — Hetzner golden image fingerprint + cache key
- `pipeline.md` — quality matrix, prod-gate, publish-result
- `hetzner-vps.md` — internal vs public mode, Caddy, firewall
- `hetzner-caller.md` — what a caller repo provides (Dockerfile, nextnode.toml, workflows)

Per-service domain primitives (`src/domain/hetzner/`):
- `compose-file.ts` — multi-service compose renderer (per-service blocks, depends_on gating, healthcheck scoped to build, cross-phase identity)
- `service-env.ts` — per-service runtime env: `buildServiceUrlEnv` (symmetric cross-service URL injection), `buildServiceSecretEnv` (least-privilege secret projection via `secretOrigins`), `selectBackingSecrets` (shared `.env` for DB/backup/migrate)
- `service-upstreams.ts` — one Caddy upstream per routed service
- `host-port.ts` — VPS-wide port allocation `[8080, 8200)` per routed service
- `dns-records.ts` — one A record per routed service

Shared deploy domain primitives (`src/domain/deploy/`):
- `domain.ts` — `resolveDeployDomain` (dev subdomain) + `computeSiteUrl` (single SITE_URL source, build + runtime)
- `build-args.ts` — `computePublicBuildArgs` (auto SITE_URL) + `resolveBuildArgs` (autoArgs ∪ dev-declared `build_args`, fail-loud against `ALL_VARS`)
- `bake-file.ts` — `renderBakeFile` (docker-bake.json from nextnode.toml; `BakeTarget.args` carries build args)
- `image-ref.ts` — `computeImageRef` / `parseImageRef` / `resolveServiceImageRefs` / `parseImageRefsEnv` / `selectServiceImage`
- `migration-service.ts` — selects the postgres-owning service from `needs = ["postgres"]`
- `secret-generation.ts` — `generateSecretValue` (pure, crypto-backed) for auto-generated `[deploy].secrets` (`token`/`password`, rejection-sampled). Pushed at provision by `cli/deploy/ensure-generated-secrets.ts`.

R2 public CDN primitives:
- `domain/cloudflare/r2/custom-domain.ts` — `computeR2CustomDomainHostname` (`<alias>.cdn.<resolved-domain>`) + `computeR2PublicUrl`
- `adapters/cloudflare/r2/domains.ts` — `ensureR2CustomDomain` / `getR2CustomDomainStatus` / `deleteR2CustomDomain` (CF R2 custom-domain API)
- `cli/services/r2/await-domain-active.ts` — polls SSL status until `active` before persisting the bucket's public URL
