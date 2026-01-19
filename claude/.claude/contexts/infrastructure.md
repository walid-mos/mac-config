# NextNode Infrastructure

Self-hosted deployment platform for NextNode Solutions.

## Overview

| Aspect | Value |
|--------|-------|
| **Provider** | Hetzner Cloud |
| **OS** | NixOS 24.11 (Flakes) |
| **PaaS** | Dokploy v0.25.11 |
| **Reverse Proxy** | Traefik v3.6.1 |
| **VPN** | Tailscale (all access) |
| **DNS** | Cloudflare (automated) |
| **IaC** | Terraform Cloud |
| **Images** | Packer + nixos-infect |
| **CI/CD** | GitHub Actions (centralized) |

---

## Servers

| Server | Type | Role | Tailscale IP | Cost |
|--------|------|------|--------------|------|
| admin-dokploy | cx23 | Dokploy UI, Registry, Traefik | 100.x.x.x | ~€3.49 |
| dev-worker | cx23 | Dev/PR deployments | 100.x.x.x | ~€3.49 |
| prod-worker | cx33 | Production apps | 100.x.x.x | ~€5.49 |
| **Total** | | | | **~€12.50/mo** |

**Access**: All servers via Tailscale only. No public SSH.

**SSH Key:** Use `~/.ssh/id_hetzner` (not default key)
```bash
ssh -i ~/.ssh/id_hetzner root@prod-worker
ssh -i ~/.ssh/id_hetzner root@admin-dokploy
ssh -i ~/.ssh/id_hetzner root@dev-worker
```

---

## Repositories

### infrastructure (`~/Development/Nextnode/infrastructure/`)

```
infrastructure/
├── terraform/           # Hetzner VPS provisioning
│   ├── main.tf         # Dynamic server creation
│   ├── modules/        # hetzner-vps, app-vps
│   └── templates/      # cloud-init.yaml
├── packer/             # NixOS image building
│   └── files/          # NixOS Flake + modules
│       └── modules/    # docker, dokploy, traefik, tailscale, ssh
├── config/             # infrastructure.json (server definitions)
└── .github/workflows/  # terraform-plan, terraform-apply, packer-build
```

**Key Files:**
- `config/infrastructure.json` - Server definitions (source of truth)
- `terraform/main.tf` - VPS provisioning logic
- `packer/files/configuration.nix` - Main NixOS config
- `packer/files/modules/*.nix` - Service modules

### github-actions (`~/Development/Nextnode/github-actions/`)

```
github-actions/
├── .github/workflows/     # 17 reusable workflows
│   ├── quality-checks.yml # Lint, test, typecheck, build
│   ├── release.yml        # NPM publishing
│   ├── dokploy-deploy.yml # Dokploy deployments
│   ├── terraform-*.yml    # Infrastructure provisioning
│   └── dns.yml            # Cloudflare DNS automation
└── actions/               # 34 composite actions (14 domains)
    ├── build/             # install, build-project, smart-cache
    ├── quality/           # lint, typecheck, security-audit
    ├── deploy/            # vps-provision, dokploy-sync
    ├── release/           # changesets-*, npm-provenance
    ├── infrastructure/    # cloudflare-dns, tailscale-cleanup
    └── utilities/         # validate-tokens, config-loader
```

**Key Workflows:**
- `quality-checks.yml` - CI pipeline for all projects
- `dokploy-deploy.yml` - Deploy to Dokploy servers
- `dns.yml` - Cloudflare DNS + SSL automation
- `release.yml` - NPM package publishing

---

## Current Priorities (Jan 2026)

From the active evolution plan:

### Phase 1: Fix Duplicate Services Bug
- `dokploy-sync` creates new apps instead of updating existing
- Fix: Change from `application.all` to `project.one` lookup
- Linear: INT-148

### Phase 2: Self-Hosted Docker Registry
- Registry on admin-dokploy:5000 (Tailscale only)
- Registry-only mode (no Dokploy builds from source)
- New: `docker-build-push` action
- Linear: INT-149, INT-150, INT-151

