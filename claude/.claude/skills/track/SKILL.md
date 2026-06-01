---
name: track
user-invocable: true
argument-hint: "[<milestone> | <milestone>.<track>]"
description: >-
  Pick the next track to ship from a versioned plan.json and stage it for
  /next. Use when the user runs `/track` (choose a milestone+track, write a
  scratch checklist) or `/track M1.A` (jump straight to one track). Companion
  to `/backlog` (producer of plan.json) and `/next` (ships the track's tasks
  one at a time). A track is a sequential chain of tasks that becomes ONE PR.
---

# track

`/track` is the **setup** half of the ship loop (the other is `/next`). It reads
the sink-agnostic `plan.json` produced by `/backlog`, lets the user pick one
**track** of one **milestone**, and stages a scratch checklist that `/next`
then drains one task per invocation.

**Model** (see `docs/notes/2026-05-29-workflow-phases-redesign.html`):
- **Milestone** — a demonstrable increment, ordered by visible value. `M1` is
  the walking skeleton.
- **Track** — a sequential chain of tasks inside a milestone that ships as ONE
  PR. Tracks of the same milestone are independent → parallelizable.
- **Task** — one commit, calibrated I3/I4. The grain `/next` executes.

The derived identifier `[M{milestone}.{track}-{step}]` (e.g. `[M1.A-01]`)
encodes both axes; regex `\[M(\d+)\.([A-Z]+)-(\d+)\]`.

### Plan checkbox states

`progress.md` uses these states for each task line:

| Marker        | Meaning                                                                        |
|---------------|--------------------------------------------------------------------------------|
| `[ ]`         | Not started.                                                                   |
| `[ ] ⚠ ... - <reason>` | Blocked. Skipped by `/next` until unblocked.                          |
| `[~]`         | Implemented (working-tree changes only — NOT committed, NOT pushed); awaiting user validation. If the task carries a `sink_id`, Linear is **In Progress**. |
| `[x]`         | User validated the dev on the previous `/next`; commit was created + pushed. If the task carries a `sink_id`, Linear is **Done + archived**. |

`/next` owns the transitions; `/track` only writes the initial `[ ]` lines.

---

## The input contract: `plan.json`

`/track` reads `docs/plans/<slug>/plan.json` at the **git root** of the target
repo. This file is produced by `/backlog` and is the durable, sink-agnostic
backlog. `/track` never fetches Linear.

Schema (immutable structure — progress is NOT stored here):

```json
{
  "effort": "V8",
  "milestones": [
    {
      "id": "M1",
      "demo": "Run agent → Claude Code spawn → output streamé",
      "skeleton": true,
      "needs": [],
      "tracks": [
        { "id": "A", "branch": "feat/agent-spawn-stream", "tasks": [
          { "step": "01", "title": "Spawn process Claude Code", "size": "I4",
            "slice_of": ["D2"], "done_when": "un PID tourne, logs capturés",
            "description": "WHAT…\n\nWHY…\n\nWHERE…\n\nDONE WHEN…",
            "sink_id": null }
        ]}
      ]
    }
  ]
}
```

`sink_id` (optional, per task) is the Linear issue UUID. Present → `/next`
syncs Linear state. Absent/`null` → no sync; state lives only in `progress.md`
+ git. This is the "Linear = adapter" decoupling.

---

## Flow

### Phase 1 — Identify repo + slug

1. `git rev-parse --is-inside-work-tree` — if NOT a git repo, REFUSE and tell the user.
2. `git remote get-url origin` → repo slug (last path segment, strip `.git`). If
   there is no origin, derive the slug from the repo's root dir name.

### Phase 2 — Locate the plan

Look for `docs/plans/<slug>/plan.json` at the git root (`git rev-parse --show-toplevel`).
If it does not exist → tell the user to run `/backlog` first (it produces the
plan), and STOP. Do NOT invent a plan.

### Phase 3 — List milestones + tracks

```bash
python3 ~/.stow_repository/claude/.claude/skills/track/read_plan.py <plan.json>
```

