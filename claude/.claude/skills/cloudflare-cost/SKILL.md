---
name: cloudflare-cost
user-invocable: true
description: >-
  Cost-safety judgment for any Cloudflare Workers project — the pitfalls that
  silently inflate the bill and the mandated practice for each. MUST be loaded
  whenever writing, reviewing, or deploying code that touches Cloudflare:
  a wrangler.toml/wrangler.jsonc in the repo, a nextnode.toml declaring a
  Cloudflare (Workers or Pages) target, @cloudflare/* or wrangler in
  package.json, or code using Workers, Pages Functions, KV, R2, D1, Durable
  Objects, Queues, Workers AI, Vectorize, Hyperdrive, or the Cache API. Also
  load on /cloudflare-cost or when the user asks about Cloudflare billing,
  Workers cost, or "why is my Cloudflare bill high".
---

# Cloudflare — Cost Safety Rules

Apply to ALL code and config that runs on or bills through Cloudflare. Cloudflare has **no hard spend cap** on Workers — a bug or an attack bills without limit, and a budget notification only *notifies*, it never *cuts*. So cost safety is structural, enforced in code and config, not by alerts. Each rule below is a pitfall that makes you pay more than expected + the practice that removes it.

Full reasoning and prices live in the Brain course `[[Cloudflare — coûts]]`; this file carries only what to *do*.

## The one mental model — what is billed, and when

A request is billed **the moment it enters the Worker** (invocation). Everything upstream is free. Consequences that drive every decision:

- **Kill abuse at the WAF, never in the Worker.** A request blocked by WAF / rate-limiting rules / bot management never reaches the Worker → 0 € billed. The same request filtered by your code is *already billed*. Anti-abuse logic belongs in WAF config, not `index.ts`.
- **Wall-clock is free; only CPU time is billed.** `await fetch(slow)` costs ~nothing during the wait. Cost = computation (parsing, crypto, loops), not I/O waiting. Don't "optimize" away awaits; optimize away CPU.
- **Egress is free.** Unlike AWS. Cost lives in operations, storage, and request count — never in bandwidth. Serving large assets from R2/Workers is cheap by design.

## RULE 1 — Cap every invocation in `wrangler`

Without caps, one buggy invocation (infinite loop, runaway recursion, a Worker that `fetch`es itself, unbounded fan-out) bills up to the default 30 s of CPU and thousands of subrequests. Set explicit ceilings matched to the real workload:

```toml
[limits]
cpu_ms = 50          # default 30000; a request that trips it dies with Error 1102
subrequests = 10     # default 10000 (paid); bounds fan-out and self-recursion
```

Raise only with a concrete reason. `waitUntil()` work runs after the response but **its CPU is billed in the same invocation** — count it against the cap, don't treat background work as free.

## RULE 2 — Never write to KV or D1 on the hot path

Price asymmetry is the trap: **KV write = 10× a read**; **D1 write = 1000× a read** (and `list` in KV is billed as a write). A per-request write is the worst pattern — plus KV enforces a hard **1 write/s per key**.

- KV is read-heavy / write-rarely. Cache reads; batch or debounce writes; never `list` in a hot path (use deterministic keys or D1).
- Writing per request to record state/analytics → aggregate in memory and flush, or use a different store.

## RULE 3 — Index every D1 filter; never full-scan

D1 bills **rows scanned, not rows returned**. `WHERE non_indexed_col` on a big table scans (and bills) the whole table. Add an index on every column used in `WHERE`/`JOIN`, `SELECT` explicit columns (not `*`), and `LIMIT`. Counter-weight: each index adds one written row per write on that column — index for the filters you actually run, not speculatively.

## RULE 4 — Durable Objects: always hibernate, never heartbeat

DOs bill **wall-clock while loaded in memory** (GB-s), not CPU. An idle-but-unhibernatable object bills 24/7 (~$32/mo per always-on GB-object). Two mandates:

- **WebSockets:** use `state.acceptWebSocket(ws)`, never `ws.accept()`. The former allows hibernation (duration stops accruing while clients stay connected); the latter bills for the whole time the socket is open. Persist state across eviction with `serializeAttachment` / `deserializeAttachment`. Use the SQLite backend, not KV.
- **No self-rescheduling alarms / `setInterval` heartbeats.** They wake the object every tick → it never becomes hibernation-eligible → permanent duration + one write per `setAlarm`. If you think you need a heartbeat, you're designing an always-billed object.

## RULE 5 — Queues need a Dead Letter Queue

Every retry re-bills a read, per message, per 64 KB. A poison message with no DLQ retries forever = unbounded cost. Always set `max_retries` and a `dead_letter_queue`, and ack messages individually so one failure doesn't replay the whole batch:

```toml
[[queues.consumers]]
queue = "..."
max_retries = 3
dead_letter_queue = "dlq"
```

## RULE 6 — Observability is a billing surface; sample it

`console.log` and `writeDataPoint()` on every request at volume can become your **largest** line item (1000 req/s × a few logs ≈ thousands of $/mo). Log errors + sampled traffic, not every request; filter/sample Logpush **before** it ships; keep Tail Workers minimal (they bill by CPU). Set log level per environment.

## RULE 7 — Cache before you compute, resize, or call a model

The cheapest euro is the one never spent. The Cache API (`cache.put/match`) is **free** — use it to avoid re-fetching origin, re-running CPU, re-calling an LLM, or re-transforming an image.

- **Workers AI:** ~×80 between smallest and largest model, output ~×8 input. Route to the smallest model that suffices; cache deterministic responses and embeddings (never re-embed the same text).
- **Images:** each unique dimension combo is a billed transformation. Serve a fixed set of presets; don't resize to arbitrary dynamic sizes.
- **R2:** egress is free, but each multipart `UploadPart` and each `ListObjects` is a Class A op (~$4.50/M). Don't split uploads too finely; don't list in a loop; set lifecycle rules to purge abandoned multiparts and old versions.

## RULE 8 — Put the guardrails upstream, in the platform

Because the Worker bills on entry, defend before it:

- **WAF custom rules + rate-limiting rules + bot management** are the primary anti-cost defense (blocked = unbilled). The in-code Rate Limit binding (`env.RL.limit`) runs *inside* the Worker (already billed) — use it to protect origin/DB/LLM subrequests, not to save the invocation. Key it on a stable id (user/tenant), not IP.
- **Pages Functions bill as Workers requests.** Match only dynamic routes; don't invoke a Function on static-asset paths (static assets are free).
- **LLM calls:** route through **AI Gateway** to get the only native hard spend cap on the platform.

## Pre-ship checklist

- [ ] `limits.cpu_ms` and `limits.subrequests` set to real ceilings, not defaults.
- [ ] No KV/D1 write per request; no KV `list` on the hot path.
- [ ] Every D1 `WHERE`/`JOIN` column indexed; no `SELECT *` full scans.
- [ ] DO WebSockets use `state.acceptWebSocket`; no heartbeat alarms.
- [ ] Every Queue consumer has `max_retries` + a DLQ.
- [ ] Logs/analytics sampled, not per-request; Logpush filtered before send.
- [ ] Cache/preset layer in front of LLM calls, image resizes, expensive fetches.
- [ ] Anti-abuse enforced at the WAF, not in Worker code; LLM spend via AI Gateway.
