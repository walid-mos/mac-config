# Deploy Environment Variables

Each `DeployTarget` owns its deploy env via the `computeDeployEnv()` method on the interface. The CLI command calls `target.computeDeployEnv(projectName)`, writes the result to `$GITHUB_ENV`, then passes it to `target.deploy()`.

## DeployTarget.computeDeployEnv

```typescript
interface DeployEnv {
  readonly SITE_URL: string
  readonly [key: string]: string
}

// On the DeployTarget interface:
computeDeployEnv(projectName: string): DeployEnv | Promise<DeployEnv>
```

Returns `T | Promise<T>` so sync impls (Hetzner — pure config arithmetic) stay sync, while async impls (Cloudflare — API lookup for `*.pages.dev` subdomain) return a Promise. Callers `await` either way.

## Cloudflare Pages env

Two mechanisms:

1. **Build time**: `computeDeployEnv` writes `SITE_URL` to `$GITHUB_ENV` so `pnpm build` sees `import.meta.env.SITE_URL`
2. **Runtime**: `sync-pages-env` PATCHes the Pages project env vars via API — computed values as `plain_text`, secrets from `[deploy].secrets` as `secret_text`

## Hetzner VPS env

`computeDeployEnv` is synchronous — SITE_URL is `https://{resolveDeployDomain(domain, environment)}`. No API call needed.

Runtime env is written as a `.env` file on the VPS via SSH, containing `SITE_URL`, `PORT`, and all declared secrets. Docker Compose loads it automatically.

## SITE_URL computation

`computeDeployEnv()` in `domain/deploy/env.ts`:

```typescript
function computeSiteUrl({ projectType, environment, domain, pagesProjectName }: DeployEnvInput): string {
  if (domain) return `https://${resolveDeployDomain(domain, environment)}`
  if (projectType === 'static') return `https://${pagesProjectName}.pages.dev`
  throw new Error(`${projectType} projects require a domain for SITE_URL`)
}
```

Uses `AppEnvironment` (not `PipelineEnvironment`) — the `'none'` guard is in the command layer.

## Dev subdomain convention

`resolveDeployDomain()` in `domain/deploy-domain.ts` — single source of truth:

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

PATCH merges with existing env vars — keys not in the payload are left untouched.
