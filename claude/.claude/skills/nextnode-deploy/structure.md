# `@nextnode-solutions/infrastructure` — code layout

Three-layer architecture. Layer rules are STRICT and enforced in `packages/infrastructure/CLAUDE.md`.

## Layers

```
src/
  cli/         # entry points, CLI commands, argv parsing
  domain/      # pure logic. NO IO, NO env, NO logger
  adapters/    # IO boundary (cloudflare/, hetzner/, r2/, github/, build-output/)
  config/      # nextnode.toml schema + loader (see config.md)
```

### Rules

1. **`domain/` is pure** — no `fetch`, no `process.env`, no logger, no FS. Pure functions only. Decision logic lives here so it's trivially testable.
2. **`adapters/` never make business decisions** — they execute what `domain/` decided. One adapter per provider (`adapters/hetzner/`, `adapters/cloudflare/`).
3. **`cli/` orchestrates** — reads config, calls domain for decisions, hands decisions to adapters for IO, prints summaries.

Imports flow inward: `cli` → `domain` AND `adapters`; `adapters` → `domain`; `domain` → nothing else in this package.

## Where to find what

Use `ls` / `find` for the current file map — it drifts. The full rules and architectural justification are in `packages/infrastructure/CLAUDE.md`.

Cross-cutting sub-skills:
- `config.md` — `nextnode.toml` schema and loader
- `deploy-env.md` — `DeployEnv`, `TargetEnv`, `DeployInput`, env merge order
- `r2-service.md` — provider-agnostic services layer (currently R2 only)
- `golden-image.md` — Hetzner golden image fingerprint + cache key
- `pipeline.md` — quality matrix, prod-gate, publish-result
- `hetzner-vps.md` — internal vs public mode, Caddy, firewall
- `hetzner-caller.md` — what a caller repo provides (Dockerfile, compose, workflows)
