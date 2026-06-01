---
name: backlog
user-invocable: true
argument-hint: "[path to interview bundle or plan file]"
description: >-
  Produce a versioned, sink-agnostic plan.json from a planning conversation, an
  /interview backlog-bundle, or a plan file. Decomposes the work into
  value-ordered milestones (M1 = walking skeleton), each cut into vertical I3/I4
  task slices grouped into parallel tracks (1 track = 1 PR), and writes
  docs/plans/<repo-slug>/plan.json for /track + /next to ship. No Linear push,
  no sink coupling. Load when turning a plan, design, audit, or resolved
  interview into an actionable backlog.
---

# backlog

`/backlog` is the **producer** of `plan.json` — the durable, sink-agnostic backlog
that `/track` stages and `/next` ships. It does ONE thing: turn a resolved plan
into a `plan.json` conforming to the contract `/track` reads. It **never pushes to
a sink**; sink entries (Linear issues, etc.) are created lazily by `/track`/`/next`
for the tasks that need them.

Doctrine + full rationale: `docs/notes/2026-05-29-workflow-phases-redesign.html`.
Consumers: `/track` (stages one track), `/next` (ships it task by task).

## The model — three axes, never conflated

- **Milestone (M1…Mn)** — a *demonstrable* increment, ordered by **visible value**,
  NOT by dependencies. `M1` is always the **walking skeleton**: the thinnest
  end-to-end path that touches every layer the plan introduces, **stubs everything
  not yet built**, and produces ONE observable behavior. Each later milestone
  *thickens* the skeleton and ends in its own demo.
- **Track (A, B, …)** — inside a milestone, a **sequential** chain of tasks that
  ships as **one PR**. Tracks of the same milestone are mutually independent →
  parallelizable.
- **Task** — one commit, calibrated **I3 or I4**. A vertical slice where possible.

The identifier `[M{m}.{track}-{step}]` (e.g. `[M1.A-01]`) is **derived by the
consumer**, never stored — so task titles carry **no prefix**.

## Input

Three shapes, in order of preference:

- **a. Interview bundle** (`backlog-bundle.json`) — canonical handoff from
  `/interview`. Carries `decisions[]` (six-field: fact / mechanism / edge /
  rejected / order / verification), `source.change_kind`, and — when the newer
  `/interview` produced it — a `demo_spine` (ordered list of observable
  behaviors). Detection: `$ARGUMENTS` ends in `backlog-bundle.json`, OR points at a
  `docs/interviews/<slug>/` folder containing one, OR (no `$ARGUMENTS`) the most
  recent `docs/interviews/*/backlog-bundle.json` touched this conversation. Refuse
  if `schema_version` is present and unknown.
- **b. Plan file** — any other path → `Read` it.
- **c. Conversation** — else use the planning thread already in context.

**Always explore the target repo before decomposing** — reuse beats duplicate
(read-before-write). If a decision can be confirmed in code, confirm it; never
encode a guess into a task.

The approach ("is this even the best way?") and the demo spine are `/interview`'s
job. `/backlog` **consumes** a resolved plan — it does not re-litigate the
approach. If the input still has open architectural ambiguity, STOP and send the
user back to `/interview`.

## Pipeline — Spine · Slice · Lane · Check

### 1. Spine — value-ordered milestones (the demo axis)

1. **Repo + slug.** `git rev-parse --is-inside-work-tree` (REFUSE if not a git
   repo). `git remote get-url origin` → slug = last path segment, strip `.git`
   (fallback: repo root dir name). This slug names the plan file **and must match
   `/track`'s derivation** — same repo, same slug.
2. **Name the walking skeleton.** M1 = the single thinnest end-to-end behavior that
   exercises every layer the plan introduces, with everything not-yet-built stubbed
   or hardcoded.
   - Bundle has `demo_spine` → M1 = its first entry; M2…Mn = the rest, in order.
   - No `demo_spine` → derive it: scan the decisions' `verification` fields for the
     end-to-end chain; M1 reproduces the shortest chain that touches every layer,
     stubbing the rest.
3. **Order milestones by demoable value, never by `Decision.order`.** Pull
   dependencies in just-in-time and stub what isn't built. Each milestone gets a
   one-sentence `demo` string a non-dev can read ("what works when this lands").
   Mark M1 `"skeleton": true`.
