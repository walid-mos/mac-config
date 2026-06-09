---
name: backlog
user-invocable: true
argument-hint: "[interview bundle | plan file | --straighten]"
description: >-
  Produce a versioned, sink-agnostic plan.json from a planning conversation,
  /interview backlog-bundle, or plan file. Decomposes work into value-ordered
  milestones (M1 = walking skeleton), vertical I3/I4 task slices, and parallel
  tracks (1 track = 1 PR). Writes docs/plans/<repo-slug>/plan.json for /track
  + /next. Load when turning a resolved plan or interview into an actionable
  backlog.
---

# backlog

`/backlog` is the **producer** of `plan.json` — the durable, sink-agnostic backlog
that `/track` stages and `/next` ships. It does ONE thing: turn a resolved plan
into a `plan.json` conforming to the contract `/track` reads. It **never pushes to
a sink**; sink entries (Linear issues, etc.) are created lazily by `/track`/`/next`
for the tasks that need them.

Consumers: `/track` (stages one track), `/next` (ships it task by task).

---

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Push to any sink (Linear, etc.) | Write exactly one file: `docs/plans/<slug>/plan.json` |
| Time estimates — difficulty (engine scale) only | Run the completeness-critic subagent before declaring done |
| Re-litigate the approach from `/interview` | Validate with `read_plan.py` before declaring done |
| Slice by file or module | Slice vertically — one observable behavior per task |
| Coexistence / compat / fallback code in tasks | Greenfield only — one atomic contract task per breaking change |
| Create a task touching `~/.claude/skills/...` | Every surface from Enumerate maps to ≥1 task |
| Time estimate in any field | `done_when` is observable; never admits a red/broken state |

---

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
user back to `/interview`. Likewise a decision **too thin to enumerate any surface**
(empty `edge` *and* `verification`, no real `mechanism`) is unresolved at the grain
`/backlog` needs — send it back too (the Enumerate source-quality gate below).

## Pipeline — Spine · Enumerate · Slice · Lane · Check

### 1. Spine — value-ordered milestones (the demo axis)

1. **Repo + slug.** `git rev-parse --is-inside-work-tree` (REFUSE if not a git
   repo). `git remote get-url origin` → slug = last path segment, strip `.git`
   (fallback: repo root dir name). This slug names the plan file **and must match
   `/track`'s derivation** — same repo, same slug.
2. **Name the walking skeleton.** M1 = the single thinnest end-to-end behavior that
   exercises every layer the plan introduces, with everything not-yet-built stubbed
   or hardcoded.
   - Bundle has `demo_spine` → M1 = its first entry; verify it describes a thin
     end-to-end behavior, not a rich feature. If the first entry is a fully-featured
     demo, re-derive a thinner skeleton and treat the rest as later milestones.
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
   previous one" default. Refs point **backward only** (strictly lower milestone
   number); a forward or cyclic ref is a bug.
   - **Derive each edge from a concretely consumed artifact.** `M_k` needs `M_j` iff
     `M_k`'s *implementation* reads / extends / calls / overrides a behavior, schema,
     route, or module that `M_j` is the one to build. **Value-order is NOT
     dependency** — a milestone that merely ships *after* another does not `need` it.

   Common traps when drawing milestone edges → see [anti-patterns.md](anti-patterns.md).

5. **Hard reject — horizontal layers.** A milestone whose demo is "the persistence
   layer", "all the backend", "the types", "the IPC bindings" is a horizontal layer,
   not a demo. If you cannot phrase `demo` as an *observable behavior*, it is not a
   milestone — re-spine.

### 2. Enumerate — the surfaces each decision implies (the completeness axis)

A decision is **not** an atom — it is a bag of **surfaces**. Before slicing, expand
every decision into an explicit, **named** list of the surfaces it implies, drawn
from its six fields (`fact` / `mechanism` / `edge` / `rejected` / `order` /
`verification`). A surface is one concrete addressable thing: an entity, a
route/endpoint, a state, a role, an error/edge path, a config key, an integration
point, an observable behavior from `verification`. The `edge` and `verification`
fields are gold — they are *literally* the surfaces a lazy slice skips.

1. **List, don't count.** For each decision `Dk`, emit `surfaces(Dk)` = a list of
   short **named** handles (`créer-clé`, `révoquer-clé`, `edge:quota-dépassé`,
   `verify:routing-OK`), never a number. **Every concrete plural or count in the
   source is a split marker** — `mechanism` says "endpoints" → one surface per
   endpoint; `edge` lists three cases → three surfaces. (This is the Slice plural
   rule pulled *upstream*: plurals seed surfaces, they are not discovered after the
   fact.)
