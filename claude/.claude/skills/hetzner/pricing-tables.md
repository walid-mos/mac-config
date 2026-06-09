# Hetzner pricing tables

All prices in **EUR, VAT excluded**. European locations (`fsn1` / `nbg1` / `hel1`). Verified **2026-04-15**.

For non-EU prices, deprecated SKU checks, or live verification, query the Hetzner Cloud API - see [api.md](api.md).

## Shared vCPU (CX, CPX, CAX)

Shared vCPU servers run on multi-tenant hosts. Best price/performance for workloads that don't need sustained 100% CPU.

### CX - Intel/AMD shared vCPU (x86)

Most cost-efficient line. Intel or AMD processors depending on availability.

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CX23 | 2 | 4 GB | 40 GB | 20 TB | €0.006 | €3.99 |
| CX33 | 4 | 8 GB | 80 GB | 20 TB | €0.010 | €6.49 |
| CX43 | 8 | 16 GB | 160 GB | 20 TB | €0.019 | €11.99 |
| CX53 | 16 | 32 GB | 320 GB | 20 TB | €0.036 | €22.49 |

### CPX - AMD EPYC shared vCPU (x86)

Higher base clock speeds, AMD EPYC processors. Better for CPU-bound workloads than CX.

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CPX22 | 2 | 4 GB | 80 GB | 20 TB | €0.013 | €7.99 |
| CPX32 | 4 | 8 GB | 160 GB | 20 TB | €0.022 | €13.99 |
| CPX42 | 8 | 16 GB | 320 GB | 20 TB | €0.041 | €25.49 |
| CPX52 | 12 | 24 GB | 480 GB | 20 TB | €0.059 | €36.49 |
| CPX62 | 16 | 32 GB | 640 GB | 20 TB | €0.081 | €50.49 |

### CAX - Ampere Altra shared vCPU (Arm64)

Arm-based. Best price/performance ratio for ARM-compatible workloads.

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CAX11 | 2 | 4 GB | 40 GB | 20 TB | €0.007 | €4.49 |
| CAX21 | 4 | 8 GB | 80 GB | 20 TB | €0.013 | €7.99 |
| CAX31 | 8 | 16 GB | 160 GB | 20 TB | €0.026 | €15.99 |
| CAX41 | 16 | 32 GB | 320 GB | 20 TB | €0.051 | €31.49 |

### When to use shared

- CX: cheapest per resource unit - small/medium web apps, dev/staging
- CAX: almost as cheap as CX but Arm-only - prefer when workload is ARM-compatible (best €/vCPU and €/GB RAM after CX)
- CPX: ~2x more than CX, but higher per-vCPU performance (AMD EPYC base clock) - CPU-bound workloads, build servers

### Notes

- All shared-vCPU servers include 20 TB of traffic per month
- Traffic overages and exact rates are NOT in this skill - use `GET /v1/pricing` (see [api.md](api.md))
- Storage is bundled with the plan; you cannot add extra local SSD (use Volumes separately)
- Dual-stack (IPv4 + IPv6) is included; IPv4-only and IPv6-only options exist with different pricing (not documented here)

---

## Dedicated vCPU (CCX)

CCX servers have dedicated AMD EPYC cores - no CPU oversubscription. Use for workloads that need predictable, sustained performance: production databases, high-traffic apps, CPU-intensive batch jobs, and anything with SLA commitments.

### CCX - AMD EPYC dedicated vCPU (x86)

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CCX13 | 2 | 8 GB | 80 GB | 20 TB | €0.026 | €15.99 |
| CCX23 | 4 | 16 GB | 160 GB | 20 TB | €0.051 | €31.49 |
| CCX33 | 8 | 32 GB | 240 GB | 30 TB | €0.100 | €62.49 |
| CCX43 | 16 | 64 GB | 360 GB | 40 TB | €0.200 | €124.99 |
| CCX53 | 32 | 128 GB | 600 GB | 50 TB | €0.401 | €249.99 |
| CCX63 | 48 | 192 GB | 960 GB | 60 TB | €0.600 | €374.49 |

### When to use CCX

- Production databases (Postgres, MySQL, MongoDB) where p99 latency matters
- Sustained high CPU workloads (video encoding, ML inference, large builds)
- Applications with SLA commitments
- Any workload where "noisy neighbor" impact is unacceptable
- Game servers that require consistent per-tick CPU budget

### CCX vs shared - the decision rule

| Signal | Go CCX | Stay on shared (CX/CPX/CAX) |
|---|---|---|
| Average CPU > 30% sustained | yes | |
| p99 response time matters | yes | |
| Stateful production workload | yes | |
| Tolerant of occasional CPU variance | | yes |
| Dev / staging / burst workload | | yes |
| Budget-constrained MVP | | yes |

### Notes

- Traffic allowance grows with server size (20 -> 60 TB)
- Dedicated vCPU = one physical core per vCPU, not hyperthreaded half-cores
- CCX63 is currently the largest documented CCX SKU - larger dedicated needs may require Hetzner's dedicated server (AX/EX) lines, which are NOT in this skill
- CCX pricing is roughly linear at ~€7.80/vCPU/mo - no volume discount; pick the size matching your workload
