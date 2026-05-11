# Deploy Environment Variables

Each `DeployTarget` owns its deploy env via the `contributeEnv()` method on the interface. The CLI command calls `target.contributeEnv(projectName)`, merges its result with every backing service's `ServiceEnv` and the user-declared secrets via `mergeServiceEnvs`, narrows the merged public Record into a `DeployEnv` via `buildDeployEnv()`, writes the public half to `$GITHUB_ENV`, then passes the narrowed env to `target.deploy()`.

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

## Cloudflare Pages env

Two mechanisms:

1. **Build time**: `computeDeployEnv` writes `SITE_URL` to `$GITHUB_ENV` so `pnpm build` sees `import.meta.env.SITE_URL`
2. **Runtime**: `sync-pages-env` PATCHes the Pages project env vars via API - computed values as `plain_text`, secrets from `[deploy].secrets` as `secret_text`

## Hetzner VPS env

`contributeEnv` is synchronous - SITE_URL is `https://{resolveDeployDomain(domain, environment)}`. No API call needed.

Runtime env is written as a `.env` file on the VPS via SSH, containing `SITE_URL`, `PORT`, and all declared secrets + service-secret env. Docker Compose loads it automatically.

## SITE_URL computation

The Hetzner target's `contributeEnv` builds SITE_URL synchronously via `resolveDeployDomain(domain, environment)`. The Cloudflare target needs an API lookup for the live `*.pages.dev` subdomain when no custom domain is configured, so its `contributeEnv` returns a Promise.

Uses `AppEnvironment` (not `PipelineEnvironment`) - the `'none'` guard is in the command layer.

## Dev subdomain convention

`resolveDeployDomain()` in `domain/deploy-domain.ts` - single source of truth:

```typescript
export function resolveDeployDomain(domain: string, environment: AppEnvironment): string {
  if (environment === 'development') return `dev.${domain}`
  return domain
}
```

Used by:
- `deploy-env.ts` → SITE_URL
- `dns-records.ts` → CNAME record name
- `pages-domains.ts` → Pages custom domain name

## Secrets flow

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