4. **Draw milestone edges — `needs`.** Milestones are *ordered* by value, but their
   real dependency is explicit: each milestone declares `needs` = the milestone ids
   whose behavior must already exist for its demo to be buildable. The skeleton `M1`
   has `needs: []`. A milestone that only thickens M1 in an **independent** subsystem
   declares `needs: ["M1"]` (NOT the immediately-preceding milestone) — that is what
   tells `/track` (and later agent-cockpit) it can ship in **parallel** with its
   siblings. `needs` is **required and explicit** — no implicit "depends on the
   previous one" default (greenfield: no hidden fallback). Refs point **backward
   only** (strictly lower milestone number); a forward or cyclic ref is a bug.
   - **Derive each edge from a concretely consumed artifact.** `M_k` needs `M_j` iff
     `M_k`'s *implementation* reads / extends / calls / overrides a behavior, schema,
     route, or module that `M_j` is the one to build. **Value-order is NOT
     dependency** — a milestone that merely ships *after* another does not `need` it.
   - **Anti-pattern — the lazy linear chain.** If `needs` comes out as a perfect spine
     (`M2→M1, M3→M2, M4→M3, …`), you almost certainly defaulted to value-order instead
     of deriving real edges → **STOP and re-derive**, asking per milestone: "which
     earlier demo's *code* does this one actually consume?". A public landing page does
     not `need` the auth system. Most real plans are a **branching** DAG, not a chain —
     a landing page hangs off the skeleton in parallel with the whole auth→billing spine.
   - **A dependency edge is not all-or-nothing — watch the thin integration edge.** A
     feature is usually *mostly* independent of the thing it eventually plugs into.
     BYOK is always per-account, yet the **bulk** of it (key encryption, provider
     abstraction, routing override) needs **no** accounts at all; only the thin
     "persist the key *for this user*" slice touches auth. Do **not** let that one
     wire-up make the **whole** milestone `need` another and serialize the 90 % that
     is independent. Re-slice: keep the account-independent bulk edge-free (ship it in
     parallel, or fold its layer into an earlier milestone that already owns it), and
     isolate the genuinely-dependent slice as a **tail task** (or push it into the
     milestone that owns the dependency). `needs` carries only the edges that
     survive *after* that re-slice — what the milestone truly cannot build without,
     never what its final integration point grazes.
5. **Hard reject — horizontal layers.** A milestone whose demo is "the persistence
   layer", "all the backend", "the types", "the IPC bindings" is a horizontal layer,
   not a demo. If you cannot phrase `demo` as an *observable behavior*, it is not a
   milestone — re-spine.

### 2. Slice — vertical I3/I4 tasks

1. Within each milestone, cut **vertical** tasks: each does a thin slice through the
   layers it needs, never a whole horizontal layer. **Never slice by file or
   module** — a task is one observable behavior cutting across whatever files it
   needs, *not* one file (or one layer) per task. **Smell test:** if consecutive
   task titles read like a tour of the codebase (`…in types` → `…validator` →
   `…compose` → `…env` → `…resolve-context`), or each task's WHERE is a single file
   in pipeline order, the milestone is **file-sliced** → re-slice vertically. A
   breaking change to a shared contract (type / signature / config section) sliced
   caller-by-caller is the canonical file-slice. The fix is **not** coexistence — it
   is **one atomic contract task**: change the contract and **every** consumer in the
   *same* commit, delete the legacy shape immediately. **No transient `optional`
   legacy, no compat branch, no migrate-then-drop chain** (greenfield: une seule
   voie). That atomic commit MAY exceed I4 (see the size band) — greenfield forbids
   splitting it across coexisting commits, so it is allowed to be one fat `I6`
   contract task. Peel off as separate tasks only the slices that are *genuinely
   independent* of the swap (a new behavior, never a repaired caller).
2. **Size band — every task is `I3` or `I4`.** (Estimate in difficulty on the engine
   scale, never in time.)
   - **`I6`+ → it is a slice, not a task.** Split it into a chain of I3/I4 (that
     chain usually becomes a track). A 700-line component is a track, not an issue.
   - **The one band exception — a greenfield contract-replacement task.** A breaking
     change to a shared contract cannot be greenfield AND green AND split (see §1):
     greenfield forbids coexistence, so the swap must be atomic, so it is **one**
     commit — a legitimate `I6` "contract" task. This is the ONLY allowed I6. If the
     atomic swap alone is bigger than one reviewable PR, the **milestone scope** is
     wrong → re-spine (split the milestone), never re-introduce coexistence to shrink
     the commit.
   - **`< I3` → never a standalone task.** "Install a dep", "fix the favicon",
     one-line config — fold it into the first I3/I4 task that needs it (vertical
     slice: "add the port allocator" *includes* installing its dependency).
3. **`slice_of`** — list the decision ids the task realizes (`["D2"]`). Every task
   slices ≥1 decision, OR is plumbing folded into a slice (see 4). No orphans.
4. **Plumbing folds in.** Logging, error/empty/loading states, config, validation
   ship *with* the slice that needs them — not as standalone ceremony tasks. A
   standalone plumbing task is allowed only when it is genuinely I3+ AND
   independently valuable (rare).
5. **`description`** (mandatory, self-contained): WHAT (one sentence) · WHY (links to
   the decision) · WHERE (file paths if known) · DONE WHEN (≤3 checkable bullets).
   **`done_when`** = the one-line acceptance summary.
