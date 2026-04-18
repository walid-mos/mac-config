---
name: hetzner
description: >-
  Hetzner Cloud server pricing reference. Verified prices for all cloud server
  lines (CX, CPX, CAX, CCX). Load BEFORE proposing ANY Hetzner infrastructure
  cost, sizing, or server recommendation. Never guess prices — always consult
  this skill first.
user-invocable: true
synced-at: 2026-04-15-hetzner-api-verified
---

# Hetzner Cloud Pricing

Verified pricing reference for Hetzner Cloud servers. **Always load this skill before proposing any Hetzner pricing or server recommendation.** Prior attempts to recall Hetzner prices from memory have been wrong every time — use only the values documented here.

## Last verified

**2026-04-15** — cross-checked against the live Hetzner Cloud API (`GET /v1/server_types`, `GET /v1/pricing`). All prices in **EUR, VAT excluded**, **European locations only** (fsn1 / nbg1 / hel1). US (`ash`, `hil`) and APAC (`sin`) datacenters exist with different prices — use the API, not the tables, when the user provisions outside EU. See [api.md](api.md).

## Arguments

- No argument: full pricing overview and selection guidance
- `shared`: shared vCPU lines only (CX, CPX, CAX)
- `dedicated`: dedicated vCPU line only (CCX)
- `recommend`: pick a server for a given workload

## Instructions

### Phase 1: Understand the question

1. Identify what the user is asking about:
   - A specific server line (CX / CPX / CAX / CCX)?
   - A target workload (small app, DB, CI/CD, game server, etc.)?
   - A budget constraint?
2. If the user asks for a price or sizing recommendation, **never answer from memory** — consult the tables in this skill.
3. If the user mentions a server name not documented here, tell them explicitly that it's not in the reference and point them to https://www.hetzner.com/cloud/ to verify.

### Phase 2: Provide the answer

- Pull numbers from [shared-vcpu.md](shared-vcpu.md) or [dedicated-vcpu.md](dedicated-vcpu.md)
- When recommending, use [selection-guide.md](selection-guide.md) to match workload → server
- Always quote: name, vCPU, RAM, SSD, traffic, hourly + monthly price
- Always mention **"VAT excluded"** when quoting prices

## Server Lines Overview

| Line | Type | Arch | CPU | Best for |
|---|---|---|---|---|
| **CX** | Shared vCPU | x86 | Intel / AMD | Most cost-efficient — small/medium web apps, dev/staging |
| **CPX** | Shared vCPU | x86 | AMD EPYC | Higher base clock — CPU-bound workloads, build servers |
| **CAX** | Shared vCPU | Arm64 | Ampere Altra | Best price/perf for ARM-compatible workloads |
| **CCX** | Dedicated vCPU | x86 | AMD EPYC | Production DBs, high-traffic apps, sustained high CPU |

## Quick Reference — Cheapest entry per line

| Line | Entry | vCPU | RAM | SSD | Traffic | €/mo | €/h |
|---|---|---|---|---|---|---|---|
| CX | CX23 | 2 | 4 GB | 40 GB | 20 TB | €3.99 | €0.006 |
| CAX | CAX11 | 2 | 4 GB | 40 GB | 20 TB | €4.49 | €0.007 |
| CPX | CPX22 | 2 | 4 GB | 80 GB | 20 TB | €7.99 | €0.013 |
| CCX | CCX13 | 2 | 8 GB | 80 GB | 20 TB | €15.99 | €0.026 |

See [shared-vcpu.md](shared-vcpu.md) and [dedicated-vcpu.md](dedicated-vcpu.md) for full tables, and [selection-guide.md](selection-guide.md) for workload matching. For live verification, deprecated-SKU checks, or non-EU pricing, see [api.md](api.md).

## Rules

1. **Never guess Hetzner prices** — if a number is not in this skill's tables, say so explicitly. Do not estimate, interpolate, round, or recall from elsewhere. Past attempts to remember prices have been wrong every time.
2. **Always load this skill before quoting** — if the user asks about Hetzner pricing, sizing, or costs, this skill MUST be consulted before any answer. Don't answer from context memory.
3. **Always quote EUR, VAT excluded** — all prices are in euros without VAT. State this explicitly. Do not convert to other currencies unless asked.
4. **Match workload to line, not just price** — CCX for dedicated-vCPU requirements (DBs, sustained CPU, SLA-bound). Never recommend a shared line when the user mentions "production DB", "sustained CPU", or "consistent performance".
5. **Prefer CAX when ARM-compatible** — Arm is cheapest per €/vCPU and €/GB RAM. Recommend it by default unless the workload has x86-only binaries (proprietary software, specific Docker images).
6. **Flag potentially stale pricing** — the `synced-at` field tracks the last verification date. If asked for pricing more than 3 months after that date, warn the user. Re-verify via the API ([api.md](api.md)) rather than browsing the website, whenever a token is available.
7. **Only cloud server prices are documented in tables** — tables cover CX/CPX/CAX/CCX only. For volumes, snapshots, backups, load balancers, floating IPs, traffic overage, or primary IPs, query `GET /v1/pricing` directly (see [api.md](api.md)). Never guess these.
8. **Don't invent missing SKUs — check the API first** — if the user mentions a server name not in the tables (e.g. `CX11`, `CPX11`, `CX22`), query `GET /v1/server_types` to check whether it's deprecated, renamed, or never existed. Only say "not in the reference" after the API confirms it.
9. **Tables are EU-only** — prices apply to `fsn1`, `nbg1`, `hel1`. If the user targets `ash`, `hil`, or `sin`, do NOT quote from the tables — fetch per-location prices via the API. US is ~25% above EU; `sin` runs ~2× EU and has 2 TB included traffic (not 20 TB).
10. **CPX v1 (cpx11–cpx51) is being phased out** — all EU + `sin` availability ends 2025-12-31; `cpx41/cpx51` are already gone everywhere; only `cpx11/21/31` linger at `ash`/`hil`. Never recommend CPX v1 for new projects — direct users to CPX v2 (`cpx12/22/32/42/52/62`) or CX v3.
