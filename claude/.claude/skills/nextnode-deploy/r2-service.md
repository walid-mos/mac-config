# R2 Service Abstraction

Per-project Cloudflare R2 (object storage) buckets, modeled as a backing service. Declared in `[services.r2]`, provisioned during `provision`, credentials and bucket names threaded into the deployed app at `deploy` time.

## Why a separate "service" layer

R2 is the first registered backing service, but the layer is generic. Every service contributes a `{public, secret}` `ServiceEnv` block, and they merge through the same `mergeServiceEnvs` primitive that the `DeployTarget` uses for `contributeEnv()`. Two services claiming the same env key throws - collision is a bug, not a silent overwrite.

## Config

```toml
[[services.r2.buckets]]
name = "uploads"
cdn  = true          # public custom domain uploads.cdn.<domain> + R2_BUCKET_UPLOADS_URL

[[services.r2.buckets]]
name = "thumbnails"  # cdn omitted -> private bucket, no public URL
```

`buckets` is a **table-array** of `{ name, cdn }` (`R2BucketConfig`). Bucket aliases (`name`) are kebab-case; each becomes one Cloudflare R2 bucket per environment. `cdn` defaults to `false` (private). `cdn = true` opts the bucket into a public Cloudflare custom domain (see "Public CDN domains" below) — requires `project.domain`.

## Naming and addressing (pure logic)

`domain/services/r2.ts` owns the naming:

```typescript
computeR2BucketName('my-app', 'production', 'uploads')
// → 'my-app-production-uploads'

r2ServiceTokenName('my-app', 'production')
// → 'nextnode-r2-my-app-production'

r2ServiceStateKey('my-app', 'production')
// → 'services/r2/my-app/production.json'
```

Endpoint computation lives in `domain/cloudflare/r2/addressing.ts` (`computeR2Endpoint`, `computeR2Host`), keyed off the Cloudflare account ID.

## Provisioning (provision command)

For each declared bucket alias, the provisioner:

1. Resolves the canonical bucket name via `computeR2BucketName`.
2. Calls `ensureR2Bucket` (`adapters/cloudflare/r2/buckets.ts`) - idempotent, creates if absent.
3. Builds an R2 token policy via `buildR2TokenPolicy` (read+write on every declared bucket).
4. Calls `createR2Token` (`adapters/cloudflare/r2/tokens.ts`) - POST `/user/tokens`. Returns the CF API token value.
5. Derives S3-compatible access key + secret key from the CF token via SHA256 (`deriveR2Credentials` in `domain/cloudflare/r2/credentials.ts`).
6. Persists the resulting `R2ServiceState` to the infra state R2 bucket (`nextnode-state`) under `services/r2/{projectName}/{environment}.json`.

```typescript
interface R2ServiceState {
  readonly endpoint: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly buckets: ReadonlyArray<R2BucketBinding>
}

interface R2BucketBinding {
  readonly alias: string
  readonly name: string
  readonly publicUrl?: string  // present only for `cdn = true` buckets (and only when project has a domain)
}
```

**Two R2 paths - separated by privilege level**:

| Path | Used by | What it does | Privilege needed |
|------|---------|-------------|-----------------|
| `domain/services/r2.ts` + `adapters/cloudflare/r2/*` | `provision` | Create buckets, mint token, derive S3 creds, persist state | Cloudflare API token with R2 admin |
| `adapters/r2/client.ts` + `verify-credentials.ts` | `deploy` | Read state from infra R2, verify via SigV4 handshake, hand to runtime | None (creds already in state) |

Deploy never needs CF admin privileges - it just consumes what provision wrote.

## Public CDN domains (`cdn = true`)

A bucket with `cdn = true` is served publicly at `<alias>.cdn.<resolveDeployDomain(project.domain)>` (e.g. `uploads.cdn.dev.example.com` in development). The `cdn.` parent keeps public buckets isolated from the apex and the app's own routes. This is the only prod-allowed path — the `*.r2.dev` managed domain is rate-limited / non-prod.

