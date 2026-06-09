---
name: track
user-invocable: true
argument-hint: "[<milestone> | <milestone>.<track>]"
description: >-
  Stage the next track to ship by ingesting it from plan.json into the
  per-project progress.db, then hand off to /next. Use when the user runs
  `/track` (choose a milestone+track) or `/track M1.A` (stage one track
  directly). Companion to `/backlog` (producer of plan.json) and `/next` (ships
  tasks one at a time).
---

# track

`/track` is the **setup** half of the ship loop (the other is `/next`). It reads
the sink-agnostic `plan.json` produced by `/backlog`, lets the user pick one
**track** of one **milestone**, and **ingests** it into the project's
`progress.db` so `/next` can drain it one task per invocation.

## MUST / MUST NOT

| | |
|---|---|
| MUST | Read `docs/plans/<slug>/plan.json` and write only to `~/mizraj/<slug>/progress.db` |
| MUST | Verify `cockpit_db.sh` exists before calling it (Phase 5 guard) |
| MUST | Fail loud on any non-zero exit from `read_plan.py` or `cockpit_db.sh` |
| MUST | Surface `needs[]` parallelism — never declare a milestone "unblocked" on your own |
| MUST | Stop at the end of Phase 6; never begin implementing tasks |
| MUST NOT | Write to Linear — that is `/next`'s concern |
| MUST NOT | Fabricate a plan if `plan.json` is missing — point the user at `/backlog` |
| MUST NOT | Reset task status on re-ingest — idempotency is state-preserving |
| MUST NOT | Create or write any file other than the db (no `.tracks/`, no `progress.md`) |

## The single source of truth — `~/mizraj/<slug>/progress.db`

There is **one sqlite database per project**, at `~/mizraj/<slug>/progress.db`.
It holds the whole planning domain — milestones, tracks, and tasks (both flat
user tasks and track tasks) — **and** their execution state. The agent-cockpit
app and these skills are **independent co-clients** of that one file: neither
"needs" the other, and whichever opens it first creates it (idempotent schema,
versioned by `schema_meta`; a version mismatch is a loud refusal, never a silent
migration).

There is **no `.tracks/` folder, no `progress.md`, no `track.json`** — that
per-track file store is gone. All track state lives in the db. The db client is
`cockpit-db/cockpit_db.sh` (sqlite3 + canonical SQL — no Python in the DB
layer); `/track` uses it to ingest, `/next` to read and write task state.

See `model.md` for the full domain vocabulary (Milestone/Track/Task definitions,
identifier regex, and task state table).

---

## The input contract: `plan.json`

`/track` reads `docs/plans/<slug>/plan.json` at the **git root** of the target
repo, produced by `/backlog` (unchanged schema — see the `/backlog` skill).
`/track` never fetches Linear.

---

## Flow

### Phase 1 — Identify repo + slug

1. `git rev-parse --is-inside-work-tree` — if NOT a git repo, REFUSE and tell the user.
2. `git remote get-url origin` → slug = last path segment, strip `.git`,
   lowercased. No origin → slug = git root dir name. This **must match the app's
   slug** (same derivation), so both open the same `~/mizraj/<slug>/progress.db`.
   (`cockpit_db.sh` derives the slug itself from the git root you pass it.)

### Phase 2 — Locate the plan

`docs/plans/<slug>/plan.json` at the git root (`git rev-parse --show-toplevel`).
Missing → tell the user to run `/backlog` first, and STOP. Never invent a plan.

### Phase 3 — List milestones + tracks

```bash
python3 ~/.stow_repository/claude/.claude/skills/track/read_plan.py <plan.json>
```
Emits the milestone/track summary (counts, demo, first titles, each milestone's
`needs[]`). Also read which tracks are already **staged** (have tasks in the db)
and how many are still open:
```bash
bash ~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh list-open <git-root>
```
Print a 1-line summary per track, marking staged ones (`open/total`). Walking
skeleton (`skeleton: true`) first. **Surface the parallelism**: show the `needs`
edges so the operator can pick a parallel branch; never claim a milestone is
"unblocked" on your own.

### Phase 4 — Pick a track

- `$ARGUMENTS` is `M1` → if that milestone has exactly one track, use it;
  otherwise ask which track.
- `$ARGUMENTS` is `M1.A` → use it directly.
- Otherwise `AskUserQuestion` (load via `ToolSearch query="select:AskUserQuestion"`):
  - Question: `Quelle track on ship ?`
  - One option per open track. Label = `M{m}.{track} (X tasks)`. Description =
    the milestone `demo` string + first task title, truncated.
  - `multiSelect: false`.

### Phase 5 — Ingest the chosen track into progress.db

Guard before the first db call:
```bash
COCKPIT=~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh
test -f "$COCKPIT" || { echo "FATAL: cockpit_db.sh not found at $COCKPIT"; exit 1; }
```

```bash
bash ~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh \
  ingest-track <git-root> <plan.json> M{M} {track}
```
This upserts the full milestone/track skeleton + the `needs` DAG, then the chosen
track's tasks (status `backlog` on first insert). It is **idempotent and
state-preserving**: re-ingesting a track whose tasks are already `in_progress` /
`done` / `blocked` refreshes their structural fields (description, size,
`slice_of`, …) but **never** resets `status`, `commit_sha`, `blocked_reason`, or
`title` — `title` is seeded from the plan on first insert, then owned by the app
(the UI lets a user rename a task), so a rename survives re-ingest. So re-running
`/track M1.A` after `/backlog` re-emits the plan is safe.

A track is "staged" exactly when it has tasks in the db, so ingesting `M2.A`
**never touches** `M1.A` — tracks are parallel and independent, each its own rows
in the one file. There is no resume/overwrite question: ingestion is idempotent.

### Phase 6 — Hand off

Print a read-only rendering of the staged track, derived from the db (never a
rewritable file):
```bash
bash ~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh read-track <git-root> M{M} {track}
```
Then, in 4 short lines:
- `Project db: ~/mizraj/<slug>/progress.db`
- `Track: M{M}.{track} — {X} tasks (staged)`
- `Branch: {track.branch}` (the name to `wt {branch}` / `git checkout -b {branch}`
  for this track's PR — not a `/next` selector)
- `Next: /next M{M}.{track}` (ships this track's first task)

Then STOP.

---

## Rules

1. **`/track` reads plan.json and writes the db. It never writes Linear.** Any
   Linear sync is `/next`'s concern (tasks that carry a `sink_id`).
2. **The plan file is authored by `/backlog`.** If `plan.json` is missing, STOP
   and point the user at `/backlog`. Never fabricate a plan.
3. **State lives in `~/mizraj/<slug>/progress.db`, never in files.** No
   `.tracks/`, no `progress.md`, no `track.json` — that store is deleted.
   Ingestion is idempotent and state-preserving; staging one track never touches
   another. For a human glance outside the app, `read-track` prints a read-only
   rendering — never a rewritable file.
4. **Schema/plan mismatch = fail loud.** If `read_plan.py` or `cockpit_db.sh`
   exits non-zero (bad JSON, malformed plan, schema-version mismatch), surface
   the error — do not paper over a half-parsed plan or an incompatible db.
