# Deploy Environment Variables

Config reaches a service through **two distinct doors**, and they never cross:

- **BUILD door** — values inlined into the image at build time (Astro `site`, `NEXT_PUBLIC_*`, `VITE_*`). A `.env` does NOT traverse the Docker build (the root `.dockerignore` excludes it); only docker-bake build args do. Carries `build_args` (dev-declared extra Variable NAMES) + the auto-injected `SITE_URL`. **Secrets are banned here** — a build arg bakes into image layers. See "Build args" below.
- **RUNTIME door** — values injected via compose `env_file` at run time, per service. Carries the target's `contributeEnv()` public env, every backing service's `ServiceEnv`, and the per-service projected `secrets`. See "Hetzner VPS env" below.

Each `DeployTarget` owns its runtime deploy env via the `contributeEnv()` method on the interface. The CLI command calls `target.contributeEnv(projectName)`, merges its result with every backing service's `ServiceEnv` and the user-declared secrets via `mergeServiceEnvs`, narrows the merged public Record into a `DeployEnv` via `buildDeployEnv()`, writes the public half to `$GITHUB_ENV`, then passes the narrowed env to `target.deploy()`.

## DeployTarget.contributeEnv

```typescript
interface ServiceEnv {
  readonly public: Readonly<Record<string, string>>
  readonly secret: Readonly<Record<string, string>>
}

interface TargetEnv extends ServiceEnv {
  readonly public: Readonly<Record<string, string>> & {
    readonly SITE_URL: string  // required - every app needs it at build + runtime
  }
}

interface DeployEnv {
  readonly SITE_URL: string
  readonly [key: string]: string
}

// On the DeployTarget interface:
contributeEnv(projectName: string): TargetEnv | Promise<TargetEnv>
```

Returns `T | Promise<T>` so sync impls (Hetzner - pure config arithmetic) stay sync, while async impls (Cloudflare - API lookup for `*.pages.dev` subdomain) return a Promise. Callers `await` either way.

The `{public, secret}` shape mirrors a backing-service `ServiceEnv` so targets and services merge through the same primitive (`mergeServiceEnvs`) - one collision detector for both. Two contributors claiming the same key throws.

## buildDeployEnv

```typescript
function buildDeployEnv(values: Readonly<Record<string, string>>): DeployEnv {
  const siteUrl = values['SITE_URL']
  if (!siteUrl) {
    throw new Error('SITE_URL missing - every DeployTarget must put it in contributeEnv().public')
  }
  return { ...values, SITE_URL: siteUrl }
}
```

Narrows the merged `Record<string, string>` into a `DeployEnv`. Throws when SITE_URL is missing - that means a target skipped its contract obligation, which is a wiring bug, not a runtime condition.

## Build args (the BUILD door)

Build-time-inlined config is resolved per `build` service into the docker-bake target's `args` by `compute-image-ref`. Two sources, all pure domain (`domain/deploy/build-args.ts`):

```typescript
// The infra's auto-injected args — the dev never declares these. Today: SITE_URL.
function computePublicBuildArgs(domain: string, environment: AppEnvironment): Record<string, string> {
  return { SITE_URL: computeSiteUrl(domain, environment) }
}

// Per build service: autoArgs ∪ the service's dev-declared `build_args`, resolved
// against the GitHub Variables map (ALL_VARS = toJSON(vars)). Upstream services
// contribute no entry. Build services only.
function resolveBuildArgs(
  services: Record<string, UserServiceConfig>,
  vars: Record<string, string>,      // readJsonRecordEnv('ALL_VARS')
  autoArgs: Record<string, string>,  // computePublicBuildArgs(...)
): Record<string, Record<string, string>>
```

- `build_args = ["ANALYTICS_ID", ...]` in `nextnode.toml` lists only the dev's EXTRA Variable NAMES. The VALUES never live in the toml — they come from repo/org GitHub **Variables** (`ALL_VARS`). `resolveDeclaredBuildArgs` **fails loud** when a declared name is absent from `ALL_VARS` (a Variable declared-but-unset is a CI config bug, not a value to default away).
- `SITE_URL` is auto-injected into every build target (deploy-wide, env-resolved from `project.domain`). The dev never lists it. It shares `computeSiteUrl` with the runtime env, so build-baked and runtime values cannot drift.
- `build_args` is **forbidden on `upstream` services** (a pulled image is not built). Validated in `config/validation/deploy.ts`.
- **Secrets NEVER flow through build args** — a build arg bakes into the image layers / `docker history` / the pushed GHCR image. Build-time secrets use `RUN --mount=type=secret`.

`compute-image-ref` writes these into `BakeTarget.args` (`domain/deploy/bake-file.ts`); the bake renderer omits the `args` key for a target that maps to an empty record, so no empty-filtering is needed.

## Cloudflare Pages env

Two mechanisms:

1. **Build time**: `computeDeployEnv` writes `SITE_URL` to `$GITHUB_ENV` so `pnpm build` sees `import.meta.env.SITE_URL`
2. **Runtime**: `sync-pages-env` PATCHes the Pages project env vars via API - computed values as `plain_text`, secrets from `[deploy].secrets` as `secret_text`

## Hetzner VPS env

`contributeEnv` is synchronous - SITE_URL is `https://{resolveDeployDomain(domain, environment)}`. No API call needed.

