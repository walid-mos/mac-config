# Cron service (`[[deploy.cron]]`)

Scheduled HTTP jobs, declared **entirely in `nextnode.toml`** under the `[[deploy.cron]]` table-array. Each job fires a request at one of the project's own services over the compose network, on a cron schedule. Hetzner-vps only — a Cloudflare Pages static site has no always-on runtime to schedule against, so `[[deploy.cron]]` on `cloudflare-pages` is rejected at parse.

```toml
[[deploy.cron]]
name     = "cleanup"            # kebab, unique across jobs
schedule = "0 3 * * *"          # standard 5-field cron expression
path     = "/api/cron/cleanup"  # absolute path, hit on the target service internally
method   = "POST"               # optional, GET | POST (default POST)
service  = "web"                # optional, default = primary (first) service

[[deploy.cron]]
name     = "ping"
schedule = "*/15 * * * *"
path     = "/api/health/refresh"
method   = "GET"
```

Multiple jobs are accepted; each becomes one crontab line. Nothing lives outside `nextnode.toml` — no GitHub Variable, no extra file, no caller change. The service name `cron` is reserved for the sidecar — a project that declares `[deploy.services.cron]` is rejected at parse.

## Why "target the app", not a URL

A job names a `path` and (optionally) a `service`, never a host. The infra resolves the target to `http://<service>:<port><path>` on the project's compose network — `<port>` is that service's declared `port`, `<service>` its compose service name. The public URL is infra-generated (`computeSiteUrl`/`resolveDeployDomain`), so making the dev re-spell it would just be a second source of truth that could drift. Omitting `service` targets the **primary** (first-declared) service — the same "first service is the app" convention `[deploy.volumes]` uses.

## How it runs (the `cron` sidecar)

`buildCronScheduler` (`domain/services/cron.ts`, pure) renders ONE compose service named `cron` for the whole project:

- **Image** `alpine:3.21`, pinned. BusyBox `crond` + `wget` both ship in the base image — no custom build, no Docker socket, no dependency on the app image. (Same pin discipline as the postgres/observability image constants.)
- **Crontab** passed via the `CRONTAB` env (one line per job), materialised by a fixed bootstrap `command`: `echo "$CRONTAB" > /etc/crontabs/root && exec crond -f -l 8 -L /dev/stdout -c /etc/crontabs`. Keeping the lines in the env keeps the command string job-independent.
- **Each line** `<schedule> wget -q -O /dev/null -T 30 [--post-data=''] 'http://<service>:<port><path>'`. The URL is **single-quoted** — crond runs each command through `/bin/sh -c`, so an unquoted query string would let `&` background the request. POST adds `--post-data=''` (empty body — the trigger is the call; the app owns the work); GET omits it. `-T 30` bounds a hung endpoint.
- **`depends_on`** each distinct target service, gated by source: `service_healthy` for a `build` service (it exposes `/healthz`), `service_started` for an `upstream` one (no forced probe) — so the sidecar does not fire its first tick before the app is up.
- **`restart: unless-stopped`** — the scheduler survives a single failed run.

`renderComposeFile` spreads the sidecar into the compose `services` map (after postgres/observability). It rides the existing two-phase rollout, teardown (`docker compose down` rotates it with everything else), and Vector log capture (`crond -L /dev/stdout`) — no new provisioning, DNS, Caddy route, host port, or secret channel.

## Dev vs prod

Rendered in **both** environments, unlike the prod-only postgres backup loop. They are isolated by construction: dev and prod are separate compose stacks on (possibly) separate VPS, each with its own `cron` sidecar hitting its own app at its own internal hostname. A dev cron can never reach the prod app.

## Schedule format

Standard **5-field** cron (`minute hour day-of-month month day-of-week`). Validation (`config/validation/cron.ts`) parses each field against its real value range (minute 0–59, hour 0–23, day-of-month 1–31, month 1–12, day-of-week 0–7) and operator grammar (`*`, `N`, `N-M`, `*/STEP`, comma-lists). So an expression that would be a silent no-fire on the VPS — wrong field count, out-of-range value, inverted range (`5-1`), zero step (`*/0`), bare operator, or a `@daily`-style macro BusyBox `crond` cannot parse — fails loud at parse instead. Day-of-week accepts `7` as a second spelling of Sunday (`0`), matching `crond`.

## Path safety

`path` must be absolute (`/...`) and cannot contain whitespace or quote characters (`[\s'"\\` + "`" + `]`, rejected by `UNSAFE_PATH_PATTERN`). It is interpolated into the crontab line and single-quoted into the shell command — a space/newline would split the wget args or inject a new crontab line, a quote would break out of the surrounding single-quotes. Query strings (`?a=1&b=2`) stay allowed: the single-quoting makes `&` inert.

## Security / semantics caveats

- The `/api/...` route the cron hits is also reachable publicly through Caddy — the **app** owns making it idempotent and, if needed, auth-protected (e.g. a shared-secret header checked server-side). v1 injects no auth header into the sidecar (least privilege: it only needs network reach).
- BusyBox `crond` does not re-run missed ticks and applies no overlap/timeout policy beyond `wget -T`. Long or overlapping jobs belong in app-side queue logic, not a cron ping.
- Failures surface in the `cron` container logs (Vector). Dedicated alerting on cron failures is a future addition, not v1.

## Code map

| Concern | Location |
|---------|----------|
| Schema types (`CronJobConfig`, `CRON_METHODS`, `DEFAULT_CRON_METHOD`) | `config/types.ts` |
| Parse + cross-validate (`validateCronJobs`) | `config/validation/cron.ts` |
| Wire into the hetzner section / reject on cloudflare | `config/validation/providers/{hetzner,cloudflare-pages}.ts` |
| Render the sidecar (`buildCronScheduler`) | `domain/services/cron.ts` |
| Spread into the compose file | `domain/hetzner/compose-file.ts` |
| Thread config → compose (`cron`) | `cli/deploy/create-hetzner-target.ts` → `adapters/hetzner/{target,rollout,deploy-container}.ts` |
