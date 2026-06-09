# Hetzner VPS Architecture

Deep-dive into the Hetzner VPS deploy target: internal mode, adapter modules, state management, cloud-init, and domain logic.

## Internal mode

The `project.internal` config field (boolean, default `false`) controls whether a VPS is public or reachable only via Tailscale. It cascades through the entire stack:

| Layer | Public (`internal: false`) | Internal (`internal: true`) |
|-------|---------------------------|----------------------------|
| **DNS** | One A record **per routed service** → VPS public IP, proxied (prod) / unproxied (dev) | One A record per routed service → Tailscale CGNAT IP, never proxied |
| **Firewall** | HTTP/S open globally, SSH restricted to tailscale0 | All traffic restricted to tailscale0 interface |
| **UFW** | `ufw allow 80/tcp`, `ufw allow 443/tcp` | `ufw allow in on tailscale0 to any port 80`, etc. |
| **Caddy** | ACME TLS (via R2 cert storage) | Internal TLS (self-signed or internal CA) |

## Adapter module structure

The old monolithic `HetznerVpsTarget` was split into focused modules in `adapters/hetzner/`:

| Module | Responsibility |
|--------|---------------|
| `target.ts` | `HetznerVpsTarget` - implements `DeployTarget`, orchestrates the workflow |
| `ensure-infra.ts` | High-level provision orchestrator: handles fresh provision vs. resume from saved state |
| `provision-vps.ts` | VPS creation via hcloud API + Tailscale join + firewall setup |
| `converge-vps.ts` | Post-boot convergence: waits for cloud-init, syncs Caddy/Vector config via SSH |
| `deploy-container.ts` | Two-phase container rollout. `stageRollout`: write one `.env.<name>` per declared service (with symmetric cross-service URL injection) + compose.yaml, login to every registry the forwarded token covers, pull every service image. `bringUpDb`: phase 1 brings postgres + postgres-backup to healthy via `docker compose up -d --wait`. `bringUpApp`: phase 2 bare `docker compose up -d --remove-orphans` rotates every user service on the same compose file (cross-phase compose identity invariant — see SKILL.md rule 15). |
| `hcloud-client.ts` | Typed HTTP client for Hetzner Cloud API |
| `hcloud-state.ts` | R2-backed state persistence with ETag-based optimistic locking |
| `hcloud-firewall.ts` | Firewall CRUD helpers |
| `ssh-session.ts` | SSH2 wrapper - one connection per operation, retry logic |
| `derive-public-key.ts` | Derives SSH public key from base64-encoded private key |

## Phase-based state

Provisioning is a multi-step process. State is persisted to R2 after each phase so the pipeline can resume if interrupted (orphan-safe re-entrancy).

State is stored in the `nextnode-state` R2 bucket under key `{projectName}/{environment}.json`. ETag-based locking prevents concurrent provision runs from conflicting.

## R2 bootstrap vs runtime

Two R2 paths - separated by privilege level:

| Path | Used by | What it does | Privilege needed |
|------|---------|-------------|-----------------|
| `cli/r2/ensure-setup.ts` | `provision` | Full bootstrap: ensure buckets exist, verify or rotate R2 creds, persist as GitHub org secrets | Org-admin (GH_TOKEN from GitHub App) |
| `cli/r2/load-runtime.ts` | `deploy` | Lightweight: read R2 creds from env, verify via SigV4 handshake, return config or fail | None (creds already in env) |

**Why split**: Deploy must never need org-admin privileges. Provision sets up everything; deploy just uses it.

## Cloud-init

`renderCloudInit()` in `domain/hetzner/cloud-init.ts` generates the Hetzner cloud-init YAML:

1. **Deploy user**: `name: deploy`, `sudo: ALL=(ALL) NOPASSWD:ALL`, `lock_passwd: true`, authorized with the SSH public key derived from `DEPLOY_SSH_PRIVATE_KEY_B64`
2. **Tailscale**: Installed and joined to the tailnet with the `tag:server` ACL tag
3. **UFW rules**: Configured per `internal` flag (see table above)
4. **Docker**: Installed via convenience script
5. **Caddy**: Installed + systemd unit + initial placeholder config
6. **Vector** (optional): Installed + systemd unit if log sink is configured

SSH from CI always goes through the Tailscale IP, never the public IP. This avoids a race condition where UFW might block SSH before Tailscale is ready.

## Domain logic (pure functions)

All Hetzner-specific business decisions live in `domain/hetzner/`:

### DNS records (`dns-records.ts`)

`computeVpsDnsRecords(input)` - returns one Cloudflare A record per **routed** service (each service declaring a `url`):

- **Internal**: A record per service → `tailnetIp` (CGNAT range, never proxied)
- **Public production**: A record per service → `publicIp` (proxied via Cloudflare CDN, TTL=1)
- **Public development**: A record per service → `publicIp` (unproxied, TTL=300)

Each record's hostname is `resolveDeployDomain(service.url, environment)`. Services without `url` get no DNS record — they're internal-only on the compose network. See [multi-service.md](multi-service.md) for the full routing model.

### Firewall rules (`firewall-rules.ts`)

`computeFirewallRules(internal)` - returns Hetzner Cloud firewall rule array:

- **Internal**: SSH only (port 22)
- **Public**: HTTP (80) + HTTPS (443) + SSH (22)

UFW on the VPS further restricts SSH to the tailscale0 interface in both modes.

### Caddy config (`caddy-for-project.ts` + `service-upstreams.ts`)

`buildCaddyForProject(input)` - high-level orchestrator:

- Routes to `buildCaddyConfig()` (public, ACME via R2 cert storage) or `buildInternalCaddyConfig()` (internal TLS)
- Builds **one upstream per routed service** via `buildServiceUpstreams` (`{hostname: resolveDeployDomain(url, env), dial: "localhost:<hostPort>"}`) — each becomes a reverse-proxy block with its own ACME cert subject
- Services without `url` are omitted from Caddy entirely (compose-network reach only)

### Vector config (`vector-config.ts`)

`selectVectorConfig(input)` - conditional log agent setup:

- Returns `{ vectorToml, vectorEnv }` if `vlUrl` (log sink) is available
- Returns `undefined` values if no sink - Vector is not provisioned

### Cloud-init (`cloud-init.ts`)

`renderCloudInit(input)` - generates complete cloud-init YAML (see section above)

