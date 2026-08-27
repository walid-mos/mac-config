# Observability Service (`[services.observability]`)

Self-hosted metrics + logs + alerting, injected as a compose sidecar stack on the VPS alongside the app. It is the monitoring **control plane** — one VPS runs it (the Astro dashboard that also serves `/api/sd/*` to vmagent); every other VPS is a scrape target. Registered in `SERVICE_NAMES` like R2/Postgres, but it provisions nothing external — all state lives in local compose volumes, so `provision` is a no-op (`SERVICE_REQUIRES_INFRA_STORAGE = false`).

## Config

```toml
[services.observability]
logs_retention           = "30d"                          # VictoriaLogs -retentionPeriod
metrics_retention_months = 12                             # VictoriaMetrics retention, integer months
logs_vhost               = "logs.monitoring.nextnode.fr"  # Caddy front for log ingestion + LogsQL
metrics_vhost            = "metrics.monitoring.nextnode.fr"# Caddy front for vmui (ad-hoc PromQL)
```

Validation (`config/validation/services/observability.ts`): `logs_retention` is a positive integer + single unit suffix `h/d/w/y` (`/^[1-9][0-9]*[hdwy]$/`); `metrics_retention_months` is an integer `1–120`; both vhosts are non-empty hostnames. The vhosts are **tailnet** hostnames Caddy fronts VictoriaLogs / VictoriaMetrics with — resolved to the VPS tailnet IP, never public.

It contributes an **empty `ServiceEnv`** (`observability.service.ts`). The stack's secrets (`RESEND_API_KEY`, `HEALTHCHECKS_PING_URL`) flow through the global `[deploy].secrets` pool and are consumed at deploy time by the alertmanager config renderer — never by the app runtime. Both are optional: the stack deploys before notification channels are wired.

## Stack components

Seven compose services (`domain/services/observability.ts`), four persistent volumes, each memory-capped to bound a cardinality-leak OOM:

| Service | Image | Port (loopback) | Network | Role |
|---------|-------|-----------------|---------|------|
| `victorialogs` | `victoria-logs:v1.17.0-victorialogs` | `127.0.0.1:9428` | bridge | log storage + ingestion + LogsQL |
| `victoriametrics` | `victoria-metrics:v1.115.0` | `127.0.0.1:8428` | bridge | metrics storage + PromQL eval |
| `vmagent` | `vmagent:v1.115.0` | (host) | **host** | scrape agent — reaches tailnet exporters |
| `vmalert` | `vmalert:v1.115.0` | internal | bridge | PromQL rules → Alertmanager |
| `vmalert-vlogs` | `vmalert:v1.115.0` | internal | bridge | LogsQL rules → recording rules into VM |
| `alertmanager` | `alertmanager:v0.28.1` | internal `:9093` | bridge | notification router |
| `blackbox` | `blackbox-exporter:v0.25.0` | `127.0.0.1:9115` | bridge | external HTTPS probes |

`vmagent` is the **only** host-networked component — it needs to reach client exporters over the tailnet and remote-write to VM over loopback. Every other component stays on the compose bridge, and every published port binds `127.0.0.1` — Caddy is the only trust boundary, the stack is unreachable from the public internet. Volumes: `vl-data`, `vm-data`, `vmagent-data`, `am-data`.

## Config files (rendered at deploy)

Five YAML files are rendered fresh per deploy (pure logic in `domain/monitoring/`), written next to `compose.yaml` over SFTP, bind-mounted read-only: `vmagent.yml` (scrape targets + relabel + remote-write), `vmalert-rules.yml` (PromQL alerts), `vmalert-vlogs-rules.yml` (LogsQL → VM recording rules), `alertmanager.yml` (routing), `blackbox.yml` (probe modules). Environment-specific labels, project name, and tailnet IP are baked in at render time — no runtime template substitution.

## Service discovery

vmagent scrapes via http_sd from two endpoints the **primary routed app service** must expose:

- `/api/sd/targets` — client-VPS exporters (node_exporter `:9100`, cAdvisor `:9101`, postgres-exporter `:9187`), kept to client hosts by a `tag:server` relabel
- `/api/sd/probes` — public domains to probe for external-view HTTPS checks

If a project declares `[services.observability]` but routes nothing (no service with a `url`), rollout fails loud.

## Golden-image exporters (the scrape targets)

Every VPS golden image pre-installs/pre-pulls three exporters, all bound to the tailnet interface (UFW + Hetzner FW), so a client VPS is observable the moment it joins the tailnet:

| Exporter | Port | Binding | Scope |
|----------|------|---------|-------|
| node_exporter `v1.9.1` | `:9100` | `tailscale0` | machine: CPU/mem/disk/net/pressure |
| cAdvisor `v0.49.1` | `:9101` | `${TS_IP}` (from `/etc/monitoring/env`, written at convergence) | per-container: CPU/mem/OOM/restarts |
| postgres-exporter `v0.18.0` | `:9187` | `${TAILSCALE_IP}` (compose `.env`) | DB stats (embedded postgres only) |

The monitoring VPS distinguishes itself from workload VPS via R2 state labels, not a per-role Tailscale tag (every host carries a single `tag:server`). See [golden-image.md](golden-image.md). The embedded-postgres exporter (`DATA_SOURCE_URI`/`USER`/`PASS`) is now the only variant.

## Caddy integration + access logs

Two upstreams front the stack on loopback (`buildObservabilityUpstreams`, injected into the Caddy JSON config by `composeCaddyConfig`): `logs_vhost → 127.0.0.1:9428`, `metrics_vhost → 127.0.0.1:8428`. Caddy's JSON access logs are enabled (empty `logs` object on the https server) — JSON lines → stderr → journald → Vector → VictoriaLogs, where the `nn:http_*` recording rules turn them into per-vhost SLO series.

## Dev vs prod

Identical stack in both environments; config is rendered per-deploy with environment-specific labels. Only the dedicated monitoring VPS declares the service — it is not part of a normal app deploy.

## Teardown

`teardown` removes the stack's compose services and (on the appropriate scope) the four named volumes. The VPS, golden-image exporters, and Caddy stay in place.

## Rules

1. **Compose-only, never externally provisioned** — no R2 state bucket, no credentials pushed to GitHub; the stack's secrets are consumed at render time by the alertmanager config, never by the app. `provision` is a no-op.
2. **vmagent is the only host-networked component** — it reaches client exporters over the tailnet; everything else stays on the bridge.
3. **Every published port binds `127.0.0.1`** — Caddy (tailnet vhosts) is the trust boundary; nothing observability-related touches the public IP.
4. **Service discovery is HTTP-based** — `/api/sd/targets` + `/api/sd/probes` MUST be exposed by the primary routed app service, or rollout fails loud.
5. **Notification secrets are optional + togglable** — add/remove `RESEND_API_KEY` / `HEALTHCHECKS_PING_URL` in `[deploy].secrets` and redeploy to wire/unwire channels.