Emits the milestone/track summary (counts, demo string, first task titles, and each
milestone's `needs[]`). Print a 1-line summary per track. Walking-skeleton milestone
(`skeleton: true`) first. If the plan has no tracks → surface it as a `/backlog` bug
and STOP.

**Surface the parallelism, don't fake it.** `needs[]` is each milestone's
milestone-level dependency. Milestones sharing the same `needs` are **parallelizable**
— one git worktree per track, as today. `/track` does NOT auto-detect which milestones
are already shipped (there is no plan-wide completion ledger — that is agent-cockpit's
job). So show the `needs` edges and let the operator pick a parallel branch; never
claim a milestone is "unblocked" on your own.

### Phase 4 — Pick a track

- If `$ARGUMENTS` is `M1` → if that milestone has exactly one track, use it;
  otherwise ask which track.
- If `$ARGUMENTS` is `M1.A` → use it directly.
- Otherwise `AskUserQuestion` (load via `ToolSearch query="select:AskUserQuestion"`):
  - Question: `Quelle track on ship ?`
  - One option per open track. Label = `M{m}.{track} (X tasks)`. Description =
    the milestone `demo` string + first task title, truncated.
  - `multiSelect: false`.

Then fetch the chosen slice:

```bash
python3 ~/.stow_repository/claude/.claude/skills/track/read_plan.py <plan.json> --milestone <M> --track <T>
```

### Phase 5 — Persist the progress checklist (durable, in-repo)

**One tracker per track — they coexist.** Tracks are **parallel** (see the model
above), so their state must be too. The store is **per-track**, keyed by the track
coordinate:

```
docs/plans/<slug>/.tracks/M{M}.{track}/progress.md
docs/plans/<slug>/.tracks/M{M}.{track}/track.json
```

`/track M2.A` writes `.tracks/M2.A/` **regardless of whether `.tracks/M1.A/` already
exists** — staging one track NEVER touches, replaces, or asks about another. There is
**no single "active track"** and **no replace-or-abort question across tracks**: that
was the old single-file design, and it contradicted parallelism. The whole point of a
track is that it runs alongside its siblings. The `.tracks/` dir is gitignored,
durable across reboots, never in git history — **self-heal** plans authored before per-track
trackers existed: ensure `docs/plans/<slug>/.gitignore` contains a `.tracks/` line
(append if missing), remove the obsolete top-level `progress.md` / `track.json` lines
from it, and `rm` those stale top-level files if present (they were gitignored
ephemeral state from the old single-file layout — never committed, safe to delete).

**Which track `/next` ships is chosen explicitly** — `/next M{M}.{track}` (or `/next`
alone when exactly one tracker is unfinished). `/next` does **not** look at the git
branch. The `branch` field is just the name to check out / `wt` for that track's PR; it
is not a selector. Sibling trackers coexist, each drained by its own `/next M…`.

**Resume — scoped to the SAME coordinate only.** If `.tracks/M{M}.{track}/progress.md`
already exists for **the track you just picked** with unchecked `[ ]`/`[~]` boxes, ask:
resume it, or overwrite it? Never silently clobber in-flight work. A *different* track's
tracker existing is **never** a reason to ask anything — leave it alone.

Write **two** files into `docs/plans/<slug>/.tracks/M{M}.{track}/`:

#### `progress.md` — user-facing checklist

```markdown
# M{M}.{track} — {Project slug}

Started: {ISO timestamp}
Plan: {abs path to plan.json}
Slug: {slug}
Milestone: M{M} — {demo string}
Branch: {track.branch}   ← checkout / worktree this for the PR

## Helpers

- Next task (LLM does it): `/next` — commits + pushes the previous `[~]` task
  (now validated), then starts the next `[ ]`.
- Linear adapter (only for tasks with a `sink_id`):
  `python3 ~/.stow_repository/claude/.claude/skills/next/set_state.py <sink_id> started`
- Commit format used at validation time: `<type>(<scope>): <imperative title>`;
  if the task has a `sink_id`, the body ends with `Closes <sink_id>`. The commit
  is created at the START of the *next* `/next` run, never at the end of the
  current one — so you review the working-tree diff first.
- This track = ONE PR. When the last task is shipped, open it with `/pr`.

## Tasks

- [ ] [M1.A-01] Spawn process Claude Code
- [ ] [M1.A-02] Stream stdout vers un event
```

#### `track.json` — full task data for `/next`

```json
{
  "slug": "<slug>",
  "plan_path": "<abs path to plan.json>",
  "milestone": { "id": "M1", "number": 1, "demo": "...", "skeleton": true },
  "track": { "id": "A", "branch": "feat/agent-spawn-stream", "tasks": [
    { "step": "01", "identifier": "[M1.A-01]", "title": "...", "size": "I4",
      "slice_of": ["D2"], "done_when": "...", "description": "...", "sink_id": null }
  ]}
}
```

Dump the `read_plan.py --milestone --track` output verbatim into `track.json`,
augmented with `slug` and `plan_path`.

### Phase 6 — Hand off

Print, in 4 short lines:

- `Plan: <abs path to .tracks/M{M}.{track}/progress.md>`
- `Track: M{M}.{track} — {X} tasks`
- `Branch: {track.branch}` (the name to `wt {branch}` / `git checkout -b {branch}` for
  this track's PR — not a `/next` selector)
- `Next: /next M{M}.{track}` (ships this track's first task)
- `À toi de jouer.`

Then STOP.

---

## Rules

1. **`/track` reads, it never writes Linear.** The only Linear coupling lives in
   the optional adapter `next/set_state.py`, called by `/next` when a task has a
   `sink_id`. `/track` is pure plan.json → scratch.
2. **The plan file is authored by `/backlog`.** If `plan.json` is missing, STOP
   and point the user at `/backlog`. Never fabricate a plan.
3. **The progress files live in the repo, not `/tmp`.** Each track owns
   `docs/plans/<slug>/.tracks/M{M}.{track}/progress.md` + `track.json` (durable,
   gitignored). Trackers are **per-track and coexist** — staging M2.A never touches
   M1.A. `/next M{M}.{track}` selects a track explicitly (never by git branch). Never
   write tracker state to `/tmp`, and never collapse the trackers into one "active" file.
4. **Schema mismatch = fail loud.** If `read_plan.py` exits non-zero (bad JSON,
   missing `milestones`, malformed `step`), surface the error — do not paper over
   a half-parsed plan.