Runtime env is written as a **per-service** file on the VPS via SSH (`.env.<service-name>`, under `/opt/apps/<project>/<environment>/`). The VPS-rendered compose points each service's `env_file` at its own `.env.<name>`. Each file contains:
- `PORT=<service.port>` — the port declared in `[deploy.services.<name>].port` (default 3000), injected by `stageRollout` so the value is identical to the compose port mapping and the `/healthz` probe target. Never a hardcoded `CONTAINER_PORT`.
- `SITE_URL=https://<domain or dev.domain>` (from `computeSiteUrl`)
- **One `<SIBLING_NAME_UPPER_SNAKE>_URL=https://<resolved-hostname>` per routed sibling, including self** — symmetric cross-service URL injection so no service needs to know who depends on whom (`buildServiceUrlEnv` in `domain/hetzner/service-env.ts`). Internal services (no `url`) contribute nothing.
- Every public env contributed by the target + every backing service's `ServiceEnv.public`
- **Only the secrets this service is entitled to** — secret projection, least-privilege by construction (see below).

N services per project produce N `.env.<name>` files; each file is the isolation unit for that service's runtime env.

### Per-service secret projection (least privilege, no broadcast)

`buildServiceSecretEnv(services, secrets, origins)` (`domain/hetzner/service-env.ts`) routes the deploy secrets across the `.env.<name>` files. A service receives a secret only when entitled — two disjoint channels, each with its own rule (`projectSecretsForService`):

- a **USER secret** — no producer in `origins` — is included only when the service lists it in its own `secrets`;
- a **BACKING secret** — produced by another service, so `origins` names its producer (e.g. `DATABASE_URL` → `postgres`, `R2_*` → `r2`) — is included only when the service declares `needs = [<producer>]`.

So a postgres `DATABASE_URL` lands in the schema owner's `.env`, never in a front service that does not need it. A service that needs and declares nothing maps to an empty record.

A **GLOBAL `[deploy].secrets`** name needs no special handling here: validation already folded it into every service's own `secrets` (`expandServiceSecrets`), so the router sees it as a USER secret on every service and projects it into every `.env.<name>`. The least-privilege routing above only distinguishes per-service vs backing secrets — global is just "declared on all services".

**Provenance** is the `secretOrigins` map (secret key → producing service), built once in `resolve-deploy-context` and threaded as data through `DeployInput.secretOrigins` → the container target. It is a required, possibly-empty map (Cloudflare Pages passes `{}` — no backing services).

### Shared `.env` for the DB sidecar + migrate (backing secrets only)

The embedded-postgres sidecar (`env_file: ['.env']`), the backup sidecar (`${VAR}` compose interpolation) and the ephemeral migrate container (`--env-file .env`) all read a bare `.env` — distinct from the per-service `.env.<name>` files. `stageRollout` writes it via `selectBackingSecrets(secrets, origins)`, which keeps **only the BACKING secrets** (those whose key appears in `origins` — `POSTGRES_*`, `R2_*`, `DATABASE_URL`). The app's user secrets (`SESSION_KEY`, `STRIPE_SECRET_KEY`, …) are excluded on purpose: the DB/backup/migrate infra has no business reading them.

## SITE_URL computation

`computeSiteUrl(domain, environment)` (`domain/deploy/domain.ts`) is the **single source of truth** for SITE_URL — shared by the runtime env (every target's `contributeEnv().public.SITE_URL`) AND the build args (`computePublicBuildArgs`), so the value baked into the image and the value injected at runtime can never drift:

```typescript
export function computeSiteUrl(domain: string, environment: AppEnvironment): string {
  return `https://${resolveDeployDomain(domain, environment)}`
}
```

The Hetzner target's `contributeEnv` builds SITE_URL synchronously. The Cloudflare target needs an API lookup for the live `*.pages.dev` subdomain when no custom domain is configured, so its `contributeEnv` returns a Promise — but both route through `computeSiteUrl`. Uses `AppEnvironment` (not `PipelineEnvironment`) — the `'none'` guard is in the command layer.

## Dev subdomain convention

`resolveDeployDomain()` in `domain/deploy/domain.ts` - single source of truth:

```typescript
export function resolveDeployDomain(domain: string, environment: AppEnvironment): string {
  if (environment === 'development') return `dev.${domain}`
  return domain
}
```

Used by:
- `domain.ts` → `computeSiteUrl` → SITE_URL (build arg + runtime)
- `service-env.ts` → cross-service `<NAME>_URL` injection
- `dns-records.ts` → DNS record name
- `pages-domains.ts` → Pages custom domain name
- `service-upstreams.ts` → Caddy upstream hostname

## Secrets flow (Cloudflare Pages)

cloudflare-pages's secret pool IS `[deploy].secrets` directly — one deployable unit, no per-service split. (hetzner-vps ALSO accepts `[deploy].secrets` as a GLOBAL pool now: `expandServiceSecrets` folds those names into every service, and the pull pool = global ∪ every service's own `secrets`. Entries may be must-exist names or `{name,generate,length}` auto-generated tables — see SKILL.md rules 25–26.)

```
nextnode.toml                  GitHub                    Cloudflare Pages
[deploy]                       Secrets                   Project env vars
secrets = ["RESEND_API_KEY"]   RESEND_API_KEY=xxx        RESEND_API_KEY=xxx (secret_text)
                                   |                         ^
                                   | toJSON(secrets)         |
                                   v                         |
                               sync-pages-env ───────────────┘
                               picks by name, pushes via PATCH API
```

Same name on GitHub and Cloudflare. No prefix, no transformation.

## Cloudflare API

`updatePagesEnvVars()` in `adapters/cloudflare-pages-env.ts`:

```
PATCH /accounts/{accountId}/pages/projects/{projectName}
{
  "deployment_configs": {
    "production": {
      "env_vars": {
        "SITE_URL": { "type": "plain_text", "value": "https://example.com" },
        "RESEND_API_KEY": { "type": "secret_text", "value": "xxx" }
      }
    }
  }
}
```

Only pushes to `production` deployment config (preview is not used for static sites).

PATCH merges with existing env vars - keys not in the payload are left untouched.