2. **Source-quality gate — fail loud.** A decision whose six fields yield **no**
   enumerable surface (vacuous `edge` *and* `verification`, a one-liner with no real
   `mechanism`) is **too thin to slice deep** — backlog depth is capped by decision
   richness (garbage in / garbage out). STOP and send that decision back to
   `/interview` to thicken it; never invent surfaces to paper over a thin decision.
3. `surfaces[]` is **working state** — the input to the coverage check and the
   completeness-critic in the Check phase. It is NOT emitted into `plan.json`, which
   still stores only `slice_of` decision ids.

### 3. Slice — vertical I3/I4 tasks

**The unit of coverage is the *surface*, not the decision.** Slice each decision
until **every** surface in its `surfaces[]` (from the Enumerate phase) is realized
by a task. **Anti-pattern — one task per decision.** A decision carrying N
enumerated surfaces but a single `slice_of:["Dk"]` task is **under-sliced**: it
ticks the decision on paper and skips the rest. This is the twin, on the *depth*
axis, of §1.4's "lazy linear chain" — one task per decision is the smell, never the
target. Fold sibling surfaces into one task only when they genuinely ship in the
same atomic commit; otherwise split.

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
   Track, as working state (not emitted into `plan.json`), **which surfaces** each
   task covers — that surface→task map is exactly what the coverage check and the
   completeness-critic diff against `surfaces[]`.
4. **Plumbing folds in.** Logging, error/empty/loading states, config, validation
   ship *with* the slice that needs them — not as standalone ceremony tasks. A
   standalone plumbing task is allowed only when it is genuinely I3+ AND
   independently valuable (rare).
5. **`description`** (mandatory, self-contained): WHAT (one sentence) · WHY (links to
   the decision) · WHERE (file paths if known) · DONE WHEN (≤3 checkable bullets).
   **`done_when`** = the one-line acceptance summary; never admits a red/broken state.
   Infrastructure/plumbing tasks with no directly observable user behavior: typecheck
   + tests green qualifies only when the task itself adds tests exercising its
   contract.
6. **Titles** — short imperative, ONE artifact, no `and`/`et`/`+`/`puis`, **no
   prefix**. Concrete plurals (`tables`, `endpoints`, `methods`) or counts in a
   title are split markers — split per item.

### 4. Lane — parallel tracks

1. Within a milestone, draw the dependency edges between its tasks.
2. A **track** = a maximal **sequential chain** (A→B→C) shipping as **one PR**. Tasks
   joined by a dependency edge go in the same track, ordered by `step`.
3. Tasks with **no dependency edge AND no shared merge surface** (disjoint file sets)
   go in **separate tracks** → parallel PRs. Expose maximal safe parallelism — never
   pre-serialize it.

   Rationale and coalescing traps → see [anti-patterns.md](anti-patterns.md).

4. **Coalesce only the coupled.** Merge two tracks into one **only** when they are
   genuinely coupled: they share a **merge surface** (edit the same files → would
   conflict as separate PRs) **or** a dependency edge chains them. Coupling — not
   size, not deadline — is the sole criterion. Unsure whether two tasks are
   independent? Compare their file sets: disjoint ⇒ split, overlapping ⇒ coalesce.
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

### 5. Check — coverage, band, contract

Run every check; any failure blocks the write (fail loud).

1. **Element coverage — every *surface* maps to a task, not just every decision.**
   The unit is the surface from the Enumerate phase. `uncovered = ⋃ surfaces(Dk) −
   ⋃ surfaces-covered-by-tasks`. Non-empty → STOP, re-slice the **named** surfaces,
   recompute. Decision-level forward coverage is the weak floor this subsumes: a
   decision with zero tasks is still dead rationale, but a decision with one task
   and four orphaned surfaces now **fails** where forward coverage passed (that is
   the lazy task this check exists to kill).
   - **Compute it with an independent critic, never self-audit.** The pass that
     wrote the tasks carries an "I'm done" bias and will rubber-stamp its own
     output. Spawn a **subagent** (`Explore`, read-only) that re-derives `surfaces[]`
     from the *source decisions* from scratch — blind to the produced tasks — then
     diffs its surface list against the tasks' covered surfaces and returns
     `uncovered[]` plus any **redundant** task (two tasks on the same surface with no
     distinct reason). This is **extraction-then-match**, NOT the old `atoms × 1.3`
     multiplier: that was a number-vs-number ratio — gameable (pad the count with
     filler) and blind (never said *which* surface was missing). A set diff over
     **named** surfaces is diagnostic and non-gameable — the completeness-detector
     pattern. Loop re-slice → re-critic until `uncovered[]` is empty, or every
     remaining gap is an explicit, justified fold.
   - **Minimum decisions guard.** If the resolved input contains fewer than 2
     enumerable decisions, the plan is under-specified — surface coverage will
     trivially pass with almost any task. STOP and send the user back to `/interview`
     to flesh out the spec before continuing.
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
6. **Skill-ban** — drop any task whose WHERE points at `~/.claude/skills/...` or any
   skills directory path. Personal tooling lives in a separate repo (`mac-config`)
   and is never a deliverable.
