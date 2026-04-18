# Dedicated vCPU Line (CCX)

CCX servers have dedicated AMD EPYC cores — no CPU oversubscription. Use for workloads that need predictable, sustained performance: production databases, high-traffic apps, CPU-intensive batch jobs, and anything with SLA commitments.

All prices in **EUR, VAT excluded**. European locations (Germany / Finland). Verified **2026-04-10**.

## CCX — AMD EPYC dedicated vCPU (x86)

| Name | vCPU | RAM | SSD | Traffic | Price/h | Price/mo |
|---|---|---|---|---|---|---|
| CCX13 | 2 | 8 GB | 80 GB | 20 TB | €0.026 | €15.99 |
| CCX23 | 4 | 16 GB | 160 GB | 20 TB | €0.051 | €31.49 |
| CCX33 | 8 | 32 GB | 240 GB | 30 TB | €0.100 | €62.49 |
| CCX43 | 16 | 64 GB | 360 GB | 40 TB | €0.200 | €124.99 |
| CCX53 | 32 | 128 GB | 600 GB | 50 TB | €0.401 | €249.99 |
| CCX63 | 48 | 192 GB | 960 GB | 60 TB | €0.600 | €374.49 |

## When to use CCX

- Production databases (Postgres, MySQL, MongoDB) where p99 latency matters
- Sustained high CPU workloads (video encoding, ML inference, large builds)
- Applications with SLA commitments
- Any workload where "noisy neighbor" impact is unacceptable
- Game servers that require consistent per-tick CPU budget

## CCX vs shared — the decision rule

| Signal | Go CCX | Stay on shared (CX/CPX/CAX) |
|---|---|---|
| Average CPU > 30% sustained | ✓ | |
| p99 response time matters | ✓ | |
| Stateful production workload | ✓ | |
| Tolerant of occasional CPU variance | | ✓ |
| Dev / staging / burst workload | | ✓ |
| Budget-constrained MVP | | ✓ |

## €/vCPU comparison (dedicated)

| Name | vCPU | RAM | €/mo | €/vCPU/mo | €/GB RAM/mo |
|---|---|---|---|---|---|
| CCX13 | 2 | 8 GB | €15.99 | €8.00 | €2.00 |
| CCX23 | 4 | 16 GB | €31.49 | €7.87 | €1.97 |
| CCX33 | 8 | 32 GB | €62.49 | €7.81 | €1.95 |
| CCX43 | 16 | 64 GB | €124.99 | €7.81 | €1.95 |
| CCX53 | 32 | 128 GB | €249.99 | €7.81 | €1.95 |
| CCX63 | 48 | 192 GB | €374.49 | €7.80 | €1.95 |

CCX pricing is essentially linear at ~€7.80/vCPU/mo — no volume discount across sizes. Pick the size that matches your workload; stacking multiple CCX13 doesn't save money over one larger CCX.

## Notes

- Traffic allowance grows with server size (20 → 60 TB)
- Dedicated vCPU = one physical core per vCPU, not hyperthreaded half-cores
- CCX63 is currently the largest documented CCX SKU — larger dedicated needs may require Hetzner's dedicated server (AX/EX) lines, which are NOT in this skill
