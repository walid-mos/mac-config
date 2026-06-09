---
name: hetzner
description: >-
  Hetzner Cloud server pricing reference. Verified prices for all cloud server
  lines (CX, CPX, CAX, CCX). Load before any Hetzner infrastructure cost,
  sizing, or server recommendation.
user-invocable: true
synced-at: 2026-04-15-hetzner-api-verified
---

# Hetzner Cloud Pricing

Verified pricing reference for Hetzner Cloud servers. All prices in **EUR, VAT excluded**, **European locations only** (fsn1 / nbg1 / hel1). Last cross-checked against the live Hetzner Cloud API (`GET /v1/server_types`, `GET /v1/pricing`) on **2026-04-15**. US (`ash`, `hil`) and APAC (`sin`) datacenters exist with different prices - use the API for non-EU. See [api.md](api.md).

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|---|---|
| Quote a Hetzner price from memory | Consult the tables below or [pricing-tables.md](pricing-tables.md) |
| Recommend CPX v1 SKUs (cpx11–cpx51) | Use CPX v2 (CPX22–CPX62) or CX v3 |
| Quote prices without VAT status | Always state "VAT excluded" |
| Use EU table prices for ash / hil / sin | Fetch per-location prices via the API |
| Invent a missing SKU | Tell the user it's not documented; point to [api.md](api.md) |
| Quote pricing for volumes / LBs / IPs from memory | Use `GET /v1/pricing` - only server prices are in tables |
| Recommend shared vCPU for production databases | Use CCX instead |
| Recommend CCX for a low-traffic web app | Use CX or CAX |

## Instructions

### Phase 1: Understand the question

1. Identify what the user is asking about:
   - A specific server line (CX / CPX / CAX / CCX)?
   - A target workload (small app, DB, CI/CD, game server, etc.)?
   - A budget constraint?
2. If the user asks for a price or sizing recommendation, **never answer from memory** - consult the tables in this skill.
3. If the user mentions a server name not documented here, tell them explicitly that it's not in the reference and point them to https://www.hetzner.com/cloud/ to verify.

### Phase 2: Provide the answer

- Pull numbers from [pricing-tables.md](pricing-tables.md) (shared CX/CPX/CAX and dedicated CCX in one file)
- When recommending, use [selection-guide.md](selection-guide.md) to match workload → server
- Always quote: name, vCPU, RAM, SSD, traffic, hourly + monthly price
- Always mention **"VAT excluded"** when quoting prices

## Quick Reference - Cheapest entry per line

| Line | Entry | vCPU | RAM | SSD | Traffic | €/mo | €/h |
|---|---|---|---|---|---|---|---|
| CX | CX23 | 2 | 4 GB | 40 GB | 20 TB | €3.99 | €0.006 |
| CAX | CAX11 | 2 | 4 GB | 40 GB | 20 TB | €4.49 | €0.007 |
| CPX | CPX22 | 2 | 4 GB | 80 GB | 20 TB | €7.99 | €0.013 |
| CCX | CCX13 | 2 | 8 GB | 80 GB | 20 TB | €15.99 | €0.026 |

See [pricing-tables.md](pricing-tables.md) for full tables (shared + dedicated) and [selection-guide.md](selection-guide.md) for workload matching. For live verification, deprecated-SKU checks, or non-EU pricing, see [api.md](api.md).

## Rules

1. **Never guess Hetzner prices** - if a number is not in this skill's tables, say so explicitly. Past attempts to remember prices have been wrong every time. Always load this skill before quoting and consult tables, not memory.
2. **Always quote EUR, VAT excluded** - state this explicitly. Do not convert currencies unless asked.
3. **Match workload to line, not just price** - CCX for dedicated-vCPU requirements (DBs, sustained CPU, SLA-bound). Prefer CAX when ARM-compatible (cheapest per €/vCPU and €/GB RAM).
4. **Only cloud server prices are in tables** - for volumes, snapshots, backups, LBs, floating IPs, traffic overage, primary IPs, query `GET /v1/pricing` (see [api.md](api.md)). Don't invent missing SKUs - check `GET /v1/server_types` first.
5. **Flag potentially stale pricing** - `synced-at` tracks the last verification date. If asked >3 months after that, warn and re-verify via API.
6. **Tables are EU-only** - prices apply to `fsn1`, `nbg1`, `hel1`. For `ash`, `hil`, or `sin`, fetch per-location prices via the API. `sin` has 2 TB included traffic, not 20 TB.
7. **CPX v1 (cpx11–cpx51) was discontinued on 2025-12-31** - all SKUs are gone from EU + `sin`; `cpx41/cpx51` were removed first. Never recommend any CPX v1 SKU - direct users to CPX v2 (`cpx22/32/42/52/62`) or CX v3.
