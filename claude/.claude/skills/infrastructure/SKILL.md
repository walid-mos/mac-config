---
name: infrastructure
description: NextNode infrastructure context and commands. Use when discussing servers, deployment, or infrastructure.
disable-model-invocation: true
allowed-tools: Read, Bash
---

# NextNode Infrastructure

Self-hosted deployment platform context.

## Overview

| Aspect | Value |
|--------|-------|
| Provider | Hetzner Cloud |
| OS | NixOS 24.11 (Flakes) |
| PaaS | Dokploy |
| Reverse Proxy | Traefik |
| VPN | Tailscale (all access) |
| DNS | Cloudflare (automated) |
| IaC | Terraform Cloud |

## Servers

| Server | Role | Cost |
|--------|------|------|
| admin-dokploy | Dokploy UI, Registry, Traefik | ~3.49/mo |
| dev-worker | Dev/PR deployments | ~3.49/mo |
| prod-worker | Production apps | ~5.49/mo |

**Access**: Tailscale only. No public SSH.

**SSH Key**: `~/.ssh/id_hetzner`
```bash
ssh -i ~/.ssh/id_hetzner root@prod-worker
ssh -i ~/.ssh/id_hetzner root@admin-dokploy
ssh -i ~/.ssh/id_hetzner root@dev-worker
```

## Repositories

### infrastructure (`~/Development/Nextnode/infrastructure/`)
```
terraform/    # Hetzner VPS provisioning
packer/       # NixOS image building
config/       # infrastructure.json (source of truth)
```

### github-actions (`~/Development/Nextnode/github-actions/`)
```
.github/workflows/   # 17 reusable workflows
actions/             # 34 composite actions
```

## URLs

| URL | Purpose |
|-----|---------|
| `admin.nextnode.fr` | Dokploy UI (Tailscale only) |
| `dev.nextnode.fr` | Dev apps (public) |
| `nextnode.fr` | Production (public) |

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
tailscale ping admin-dokploy
```

## Troubleshooting

### Server Not Accessible
```bash
tailscale status
tailscale ping <server>
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
```
