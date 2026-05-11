---
name: hetzner
description: >-
  Hetzner Cloud server pricing reference. Verified prices for all cloud server
  lines (CX, CPX, CAX, CCX). Load BEFORE proposing ANY Hetzner infrastructure
  cost, sizing, or server recommendation. Never guess prices - always consult
  this skill first.
user-invocable: true
synced-at: 2026-04-15-hetzner-api-verified
---

# Hetzner Cloud Pricing

Verified pricing reference for Hetzner Cloud servers. **Always load this skill before proposing any Hetzner pricing or server recommendation.** Prior attempts to recall Hetzner prices from memory have been wrong every time - use only the values documented here.

## Last verified

**2026-04-15** - cross-checked against the live Hetzner Cloud API (`GET /v1/server_types`, `GET /v1/pricing`). All prices in **EUR, VAT excluded**, **European locations only** (fsn1 / nbg1 / hel1). US (`ash`, `hil`) and APAC (`sin`) datacenters exist with different prices - use the API, not the tables, when the user provisions outside EU. See [api.md](api.md).

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
2. If the user asks for a price or sizing recommendation, **never answer from memory** - consult the tables in this skill.
3. If the user mentions a server name not documented here, tell them explicitly that it's not in the reference and point them to https://www.hetzner.com/cloud/ to verify.

### Phase 2: Provide the answer

- Pull numbers from [shared-vcpu.md](shared-vcpu.md) or [dedicated-vcpu.md](dedicated-vcpu.md)
- When recommending, use [selection-guide.md](selection-guide.md) to match workload → server
- Always quote: name, vCPU, RAM, SSD, traffic, hourly + monthly price
- Always mention **"VAT excluded"** when quoting prices

## Server Lines Overview

| Line | Type | Arch | CPU | Best for |
|---|---|---|---|---|
| **CX** | Shared vCPU | x86 | Intel / AMD | Most cost-efficient - small/medium web apps, dev/staging |
| **CPX** | Shared vCPU | x86 | AMD EPYC | Higher base clock - CPU-bound workloads, build servers |
| **CAX** | Shared vCPU | Arm64 | Ampere Altra | Best price/perf for ARM-compatible workloads |
| **CCX** | Dedicated vCPU | x86 | AMD EPYC | Production DBs, high-traffic apps, sustained high CPU |

## Quick Reference - Cheapest entry per line

| Line | Entry | vCPU | RAM | SSD | Traffic | €/mo | €/h |
|---|---|---|---|---|---|---|---|
| CX | CX23 | 2 | 4 GB | 40 GB | 20 TB | €3.99 | €0.006 |
| CAX | CAX11 | 2 | 4 GB | 40 GB | 20 TB | €4.49 | €0.007 |
| CPX | CPX22 | 2 | 4 GB | 80 GB | 20 TB | €7.99 | €0.013 |
| CCX | CCX13 | 2 | 8 GB | 80 GB | 20 TB | €15.99 | €0.026 |

See [shared-vcpu.md](shared-vcpu.md) and [dedicated-vcpu.md](dedicated-vcpu.md) for full tables, and [selection-guide.md](selection-guide.md) for workload matching. For live verification, deprecated-SKU checks, or non-EU pricing, see [api.md](api.md).

## Rules

1. **Never guess Hetzner prices** - if a number is not in this skill's tables, say so explicitly. Past attempts to remember prices have been wrong every time. Always load this skill before quoting and consult tables, not memory.
2. **Always quote EUR, VAT excluded** - state this explicitly. Do not convert currencies unless asked.
3. **Match workload to line, not just price** - CCX for dedicated-vCPU requirements (DBs, sustained CPU, SLA-bound). Prefer CAX when ARM-compatible (cheapest per €/vCPU and €/GB RAM).
4. **Only cloud server prices are in tables** - for volumes, snapshots, backups, LBs, floating IPs, traffic overage, primary IPs, query `GET /v1/pricing` (see [api.md](api.md)). Don't invent missing SKUs - check `GET /v1/server_types` first.
5. **Flag potentially stale pricing** - `synced-at` tracks the last verification date. If asked >3 months after that, warn and re-verify via API.
6. **Tables are EU-only** - prices apply to `fsn1`, `nbg1`, `hel1`. For `ash`, `hil`, or `sin`, fetch per-location prices via the API. `sin` has 2 TB included traffic, not 20 TB.
7. **CPX v1 (cpx11–cpx51) is being phased out** - all EU + `sin` availability ends 2025-12-31; `cpx41/cpx51` are already gone everywhere. Never recommend CPX v1 for new projects - direct users to CPX v2 (`cpx12/22/32/42/52/62`) or CX v3.
