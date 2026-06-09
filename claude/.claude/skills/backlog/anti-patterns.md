# backlog — common traps

## Spine §4: the lazy linear chain

If `needs` comes out as a perfect spine (`M2→M1, M3→M2, M4→M3, …`), you almost
certainly defaulted to value-order instead of deriving real edges. **STOP and
re-derive**, asking per milestone: "which earlier demo's *code* does this one
actually consume?". A public landing page does not `need` the auth system. Most
real plans are a **branching** DAG, not a chain — a landing page hangs off the
skeleton in parallel with the whole auth→billing spine.

## Spine §4: the thin integration edge

A feature is usually *mostly* independent of the thing it eventually plugs into.
BYOK is always per-account, yet the **bulk** of it (key encryption, provider
abstraction, routing override) needs **no** accounts at all; only the thin
"persist the key *for this user*" slice touches auth. Do **not** let that one
wire-up make the **whole** milestone `need` another and serialize the 90 % that is
independent. Re-slice: keep the account-independent bulk edge-free (ship it in
parallel, or fold its layer into an earlier milestone that already owns it), and
isolate the genuinely-dependent slice as a **tail task** (or push it into the
milestone that owns the dependency). `needs` carries only the edges that survive
*after* that re-slice — what the milestone truly cannot build without, never what
its final integration point grazes.

## Lane §§3-4: over-coalescing tracks

Tasks with no dependency edge AND no shared merge surface go in **separate tracks**
— parallel PRs. The executor is parallel agents in worktrees, not one human working
serially — an independent split ships concurrently, so it pays for itself by
default. Never coalesce on the assumption that "nobody will parallelize it" or "the
dev is solo / on a deadline": that assumption is false — agents do the work, and
over-coalescing destroys the parallelism information the orchestrator needs. A lone
independent I3 is its **own** track (an agent ships it in parallel), never folded
"to save a PR". The planner's job is to **expose maximal safe parallelism**, not to
pre-serialize it for a human.