6. **Titles** — short imperative, ONE artifact, no `and`/`et`/`+`/`puis`, **no
   prefix**. Concrete plurals (`tables`, `endpoints`, `methods`) or counts in a
   title are split markers — split per item.

### 3. Lane — parallel tracks

1. Within a milestone, draw the dependency edges between its tasks.
2. A **track** = a maximal **sequential chain** (A→B→C) shipping as **one PR**. Tasks
   joined by a dependency edge go in the same track, ordered by `step`.
3. Tasks with **no dependency edge AND no shared merge surface** (disjoint file sets)
   go in **separate tracks** → parallel PRs. The executor is **parallel agents in
   worktrees**, not one human working serially — an independent split ships
   concurrently, so it **pays for itself by default**. Never coalesce on the
   assumption that "nobody will parallelize it" or "the dev is solo / on a deadline":
   that assumption is false — agents do the work, and over-coalescing destroys the
   parallelism information the orchestrator needs. The planner's job is to **expose
   maximal safe parallelism**, not to pre-serialize it for a human.
4. **Coalesce only the coupled.** Merge two tracks into one **only** when they are
   genuinely coupled: they share a **merge surface** (edit the same files → would
   conflict as separate PRs) **or** a dependency edge chains them. Coupling — not
   size, not deadline, not "is it worth a human's time" — is the sole criterion. A
   lone independent I3 is its **own** track (an agent ships it in parallel), never
   folded "to save a PR". The only thing that forces tasks into one track is that
   shipping them separately would **conflict or violate an ordering**. Unsure whether
   two tasks are independent? Compare their file sets: disjoint ⇒ split, overlapping
   ⇒ coalesce.
5. Track ids: `A`, `B`, `C`… per milestone. `step`: 2-digit zero-padded numeric
   **string** (`"01"`), ordered within the track.
6. **`branch` — one per track.** Author a branch name `<type>/<slug>`:
   - `<type>` is a conventional-commit type the track's PR will carry — usually
     `feat` (a milestone is a demoable feature), but `fix` / `refactor` / `chore` /
     `perf` / `docs` / `test` / `build` / `ci` when that fits the track better.
   - `<slug>` is a **short, human kebab handle for what the track ships** (2–4 words):
     `feat/multi-service-skeleton`, `feat/landing-page`, `feat/stripe-checkout`,
     `feat/byok-providers`. **No milestone/track coordinate** (`m1`, `.a`, `-01`) — the
     coordinate lives only in the derived `[M1.A-01]` identifier, never in the branch.
   - **Unique across the plan** (two tracks never share a branch). It is the branch
     the user checks out / worktrees for that PR, and the chip `/html` renders to copy.
7. If a track balloons past what's reviewable as one PR, the milestone is too big —
   split the milestone, not the PR.

### 4. Check — coverage, band, contract

Run every check; any failure blocks the write (fail loud).

1. **Forward coverage** — every decision is `slice_of` ≥1 task. `uncovered =
   decisions − ⋃ slice_of`. Non-empty → STOP and list them (a decision with no task
   is dead rationale). *This is the only coverage check — no reverse machinery, no
   `atoms × 1.3`, no histogram.*
2. **Size band** — every task ∈ {I3, I4}. Any I6+ or standalone sub-I3 → fix first.
3. **INVEST-S+V + green-per-commit** — each task is independently shippable (Small)
   and valuable (Valuable), AND **leaves the suite green on its own commit**
   (typecheck + tests pass). A task that only compiles/passes once a *later* task
   lands is not shippable — it is a file-slice fragment, re-slice it into the
   vertical slice it belongs to. Hard reject any `done_when` that admits a red
   state ("broken on purpose", "callers fixed in tasks NN", "fixed later") **and**
   any that keeps the legacy shape alive past its own commit (`optional` legacy,
   compat branch, double-write, migrate-then-drop) — that is the coexistence the
   greenfield HARD RULE bans. The two rules reinforce each other: greenfield forces
   the breaking change to be **atomic** (one contract task), and an atomic commit is
   trivially green-per-commit. "install dep" alone, "change the type, callers
   repaired later", and "add the new shape next to the old one" all fail this.
4. **M1 is a walking skeleton** — its `demo` is one observable behavior, it touches
   every layer, it stubs the unbuilt. If M1's demo reads as a horizontal layer →
   re-spine.
5. **No phantom milestone** — a non-skeleton milestone must produce a demo that is
   **observably distinct from its neighbors**. Apply this *after* the Lane coalesce
   pass: if, once its tracks are coalesced, a milestone's `demo` is just a slice of
   an adjacent milestone's demo (or it carries only ~1–2 trivial tasks total), fold
   it into that neighbor and re-spine. The walking-skeleton M1 is **exempt** — it is
   allowed to be thin.
