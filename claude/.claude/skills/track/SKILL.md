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
      "tracks": [
        { "id": "A", "tasks": [
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

Emits the milestone/track summary (counts, demo string, first task titles).
Print a 1-line summary per track. Walking-skeleton milestone (`skeleton: true`)
first. If the plan has no tracks → surface it as a `/backlog` bug and STOP.

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

The tracker store is `docs/plans/<slug>/` at the git root — the same folder that
holds `plan.json`. `/track` writes the active track's `progress.md` + `track.json`
**there** (NOT in `/tmp` — nothing ephemeral). Both are gitignored (the `.gitignore`
`/backlog` wrote), so they survive reboots but never pollute git history. This is
the in-house tracker store; agent-cockpit will read the same folder later.

**One active track per checkout.** `progress.md` / `track.json` represent the track
currently in flight. To ship two tracks of the same milestone in parallel, use a
separate git worktree per track (each checkout keeps its own gitignored progress
files) — that is the parallel-PR story.

**Resume support**: if `docs/plans/<slug>/progress.md` already exists with unchecked
`[ ]`/`[~]` boxes, ask the user: resume that track, or replace it with the newly
picked one? (Replace overwrites `progress.md` + `track.json`.) Never silently
clobber an in-flight track.

Write **two** files into `docs/plans/<slug>/`:

#### `progress.md` — user-facing checklist

```markdown
# M{M}.{track} — {Project slug}

Started: {ISO timestamp}
Plan: {abs path to plan.json}
Slug: {slug}
Milestone: M{M} — {demo string}

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
  "track": { "id": "A", "tasks": [
    { "step": "01", "identifier": "[M1.A-01]", "title": "...", "size": "I4",
      "slice_of": ["D2"], "done_when": "...", "description": "...", "sink_id": null }
  ]}
}
```

Dump the `read_plan.py --milestone --track` output verbatim into `track.json`,
augmented with `slug` and `plan_path`.

### Phase 6 — Hand off

Print, in 4 short lines:

- `Plan: <abs path to progress.md>`
- `Track: M{M}.{track} — {X} tasks`
- `Next: /next` (when ready to ship the first task)
- `À toi de jouer.`

Then STOP.

---

## Rules

1. **`/track` reads, it never writes Linear.** The only Linear coupling lives in
   the optional adapter `next/set_state.py`, called by `/next` when a task has a
   `sink_id`. `/track` is pure plan.json → scratch.
2. **The plan file is authored by `/backlog`.** If `plan.json` is missing, STOP
   and point the user at `/backlog`. Never fabricate a plan.
3. **The progress files live in the repo, not `/tmp`.** `progress.md` + `track.json`
   sit in `docs/plans/<slug>/` (durable, gitignored). One active track per checkout;
   parallel tracks use parallel git worktrees. Never write tracker state to `/tmp`.
4. **Schema mismatch = fail loud.** If `read_plan.py` exits non-zero (bad JSON,
   missing `milestones`, malformed `step`), surface the error — do not paper over
   a half-parsed plan.
