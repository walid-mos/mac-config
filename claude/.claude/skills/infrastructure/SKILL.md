---
name: infrastructure
description: NextNode infrastructure context. Use when working on servers, deployment, CI/CD, or infrastructure in NextNode/SaaS projects.
disable-model-invocation: true
allowed-tools: Read, Bash
---

# NextNode Infrastructure

Self-hosted deployment platform with Terraform, NixOS, Docker Swarm, and GitHub Actions CI/CD.

## Quick Reference

| Aspect | Value |
|--------|-------|
| Provider | Hetzner Cloud |
| OS | NixOS 24.11 (Flakes) |
| PaaS | Dokploy |
| Reverse Proxy | Traefik |
| VPN | Tailscale (all access) |
| DNS | Cloudflare (automated) |
| IaC | Terraform Cloud |
| State | org: nextnode, workspace: dokploy-infrastructure |

## Server Architecture

| Server | Type | Role | Volume |
|--------|------|------|--------|
| admin-dokploy | cx23 | Dokploy UI, Traefik, Registry, Swarm Manager | 20GB |
| dev-worker | cx23 | Dev/PR deployments, Swarm Worker | - |
| prod-worker | cx33 | Production apps, Swarm Worker | 50GB |

**Access**: Tailscale only. No public SSH.

```bash
ssh -i ~/.ssh/id_hetzner root@admin-dokploy
ssh -i ~/.ssh/id_hetzner root@dev-worker
ssh -i ~/.ssh/id_hetzner root@prod-worker
```

## Docker Swarm Cluster

| Server | Swarm Role | Notes |
|--------|------------|-------|
| admin-dokploy | Manager | Creates cluster, generates tokens |
| dev-worker | Worker | Joins via Tailscale SSH token fetch |
| prod-worker | Worker | Joins via Tailscale SSH token fetch |

**Swarm Tokens**: Stored at `/data/swarm/manager-token` and `/data/swarm/worker-token`

## Private Registry

Registry runs on `admin-dokploy:5000` (Tailscale-only):
```bash
docker push admin-dokploy:5000/myapp:latest
docker pull admin-dokploy:5000/myapp:latest
```

## URLs

| URL | Purpose |
|-----|---------|
| `admin.nextnode.fr` | Dokploy UI (Tailscale only) |
| `secrets.nextnode.fr` | Infisical (Tailscale only) |
| `dev.nextnode.fr` | Dev apps (public) |
| `nextnode.fr` | Production (public) |

---

## Infrastructure Repository

**Path**: `~/Development/Nextnode/infrastructure/`

