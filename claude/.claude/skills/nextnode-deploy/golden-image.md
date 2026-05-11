# Golden Image Builder

TypeScript-based Hetzner snapshot builder. Replaces the previous Packer-based pipeline. Spins up a temporary VPS, installs Docker + the standard tools, snapshots the disk, and labels the snapshot with a deterministic fingerprint so the next provision either reuses it or rebuilds.

## Why a builder, not a base image

Hetzner doesn't host custom OS images you can `pull`. The only way to "ship a base image" is a snapshot inside your Hetzner project. The builder owns the lifecycle: build → snapshot → label → reuse → prune.

## CLI entry point

```bash
node src/index.ts build-golden-image
```

Standalone command - no `nextnode.toml`, no `PIPELINE_CONFIG_FILE`. Reads `HETZNER_API_TOKEN` from env and runs against the configured Hetzner project.

Triggered manually via `.github/workflows/build-golden-image.yml` (`workflow_dispatch`). Should run when the underlying base image SKU, Docker version pin, or init script changes.

## Architecture

| File | Layer | Responsibility |
|------|-------|---------------|
| `src/cli/hetzner/build-golden-image.command.ts` | CLI | Orchestrator: read env, call domain to compute fingerprint, call adapter to build, write summary |
| `src/domain/hetzner/golden-image.ts` | Domain | Pure fingerprint computation, label keys, label key/value contracts |
| `src/domain/hetzner/select-golden-image.ts` | Domain | Pick newest matching snapshot from a Hetzner image listing |
| `src/domain/hetzner/golden-image-summary.ts` | Domain | Build the GitHub Step Summary (Markdown) |
| `src/adapters/hetzner/provision/build-golden-image.ts` | Adapter | The actual build: spin up VPS, SSH-run install commands, snapshot, delete the VPS |
| `src/adapters/hetzner/constants.ts` | Adapter | `MAX_GOLDEN_IMAGE_SNAPSHOTS`, label keys (`managed_by`, `infra_fingerprint`) |

## Fingerprint

The fingerprint is a SHA256-derived string from a deterministic struct of "what would invalidate this image":

- Base Hetzner OS image SKU (e.g. `ubuntu-24.04`)
- Docker version pin
- Init script bytes (the literal SSH commands it runs)
- Any other config that affects the snapshot's contents

Computed in `domain/hetzner/golden-image.ts` - pure, testable. Two runs with identical inputs produce the same fingerprint; any change to the underlying recipe produces a new fingerprint and triggers a rebuild.

## Build flow

1. **Compute fingerprint** from current config.
2. **Look up existing snapshots** labeled `managed_by=golden-image` AND `infra_fingerprint=<hash>` - if a match exists, exit early with "reusing snapshot".
3. **Provision a builder VPS** - small SKU (cheap), public network, ephemeral SSH key.
4. **SSH in, run install commands** - Docker via convenience script, base packages, system tweaks.
5. **Snapshot the disk** via Hetzner API. Label the snapshot with `managed_by=golden-image` + `infra_fingerprint=<hash>` + a human-readable description.
6. **Delete the builder VPS** + the ephemeral SSH key.
7. **Prune old snapshots** beyond `MAX_GOLDEN_IMAGE_SNAPSHOTS` (oldest first), keeping the newest N.
8. **Write step summary** with snapshot ID, fingerprint, build time, prune count.

## Consumption (provision command)

When `provision` runs for a Hetzner VPS, it queries Hetzner for snapshots labeled `managed_by=golden-image` and picks the newest one via `selectGoldenImage()`. The VPS boots from that snapshot, skipping the Docker install in cloud-init (it's already baked).

If no golden image exists, provision fails fast with "run build-golden-image first" - it does NOT silently fall back to a slower install path.

## Recovery

`recover` (standalone command) rebuilds the local hcloud-state in R2 by walking Hetzner labels - useful when the state bucket is corrupt or a snapshot was rotated out of band. It does NOT rebuild the snapshot itself.

## Rules

1. **Fingerprint is the cache key** - never tag-based. A semver bump is meaningless; what matters is whether the recipe changed bit-for-bit.
2. **Manual trigger only** - golden-image builds are not chained off normal deploys. They're rare (recipe changes), expensive (provision a VPS, snapshot, delete), and need explicit operator awareness.
3. **Builder VPSs are ephemeral** - the build adapter MUST delete the VPS + ephemeral key on success AND on failure (cleanup is non-negotiable; orphan VPSs cost money).
4. **Snapshot pruning is automatic** - the builder enforces `MAX_GOLDEN_IMAGE_SNAPSHOTS`. Don't manually delete snapshots; let the builder handle rotation.
5. **No fallback path in provision** - missing golden image = hard failure with a clear message, NOT a silent install. Forces operators to keep the snapshot fresh and avoids "this VPS booted differently than the last one" drift.