- **Pure logic** (`domain/cloudflare/r2/custom-domain.ts`): `computeR2CustomDomainHostname(alias, resolvedDomain)` → `<alias>.cdn.<resolvedDomain>`, `computeR2PublicUrl(hostname)` → `https://<hostname>`. `resolvedDomain` is the **already env-resolved** deploy domain — the caller resolves it ONCE; re-resolving here would double the `dev.` prefix.
- **Adapter** (`adapters/cloudflare/r2/domains.ts`): `ensureR2CustomDomain` (idempotent GET-before-POST via `listR2CustomDomains`; passing `zoneId` lets Cloudflare auto-create the proxied CNAME — no separate DNS write), `getR2CustomDomainStatus`, `deleteR2CustomDomain`.
- **Provision** (`cli/services/r2/ensure.ts` → `attachCustomDomains`): resolves the zone id ONCE (`lookupZoneId(extractRootDomain(deployDomain))`), attaches a custom domain to every `cdn` bucket, then `awaitR2DomainActive` polls `getR2CustomDomainStatus` until `ssl === "active"` (20 × 5s, fails loud) before the binding's `publicUrl` is persisted — so the stored URL actually serves. `ensure`'s `deployDomain: string | null` comes pre-resolved from `ctx.deployDomain`; `null` (no `project.domain`) ⇒ no bucket gets a domain.
- **Teardown**: `project`-scope teardown detaches every `cdn` bucket's custom domain (`deleteR2CustomDomain`) — Cloudflare removes the auto-created CNAME with it. `vps` scope leaves R2 in place.

## Runtime contract (deploy command)

`buildR2ServiceEnv(state)` projects the state to env:

```typescript
function buildR2ServiceEnv(state: R2ServiceState): ServiceEnv {
  const publicEnv = { R2_ENDPOINT: state.endpoint }
  for (const binding of state.buckets) {
    const key = `R2_BUCKET_${binding.alias.toUpperCase().replaceAll('-', '_')}`
    publicEnv[key] = binding.name
    if (binding.publicUrl !== undefined) publicEnv[`${key}_URL`] = binding.publicUrl  // cdn buckets only
  }
  return {
    public: publicEnv,
    secret: {
      R2_ACCESS_KEY_ID: state.accessKeyId,
      R2_SECRET_ACCESS_KEY: state.secretAccessKey,
    },
  }
}
```

The deploy orchestrator merges this with the `DeployTarget.contributeEnv()` and the user's `[deploy].secrets` via `mergeServiceEnvs` - the public channel goes through `GITHUB_ENV` (visible in workflow log file), the secret channel routes through `DeployInput.secrets` (never logged, written into the VPS `.env` file via SSH or pushed into the Pages env vars as `secret_text`).

## App code

Use `@aws-sdk/client-s3` with `region: 'auto'`, `endpoint: process.env.R2_ENDPOINT`, and the access key / secret access key pair. Bucket names come from `process.env.R2_BUCKET_<ALIAS>` (alias uppercased, `-` → `_`).

Bucket aliases are stable (the env var name doesn't change between environments). Bucket names DO change per environment - code never references the materialized name directly.

For a `cdn = true` bucket, build public links from `process.env.R2_BUCKET_<ALIAS>_URL` (the `https://<alias>.cdn.<domain>` base) — never hand-construct the CDN hostname. The var is absent for private buckets, so reading it tells you whether public serving is enabled.

## Teardown

`teardown` for an R2-using project deletes:

1. Each `cdn = true` bucket's public custom domain (`deleteR2CustomDomain`, `project` scope only — the auto-created CNAME goes with it)
2. Each provisioned bucket (via Cloudflare API)
3. The R2 API token (deleted via CF API)
4. The state object in `nextnode-state` under the project's key

`teardown-guard` validates this is safe before destruction (e.g. checks for presence of `[deploy].vps` or other indicators that the project is in active use).

## Rules

1. **Bucket naming is centralized** - only `computeR2BucketName` constructs `<project>-<env>-<alias>`. Never hand-build the string.
2. **Aliases are kebab-case** - the env var key derives via uppercase + `-` → `_`. `R2_BUCKET_USER_UPLOADS` comes from alias `user-uploads`.
3. **Credentials are derived, not stored upstream** - the CF API token returned by `createR2Token` is hashed via SHA256 to produce the S3 secret key. The CF token itself is **NOT** persisted in state - only the derived S3 key pair.
4. **State lives in infra R2, not per-project** - every project's R2 service state is a JSON object in the `nextnode-state` bucket. The deploy job reads it back via S3 SDK; the app never reads it directly.
5. **Public vs secret channels are non-negotiable** - bucket names + endpoint flow through `GITHUB_ENV` (public). Access keys flow through `DeployInput.secrets` (secret). Never put a secret on the public channel - `mergeServiceEnvs` enforces the partition but the rule is "credentials live in the secret half".
6. **CDN is opt-in per bucket and the deploy domain is resolved ONCE** - the hostname is built from the ALREADY env-resolved domain threaded down as `ctx.deployDomain` (resolved once in `resolveServices`) — `computeR2CustomDomainHostname` never calls `resolveDeployDomain` itself, or development would double the `dev.` prefix (fix `998a233`). Full detail in "Public CDN domains" above.
