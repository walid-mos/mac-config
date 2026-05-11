# Shared vCPU Lines (CX, CPX, CAX)

Shared vCPU servers run on multi-tenant hosts. Best price/performance for workloads that don't need sustained 100% CPU.

All prices in **EUR, VAT excluded**. European locations (Germany / Finland). Verified **2026-04-10**.

## CX - Intel/AMD shared vCPU (x86)

Most cost-efficient line. Intel or AMD processors depending on availability.

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CX23 | 2 | 4 GB | 40 GB | 20 TB | €0.006 | €3.99 |
| CX33 | 4 | 8 GB | 80 GB | 20 TB | €0.010 | €6.49 |
| CX43 | 8 | 16 GB | 160 GB | 20 TB | €0.019 | €11.99 |
| CX53 | 16 | 32 GB | 320 GB | 20 TB | €0.036 | €22.49 |

## CPX - AMD EPYC shared vCPU (x86)

Higher base clock speeds, AMD EPYC processors. Better for CPU-bound workloads than CX.

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CPX22 | 2 | 4 GB | 80 GB | 20 TB | €0.013 | €7.99 |
| CPX32 | 4 | 8 GB | 160 GB | 20 TB | €0.022 | €13.99 |
| CPX42 | 8 | 16 GB | 320 GB | 20 TB | €0.041 | €25.49 |
| CPX52 | 12 | 24 GB | 480 GB | 20 TB | €0.059 | €36.49 |
| CPX62 | 16 | 32 GB | 640 GB | 20 TB | €0.081 | €50.49 |

## CAX - Ampere Altra shared vCPU (Arm64)

Arm-based. Best price/performance ratio for ARM-compatible workloads.

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CAX11 | 2 | 4 GB | 40 GB | 20 TB | €0.007 | €4.49 |
| CAX21 | 4 | 8 GB | 80 GB | 20 TB | €0.013 | €7.99 |
| CAX31 | 8 | 16 GB | 160 GB | 20 TB | €0.026 | €15.99 |
| CAX41 | 16 | 32 GB | 320 GB | 20 TB | €0.051 | €31.49 |

## Price per vCPU / GB RAM comparison (entry models)

| Line | Entry | €/mo | €/vCPU/mo | €/GB RAM/mo |
|---|---|---|---|---|
| CX | CX23 | €3.99 | €2.00 | €1.00 |
| CAX | CAX11 | €4.49 | €2.25 | €1.12 |
| CPX | CPX22 | €7.99 | €4.00 | €2.00 |

**Conclusion**: CX is the absolute cheapest per resource unit. CAX is almost as cheap but Arm-only. CPX costs ~2x more but delivers higher per-vCPU performance (AMD EPYC base clock).

## Notes

- All shared-vCPU servers include 20 TB of traffic per month
- Traffic overages and exact rates are NOT in this skill - check the Hetzner website
- Storage is bundled with the plan; you cannot add extra local SSD (use Volumes separately)
- Dual-stack (IPv4 + IPv6) is included; IPv4-only and IPv6-only options exist with different pricing (not documented here)
