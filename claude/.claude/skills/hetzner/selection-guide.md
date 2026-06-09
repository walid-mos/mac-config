# Selection Guide - Pick the Right Hetzner Server

How to match a workload to a Hetzner Cloud server line and size.

All prices EUR, VAT excluded. Verified 2026-04-15.

## Decision tree

1. **Does the workload need dedicated CPU?**
   - Production DB, sustained high CPU, SLA-bound, p99 sensitive → **CCX line** (see CCX table in [pricing-tables.md](pricing-tables.md))
   - Most web apps, dev, staging, CI runners → continue to step 2

2. **Are the binaries x86-only?**
   - Yes (proprietary software, specific Docker images, Windows VMs) → **CX or CPX**
   - No (Go, Rust, modern Node, Python, standard containers) → **CAX (cheapest by €/vCPU)**

3. **x86 shared - CX or CPX?**
   - Budget-first, regular web app → **CX** (Intel/AMD, cheapest)
   - CPU-bound (builds, compilation, image/video processing) → **CPX** (AMD EPYC, higher base clock)

## Common workloads → recommended server

| Workload | Recommended | Monthly cost |
|---|---|---|
| Personal blog / static site proxy | CX23 | €3.99 |
| Small SaaS MVP | CAX11 or CX23 | €3.99–4.49 |
| Dev / staging environment | CX23 or CX33 | €3.99–6.49 |
| Node.js/Go app + small DB (same box) | CAX21 or CX33 | €6.49–7.99 |
| Self-hosted tool (Gitea, Outline, etc.) | CX33 or CAX21 | €6.49–7.99 |
| CI/CD runner | CPX32 | €13.99 |
| Production Postgres (small) | CCX13 | €15.99 |
| Production Postgres (medium) | CCX23 | €31.49 |
| Production Postgres (large) | CCX33 | €62.49 |
| High-traffic web app (front) | CCX23 → CCX33 | €31.49–62.49 |
| Video encoding / ML inference | CCX33+ | €62.49+ |
| Game server (sustained CPU) | CCX13 / CCX23 | €15.99+ |
| Kubernetes worker (burstable) | CPX32 / CPX42 | €13.99–25.49 |
| Kubernetes worker (steady) | CCX23 / CCX33 | €31.49–62.49 |

## Sizing principles

1. **Start smaller than you think** - Hetzner lets you resize upward. Don't over-provision on day one.
2. **Resize up when RAM headroom < 15%** - that's the practical trigger, not CPU.
3. **Disk is sticky** - when you resize up, disk grows with the plan but cannot shrink. Plan accordingly.
4. **Scale out past CCX43** - when a single CCX43 (16 vCPU / 64 GB) is saturated, add a second server before jumping to CCX53. Scaling out is cheaper and gives HA.
5. **Use Volumes for growing data** - local SSD is bundled with the server; use Hetzner Volumes (not priced here) when data outgrows it.
6. **Arm first for new projects** - if the stack supports Arm (most modern stacks do), default to CAX for 30–50% savings vs CX/CPX at equivalent specs.

## Anti-patterns to flag

- Recommending **CX/CPX/CAX for a production database** - use CCX instead. Shared vCPU can degrade DB p99 latency unpredictably.
- Recommending **CCX for a low-traffic web app** - overkill, wastes 3–4x the budget. Start on CX or CAX.
- Assuming **CX = CPX** - CPX costs ~2x more per €/vCPU and delivers higher raw performance; not interchangeable on price.
- Recommending **x86 (CX/CPX) when CAX would work** - leaves 30%+ savings on the table for no reason on modern stacks.
- Treating **RAM as the primary scaling axis on CCX** - CCX is priced for dedicated CPU; if you only need more RAM, a shared line is more efficient.