6. **Skill-ban** — drop any task whose WHERE points at `~/.claude/skills/...` or
   `~/.stow_repository/claude/.claude/skills/...`. Personal tooling lives in a
   separate repo (`mac-config`) and is never a deliverable.
7. **Write** `docs/plans/<slug>/plan.json` at the git root (`mkdir -p
   docs/plans/<slug>`). `sink_id: null` on every task (lazy sink). Compute `effort`
   = the engine-size roll-up of the whole plan (I3 … V12). Also write
   `docs/plans/<slug>/.gitignore` containing `.tracks/` so the spec (`plan.json`) is
   versioned but the **per-track** progress (`.tracks/M{M}.{track}/{progress.md,
   track.json}`) stays durable-on-disk and out of git history. The folder is the
   in-house tracker store — `/track` and `/next` work entirely from it (agent-cockpit
   will read the same folder later). Trackers are per-track and parallel; there is no
   single "active track" file.
8. **Validate the contract — reuse `/track`'s own validator, don't reimplement:**
   ```bash
   python3 ~/.stow_repository/claude/.claude/skills/track/read_plan.py docs/plans/<slug>/plan.json
   ```
   Exit non-zero → the structure is wrong (bad JSON, missing `milestones`, malformed
   `step`); fix and rewrite until it exits 0.

## Output schema

```json
{
  "effort": "V8",
  "milestones": [
    {
      "id": "M1",
      "demo": "Run agent → Claude Code spawn → output streamé (refs & diff stubbés)",
      "skeleton": true,
      "needs": [],
      "tracks": [
        { "id": "A", "branch": "feat/agent-spawn-stream", "tasks": [
          { "step": "01", "title": "Spawn process Claude Code", "size": "I4",
            "slice_of": ["D2"], "done_when": "un PID tourne, logs capturés",
            "description": "WHAT…\n\nWHY…\n\nWHERE…\n\nDONE WHEN…", "sink_id": null },
          { "step": "02", "title": "Stream stdout vers un event", "size": "I3",
            "slice_of": ["D2"], "done_when": "la pane reçoit les chunks",
            "description": "…", "sink_id": null }
        ]},
        { "id": "B", "branch": "feat/run-button-pane", "tasks": [
          { "step": "01", "title": "Bouton Run + pane vide", "size": "I3",
            "slice_of": ["D5"], "done_when": "clic → pane montée",
            "description": "…", "sink_id": null }
        ]}
      ]
    }
  ]
}
```

## Preview + hand off

Show a compact preview, then STOP — `/track` takes over:

- Per milestone: `M{n} [skeleton] — <demo> — tracks: A(x tasks · sizes) B(y) …`.
- Per track, its branch on its own line so it is copy-pasteable:
  `  M1.A → feat/agent-spawn-stream` · `M1.B → feat/run-button-pane`.
- Forward coverage line: `Decisions: N/N couvertes ✓` (or the uncovered list).
- `Effort: <V/I size>`.
- `Plan écrit: docs/plans/<slug>/plan.json`
- `→ /track` (ou `/track M1.A`) pour shipper la première track.

**No push, no detached worker, no Linear.** The plan file is the deliverable.

## Rules

1. **Output is a `plan.json` conforming to the `/track` contract — nothing else.**
   No push, no sink write, no Linear. Sink entries are created lazily downstream.
2. **Titles carry NO prefix.** The identifier `[M{m}.{track}-{step}]` is derived by
   `/track`/`/next`; storing it is a bug.
3. **Milestones are ordered by demoable VALUE, never by dependencies — but the
   dependencies are recorded.** M1 = walking skeleton. Every milestone carries an
   explicit `needs: [Mx, …]` (skeleton = `[]`, backward refs only); siblings sharing
   the same `needs` are parallelizable. A milestone whose demo is a horizontal layer
   is a bug.
4. **Every task is I3 or I4.** I6+ splits into a track; sub-I3 folds into its slice.
   Difficulty (engine scale), never time.
5. **One coverage check only: forward** (every decision → ≥1 task). No reverse
   coverage, no `atoms × 1.3`, no histogram, no plumbing-checklist ceremony.
6. **1 task = 1 commit · 1 track = 1 PR · 1 branch · 1 milestone = 1 demo.** Each
   track carries a `branch` = `<conventional-type>/<short-slug>`, no coordinate,
   unique across the plan.
7. **Never create a task that touches a Claude skill** (`~/.claude/skills/...`). Drop
   it.
8. **Validate with `read_plan.py` before declaring done** — fail loud on any schema
   mismatch.
9. **Approach + demo spine come from `/interview`.** `/backlog` consumes a resolved
   plan; it does not choose the approach. Open architectural ambiguity → back to
   `/interview`.