### Structure
```
terraform/          # Hetzner VPS provisioning
  ├── main.tf       # Root module
  ├── modules/      # hetzner-vps, app-vps
  └── templates/    # cloud-init.yaml
packer/             # NixOS image building
  └── files/        # Nix flake configuration
      └── modules/  # docker, dokploy, traefik, ssh, tailscale, registry, swarm, volumes
config/             # infrastructure.json (source of truth)
```

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| provision.yml | Manual | Plan + Apply (requires approval) |
| image-build.yml | Push to packer/** | Build NixOS snapshot |
| destroy.yml | Manual | Teardown (2 approvers + 5min wait) |
| sync-inputs.yml | Push to config/** | Sync config to workflow inputs |

### Build Cascade (CRITICAL)

```
packer/files/** change → Push to main
  ↓
image-build.yml (automatic, ~5-10 min)
  ↓
provision.yml (plan only, auto-triggered)
  ↓
Review → Approve Apply
```

**NEVER apply before image build completes** - Terraform uses snapshots.

### Common Tasks

| Change Type | What Happens |
|-------------|--------------|
| Edit `packer/files/*.nix` | Build + Plan auto-trigger |
| Edit `config/infrastructure.json` | Build + Plan auto-trigger |
| Edit `terraform/*.tf` only | Nothing auto-triggers (run manually) |

---

## GitHub Actions Repository

**Path**: `~/Development/Nextnode/github-actions/`

### Structure
```
.github/workflows/      # Reusable workflows
actions/                # Domain-organized atomic actions
  ├── app/             # Config, Dokploy sync, domain, port
  ├── build/           # Install, build, docker-build-push
  ├── quality/         # Lint, typecheck, security
  ├── deploy/          # Cross-swarm routing, port publish, vps-provision
  ├── infrastructure/  # Cloudflare DNS, Tailscale OAuth
  ├── release/         # Changesets, NPM provenance
  ├── ssl/             # Cloudflare SSL setup
  └── utilities/       # Helpers
lib/dokploy/           # Shared Python utilities
```

### Key Workflows

| Workflow | Purpose |
|----------|---------|
| quality-checks.yml | Full quality pipeline |
| app-deploy.yml | App deployment (composes atomic actions) |
| release.yml | NPM library release |
| version-management.yml | Automated versioning with changesets |

### Cross-Swarm Routing Pattern

Apps on worker nodes need routing through Traefik on admin-dokploy:
1. **Port Publishing**: Container port exposed on worker via `socat`
2. **Traefik Config**: TCP route from admin-dokploy to worker:port
3. **DNS**: A record points to admin-dokploy

Handled by `deploy/cross-swarm-routing` and `deploy/publish-service-port`.

### Registry-Only Mode (Dokploy v0.25+)

1. Build locally in GitHub Actions runner
2. Push to private registry (`admin-dokploy:5000`)
3. Sync configuration to Dokploy API
4. Set image reference - Dokploy pulls from registry

---

## Secrets Reference (CRITICAL)

### Tailscale OAuth Pattern (NO STATIC AUTH KEY)

**There is NO `TAILSCALE_AUTH_KEY` secret. Auth keys are generated dynamically.**

```yaml
# WRONG - This secret does NOT exist
authkey: ${{ secrets.TAILSCALE_AUTH_KEY }}

# CORRECT - Generate via OAuth
- uses: nextnodesolutions/github-actions/actions/infrastructure/tailscale-oauth@main
  with:
    oauth-client-id: ${{ secrets.TAILSCALE_OAUTH_CLIENT_ID }}
    oauth-secret: ${{ secrets.TAILSCALE_OAUTH_SECRET }}
    generate-auth-key: 'true'
    auth-key-ephemeral: 'true'
```

### Token Derivation Chains

```
TAILSCALE_OAUTH_CLIENT_ID + TAILSCALE_OAUTH_SECRET
    → tailscale-oauth action
    → api-token (API calls) + auth-key (device registration)

DOKPLOY_ADMIN_EMAIL + DOKPLOY_ADMIN_PASSWORD
    → dokploy-auth action
    → token (all Dokploy API calls)

NEXTNODE_APP_ID + NEXTNODE_APP_PRIVATE_KEY
    → create-github-app-token action
    → token (cross-repo operations)
```

### Complete Secrets Table

| Secret | Purpose |
|--------|---------|
| TAILSCALE_OAUTH_CLIENT_ID | Tailscale OAuth |
| TAILSCALE_OAUTH_SECRET | Tailscale OAuth |
| DOKPLOY_ADMIN_EMAIL | Dokploy API auth |
| DOKPLOY_ADMIN_PASSWORD | Dokploy API auth |
| CLOUDFLARE_API_TOKEN | DNS management |
| HETZNER_TOKEN | Hetzner Cloud API |
| TF_API_TOKEN | Terraform Cloud state |
| NPM_TOKEN | NPM publishing |
| NEXTNODE_APP_ID | GitHub App (cross-repo) |
| NEXTNODE_APP_PRIVATE_KEY | GitHub App key |

---

## Common Commands

### Terraform
```bash
cd ~/Development/Nextnode/infrastructure
terraform plan -var-file="secrets.auto.tfvars"
gh workflow run provision.yml -f action=plan
```

### NixOS
```bash
ssh root@admin-dokploy
nixos-rebuild switch --flake /etc/nixos#default
```

### Dokploy
```bash
ssh root@admin-dokploy
docker ps | grep dokploy
docker logs dokploy -f
docker restart dokploy
```

### Docker Swarm
```bash
ssh root@admin-dokploy
docker node ls
docker service ls
cat /data/swarm/worker-token
```

### Registry
```bash
ssh root@admin-dokploy
curl http://localhost:5000/v2/
docker logs registry
```

### Traefik
```bash
ssh root@admin-dokploy
cat /var/lib/traefik/acme.json | jq '.cloudflare.Certificates'
journalctl -u traefik -f
```

### Tailscale
```bash
tailscale status
tailscale ping admin-dokploy
```

---

## Troubleshooting

### Server Not Accessible
```bash
tailscale status
tailscale ping <server>
```

### NixOS Changes Not Reflected
**Cause**: Applied before image build completed.
**Solution**: Wait for Build Infrastructure Image workflow, run new plan, then apply.

### Dokploy Not Responding
```bash
ssh root@admin-dokploy
docker ps | grep dokploy
docker logs dokploy --tail 100
docker restart dokploy
```

### Swarm Issues
```bash
ssh root@admin-dokploy
docker node ls
journalctl -u swarm-setup -f
# Force rejoin
docker swarm leave --force
systemctl restart swarm-setup
```

### Registry Issues
```bash
ssh root@admin-dokploy
curl http://localhost:5000/v2/
docker logs registry
iptables -L -n | grep 5000
```

### Volume Issues
```bash
mountpoint -q /data && echo "Mounted" || echo "Not mounted"
systemctl status volume-ready
lsblk
```

### HTTPS Certificate Issues
```bash
ssh root@admin-dokploy
cat /var/lib/traefik/acme.json | jq
rm /var/lib/traefik/acme.json
systemctl restart traefik
```

### Deployment Failures
```bash
gh run list --workflow=app-deploy.yml
gh run view <run-id> --log
```

---

## dokploy.toml Configuration

Reference files:
- Defaults: `github-actions/config/dokploy-defaults.toml`
- Template: `github-actions/config/dokploy.example.toml`

### Server Mapping

| Server | Purpose |
|--------|---------|
| admin-dokploy | Traefik ingress, management |
| dev-worker | Development/PR deployments |
| prod-worker | Production workloads |
| custom | Use with `vps` field for dedicated VPS |

### VPS Auto-Provisioning

```toml
[vps]
enabled = true
type = "cpx21"

[environments.production]
server = "custom"  # Triggers VPS provisioning
```