7. **Write** `docs/plans/<slug>/plan.json` at the git root (`mkdir -p
   docs/plans/<slug>`). `sink_id: null` on every task (lazy sink). Compute `effort`
   = the engine-size roll-up of the whole plan (I3 … V12). The committed `plan.json`
   is the **only** file `/backlog` produces — there is no `.tracks/` folder, no
   `progress.md`, no `track.json`. Execution state lives in the **per-project
   database** `~/mizraj/<slug>/progress.db` (outside the repo): `/track` ingests a
   chosen track into it, `/next` drains it, and the agent-cockpit app is a co-client
   of the same file. `plan.json` is the durable, versioned **spec**; the db is the
   durable, out-of-repo **state**. Nothing to gitignore.
8. **Validate the contract before showing the preview — reuse `/track`'s own
   validator, don't reimplement.** Locate it relative to this skills directory:
   ```bash
   SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
   python3 "$SKILLS_DIR/track/read_plan.py" docs/plans/<slug>/plan.json
   ```
   If `$BASH_SOURCE` is unavailable (e.g. running as a model tool call), locate via
   the git root: `$(git rev-parse --show-toplevel)` then find
   `.claude/skills/track/read_plan.py` from there, or adjust to your stow path.
   Run this **before** showing the preview. Exit non-zero → the structure is wrong
   (bad JSON, missing `milestones`, malformed `step`); fix and rewrite until it exits
   0. Do not show the preview until the validator exits 0.

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

**Run the validator (Check §8) first. Only show the preview after it exits 0.**

Show a compact preview, then STOP — `/track` takes over:

- Per milestone: `M{n} [skeleton] — <demo> — tracks: A(x tasks · sizes) B(y) …`.
- Per track, its branch on its own line so it is copy-pasteable:
  `  M1.A → feat/agent-spawn-stream` · `M1.B → feat/run-button-pane`.
- Forward coverage line: `Decisions: N/N couvertes ✓` (or the uncovered list).
- `Effort: <V/I size>`.
- `Plan écrit: docs/plans/<slug>/plan.json`
- `→ /track` (ou `/track M1.A`) pour shipper la première track.

**No push, no detached worker, no Linear.** The plan file is the deliverable.

## Straighten mode — fold ad-hoc tasks into the plan

When an agent (or you) has piled up **extra ad-hoc tasks** outside the pipeline —
mid-execution additions, a brain-dump list, loose "we should also…" items — do NOT
rubber-stamp them into the db. Ad-hoc tasks are the **worst** offenders for
laziness: each is usually one coarse line ("add a settings page") hiding a fistful
of surfaces. Straightening = running them through the **same** Enumerate → Slice →
element-coverage-critic discipline as a fresh plan, then merging the result into
`plan.json` so `/track` registers it in `progress.db` the normal way.

**Trigger:** `$ARGUMENTS` is `--straighten` (the raw tasks follow, live in the
conversation, or in a file you point at), or the user says "straighten / redresse
ces tâches / enregistre-les proprement".

1. **Read before write.** Load the existing `docs/plans/<slug>/plan.json` (the spec)
   and explore the repo. Every ad-hoc task lands in an existing milestone+track or
   justifies a **new** track — it never floats free.
2. **Each ad-hoc task is a mini-spec, not a finished task.** Reverse-engineer the
   decision(s) it realizes, then **Enumerate its surfaces** (same gate: a one-liner
   with no enumerable surface is too thin — ask the user to clarify, never invent).
   "Add a settings page" expands into its real surfaces (render, each field,
   persistence, validation, empty/error states, the verification).
3. **Slice** each into I3/I4 vertical tasks and **assign** to the right track (by
   merge-surface / dependency — the same Lane rules). Genuinely independent work →
   its own track + `branch`.
4. **Run the element-coverage critic** over the merged set, exactly as for a fresh
   plan. Straightened tasks meet the identical bar — no lazy pass because "they were
   just quick adds".
5. **Merge into `plan.json`**, then validate with `read_plan.py` and hand off to
   `/track M{m}.{track}` (idempotent + state-preserving: already-shipped tasks keep
   their status).

**Boundaries (fail loud, greenfield):**
- The skill writes the **plan** (the spec) and lets `/track` register it in the db.
  It does **not** write flat `origin='user'` rows — those are the agent-cockpit
  app's domain. New scope belongs in `plan.json`, never in a parallel ad-hoc store.
- **Never renumber or delete an existing track/task** to make ad-hoc work fit:
  append with new `step` numbers (preserve every existing `[M{m}.{track}-{step}]`
  identifier) or open a new track. Renumbering an already-ingested track orphans its
  db rows.
