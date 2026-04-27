# R2 Service Abstraction

Per-project Cloudflare R2 (object storage) buckets, modeled as a backing service. Declared in `[services.r2]`, provisioned during `provision`, credentials and bucket names threaded into the deployed app at `deploy` time.

## Why a separate "service" layer

R2 is the first registered backing service, but the layer is generic. Every service contributes a `{public, secret}` `ServiceEnv` block, and they merge through the same `mergeServiceEnvs` primitive that the `DeployTarget` uses for `contributeEnv()`. Two services claiming the same env key throws — collision is a bug, not a silent overwrite.

Adding a new backing service (D1, KV, Postgres, …) is a pattern, not a one-off:

1. Append the name to `SERVICE_NAMES` in `config/types.ts` (TypeScript then forces every site that handles services to handle it).
2. Add its config type to `ServiceConfigByName`.
3. Set its `SERVICE_REQUIRES_INFRA_STORAGE` flag (does it need the infra state/cert buckets?).
4. Write a pure builder in `domain/services/<name>.ts` (state type + `buildServiceEnv()`).
5. Wire up the adapter (`adapters/<provider>/<name>.ts`) and provisioning hook.

## Config

```toml
[services.r2]
buckets = ["uploads", "thumbnails"]
```

Bucket aliases are kebab-case; each alias becomes one Cloudflare R2 bucket per environment.

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
2. Calls `ensureR2Bucket` (`adapters/cloudflare/r2/buckets.ts`) — idempotent, creates if absent.
3. Builds an R2 token policy via `buildR2TokenPolicy` (read+write on every declared bucket).
4. Calls `createR2Token` (`adapters/cloudflare/r2/tokens.ts`) — POST `/user/tokens`. Returns the CF API token value.
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
}
```

**Two R2 paths — separated by privilege level**:

| Path | Used by | What it does | Privilege needed |
|------|---------|-------------|-----------------|
| `domain/services/r2.ts` + `adapters/cloudflare/r2/*` | `provision` | Create buckets, mint token, derive S3 creds, persist state | Cloudflare API token with R2 admin |
| `adapters/r2/client.ts` + `verify-credentials.ts` | `deploy` | Read state from infra R2, verify via SigV4 handshake, hand to runtime | None (creds already in state) |

Deploy never needs CF admin privileges — it just consumes what provision wrote.

## Runtime contract (deploy command)

`buildR2ServiceEnv(state)` projects the state to env:

```typescript
function buildR2ServiceEnv(state: R2ServiceState): ServiceEnv {
  const publicEnv = { R2_ENDPOINT: state.endpoint }
  for (const binding of state.buckets) {
    publicEnv[`R2_BUCKET_${binding.alias.toUpperCase().replaceAll('-', '_')}`] = binding.name
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

The deploy orchestrator merges this with the `DeployTarget.contributeEnv()` and the user's `[deploy].secrets` via `mergeServiceEnvs` — the public channel goes through `GITHUB_ENV` (visible in workflow log file), the secret channel routes through `DeployInput.secrets` (never logged, written into the VPS `.env` file via SSH or pushed into the Pages env vars as `secret_text`).

## App code

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,        // public
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,        // secret
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!, // secret
  },
})

await s3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_UPLOADS!,    // public, alias-derived
  Key: `users/${userId}/avatar.png`,
  Body: buffer,
}))
```

Bucket aliases are stable (the env var name doesn't change between environments). Bucket names DO change per environment — code never references the materialized name directly.

## Teardown

`teardown` for an R2-using project deletes:

1. Each provisioned bucket (via Cloudflare API)
2. The R2 API token (deleted via CF API)
3. The state object in `nextnode-state` under the project's key

`teardown-guard` validates this is safe before destruction (e.g. checks for presence of `[deploy].vps` or other indicators that the project is in active use).

## Rules

1. **Bucket naming is centralized** — only `computeR2BucketName` constructs `<project>-<env>-<alias>`. Never hand-build the string.
2. **Aliases are kebab-case** — the env var key derives via uppercase + `-` → `_`. `R2_BUCKET_USER_UPLOADS` comes from alias `user-uploads`.
3. **Credentials are derived, not stored upstream** — the CF API token returned by `createR2Token` is hashed via SHA256 to produce the S3 secret key. The CF token itself is **NOT** persisted in state — only the derived S3 key pair.
4. **State lives in infra R2, not per-project** — every project's R2 service state is a JSON object in the `nextnode-state` bucket. The deploy job reads it back via S3 SDK; the app never reads it directly.
5. **Public vs secret channels are non-negotiable** — bucket names + endpoint flow through `GITHUB_ENV` (public). Access keys flow through `DeployInput.secrets` (secret). Never put a secret on the public channel — `mergeServiceEnvs` enforces the partition but the rule is "credentials live in the secret half".
6. **Adding a new service follows the pattern** — `SERVICE_NAMES` + `ServiceConfigByName` + `SERVICE_REQUIRES_INFRA_STORAGE` + `domain/services/<name>.ts` builder + adapter wiring. TypeScript will surface every site that needs to handle the new service.
