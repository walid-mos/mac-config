---
allowed-tools: Read, Bash
description: NextNode infrastructure context and commands
---

# /infrastructure

NextNode self-hosted deployment platform context.

---

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

| Server | Type | Role | Cost |
|--------|------|------|------|
| admin-dokploy | cx23 | Dokploy UI, Registry, Traefik | ~3.49/mo |
| dev-worker | cx23 | Dev/PR deployments | ~3.49/mo |
| prod-worker | cx33 | Production apps | ~5.49/mo |

**Access**: All servers via Tailscale only. No public SSH.

**SSH Key:** Use `~/.ssh/id_hetzner`
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
│   ├── main.tf
│   ├── modules/
│   └── templates/
├── packer/             # NixOS image building
│   └── files/
├── config/             # infrastructure.json (source of truth)
└── .github/workflows/
```

### github-actions (`~/Development/Nextnode/github-actions/`)

```
github-actions/
├── .github/workflows/     # 17 reusable workflows
│   ├── quality-checks.yml
│   ├── release.yml
│   ├── dokploy-deploy.yml
│   ├── terraform-*.yml
│   └── dns.yml
└── actions/               # 34 composite actions (14 domains)
```

**Key Workflows:**
- `quality-checks.yml` - CI pipeline for all projects
- `dokploy-deploy.yml` - Deploy to Dokploy servers
- `dns.yml` - Cloudflare DNS + SSL automation
- `release.yml` - NPM package publishing

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
cd ~/Development/Nextnode/infrastructure
terraform plan -var-file="secrets.auto.tfvars"
gh workflow run terraform-apply.yml
```

### NixOS
```bash
ssh root@admin-dokploy
nixos-rebuild dry-build
nixos-rebuild switch --flake /etc/nixos#default
```

### Dokploy
```bash
ssh root@admin-dokploy
docker ps | grep dokploy
docker logs dokploy -f
docker restart dokploy
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
tailscale status --peers
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
| admin-dokploy (cx23) | ~3.49 |
| dev-worker (cx23) | ~3.49 |
| prod-worker (cx33) | ~5.49 |
| Volumes (50GB planned) | ~2.20 |
| **Current Total** | **~12.50/mo** |

---

## Troubleshooting

### Server Not Accessible
```bash
tailscale status
tailscale ping <server>
# Fallback: Hetzner console
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
cat /var/lib/traefik/acme.json | jq
rm /var/lib/traefik/acme.json
systemctl restart traefik
```

### Deployment Failures
```bash
gh run list --workflow=dokploy-deploy.yml
gh run view <run-id> --log
ssh root@admin-dokploy
docker logs dokploy --tail 200 | grep -i error
```

---

## Current Priorities (Jan 2026)

1. **Fix Duplicate Services Bug** - dokploy-sync creates new apps (INT-148)
2. **Self-Hosted Docker Registry** - admin-dokploy:5000 (INT-149-151)
3. **Persistent Storage** - Hetzner Volumes
4. **Dynamic VPS Provisioning** - via dokploy.toml
5. **NixOS Update Strategy** - rebuild vs replace modes
6. **Tailscale ACLs** - Tag-based access control
7. **Automated Backups** - Volume snapshots