### Phase 3: Persistent Storage
- Hetzner Volumes (50GB -> €2.20/mo)
- NixOS volume mounting with symlinks
- Data survives VPS rebuilds

### Phase 4: Dynamic VPS Provisioning
- Projects can request custom VPS via `dokploy.toml`
- `vps-provision` action handles Terraform automatically

### Phase 5: NixOS Update Strategy
- Rebuild mode: `nixos-rebuild switch` (config changes)
- Replace mode: Terraform destroy/create (major upgrades)

### Phase 6: Tailscale ACLs
- Tag-based access control
- Optional: Remove public IPs from workers

### Phase 7: Automated Backups
- Volume snapshots (daily cron)
- Dokploy SQLite backup

---

## URLs & Access

| URL | Purpose | Access |
|-----|---------|--------|
| `admin.nextnode.fr` | Dokploy UI | Tailscale only |
| `dev.nextnode.fr` | Dev apps | Public (via Traefik) |
| `nextnode.fr` | Production | Public (via Traefik) |

---

## Common Commands

### Terraform

```bash
# From infrastructure repo
cd ~/Development/Nextnode/infrastructure

# Plan changes
terraform plan -var-file="secrets.auto.tfvars"

# Apply (via GitHub Actions preferred)
gh workflow run terraform-apply.yml
```

### NixOS

```bash
# SSH to server (via Tailscale)
ssh root@admin-dokploy

# Check NixOS config
nixos-rebuild dry-build

# Apply changes
nixos-rebuild switch --flake /etc/nixos#default
```

### Dokploy

```bash
# Check Dokploy status
ssh root@admin-dokploy
docker ps | grep dokploy

# View logs
docker logs dokploy -f

# Restart Dokploy
docker restart dokploy
```

### Traefik

```bash
# Check certificates
ssh root@admin-dokploy
cat /var/lib/traefik/acme.json | jq '.cloudflare.Certificates'

# View Traefik logs
journalctl -u traefik -f
```

### Tailscale

```bash
# Check status
tailscale status

# List devices
tailscale status --peers

# Debug connectivity
tailscale ping admin-dokploy
```

---

## Secrets (GitHub Actions)

| Secret | Purpose | Required By |
|--------|---------|-------------|
| `HCLOUD_TOKEN` | Hetzner API | terraform-*, packer-* |
| `TAILSCALE_AUTH_KEY` | VPN auth | terraform-apply |
| `CF_API_TOKEN` | Cloudflare DNS | dns, terraform-apply |
| `DOKPLOY_TOKEN` | Dokploy API | dokploy-deploy |
| `NPM_TOKEN` | NPM publishing | release |
| `TF_API_TOKEN` | Terraform Cloud | terraform-* |

---

## Cost Breakdown

| Resource | Monthly Cost |
|----------|-------------|
| admin-dokploy (cx23) | ~€3.49 |
| dev-worker (cx23) | ~€3.49 |
| prod-worker (cx33) | ~€5.49 |
| Volumes (50GB planned) | ~€2.20 |
| **Current Total** | **~€12.50** |
| **With Volumes** | **~€14.70** |

---

## Troubleshooting

### Server Not Accessible

```bash
# Check Tailscale
tailscale status
tailscale ping <server>

# Check server via Hetzner console
# (fallback if Tailscale down)
```

### Dokploy Not Responding

```bash
ssh root@admin-dokploy
docker ps | grep dokploy
docker logs dokploy --tail 100
docker restart dokploy
```

### HTTPS Certificate Issues

```bash
ssh root@admin-dokploy
# Check ACME storage
cat /var/lib/traefik/acme.json | jq

# Force renewal
rm /var/lib/traefik/acme.json
systemctl restart traefik
```

### Deployment Failures

```bash
# Check GitHub Actions logs
gh run list --workflow=dokploy-deploy.yml
gh run view <run-id> --log

# Check Dokploy logs
ssh root@admin-dokploy
docker logs dokploy --tail 200 | grep -i error
```

---

## Related Contexts

- @~/.claude/contexts/nextnode.md - NextNode packages overview
- @~/.claude/guidelines/agents.md - Agent design patterns
