---
name: next
user-invocable: true
description: >-
  Ship the next task of a staged track, one task per invocation, reading and
  writing state in the per-project progress.db. Use when the user runs `/next`:
  commits + pushes the previously validated task, then implements the next one
  and stops. Never commits or pushes the current task — that happens at the
  START of the following `/next`. Companion to `/track` and `/backlog`.
---

# next

`/next` is the **ship** half of the loop (the other is `/track`). Each run does a
two-step ritual across two invocations:

- **Validate previous** (if a task is `in_progress`) — commit the working-tree
  changes, push, set the task `done` (with its commit sha), and (only if it has a
  `sink_id`) close the Linear issue as Done + archived. **This is the ONLY moment
  `/next` is allowed to commit or push.**
- **Start next** (if a `backlog` task remains) — set Linear In Progress (if
  `sink_id`), implement, verify. Do NOT commit. Set the task `in_progress`.

Then STOP. No chaining, no auto-loop. The user's next `/next` call is the
validation signal for the task just shipped.

## State lives in `~/mizraj/<slug>/progress.db`

All task state is in the project's `progress.db` — there is **no `.tracks/`, no
`progress.md`, no `track.json`**. `/next` reads and writes it through the db
client `cockpit-db/cockpit_db.sh`:

- `read-track <git-root> M{M} {track}` → JSON `{ branch, tasks: [...] }`, each task
  carrying `identifier`, `status`, `title`, `description`, `done_when`, `size`,
  `sink_id`, `blocked_reason`, `commit_sha`, ordered by step.
- `list-open <git-root>` → JSON of staged tracks (those with tasks) that still
  have unfinished tasks, with their open counts.
- `set-status <git-root> --identifier ID --status S [--sha SHA] [--blocked-reason R]`
  → write one task's execution state. Fails loud if the identifier is unknown.

The `status` vocabulary: `backlog` (not started) · `in_progress` (implemented on
the working tree, NOT committed, awaiting validation — the old `[~]`) · `done`
(committed + pushed) · `blocked` (skipped until unblocked). At most **one**
`in_progress` task per track at a time.

**Commit + push policy**: `/next` is **forbidden** from committing or pushing
after implementing the current task. The only commit + push allowed is at the
start of a run, when transitioning the previously-validated `in_progress` task to
`done`. This keeps unvalidated work as a reviewable working-tree diff.

The identifier regex: `\[M(\d+)\.([A-Z]+)-(\d+)\]` (e.g. `[M1.A-01]`).

---

### Phase 1 — Locate the active track

1. `git rev-parse --is-inside-work-tree` — if NOT a git repo, REFUSE.
2. Slug = `git remote get-url origin` last path segment, strip `.git`, lowercased
   (fallback: git root dir name). `<git-root>` = `git rev-parse --show-toplevel`.
   `cockpit_db.sh` resolves the slug → `~/mizraj/<slug>/progress.db` from the root
   you pass it.
3. **Select the track explicitly — `/next` does NOT look at the git branch.**
   - `$ARGUMENTS` names a coordinate (`M2.A`, `m2.a`) → use it.
   - No argument, and `list-open` returns **exactly one** staged track with
     unfinished tasks → use that one (the unambiguous case).
   - No argument, and **several** staged tracks are unfinished → do NOT guess.
     List them (`M{M}.{track} — <open> open`) and ask the user to re-run as
     `/next M{M}.{track}`. STOP.
   - **`list-open` is empty** → no track staged; tell the user to run `/track` and STOP.
4. `read-track <git-root> M{M} {track}`. If every task is `done` (or the task list
   is empty) → that track is fully shipped; remind the user (`/pr` to open it,
   `/track` for the next) and STOP.

### Phase 2 — Validate the previous task (commit + push + close any `in_progress`)

1. From the `read-track` JSON, find the task whose `status` is `in_progress`.
2. If none → skip to Phase 3.
3. If MULTIPLE are `in_progress` → that's a bug (only one in flight at a time).
   STOP and surface — do not blindly close them all.
4. If exactly one → it carries `title`, `description`, `sink_id`. Commit the
   working-tree changes.

   **Sanity check first**: `git status --porcelain`. If the working tree is clean
   → STOP and surface. An `in_progress` task with no working-tree changes means
   the user reverted the work, or the previous `/next` left no trace. Do not
   create an empty commit; ask how to resolve (typically: set it back to
   `backlog` and re-run).

   If the working tree has changes:

   ```bash
   git add --update   # stages only tracked files — never use git add -A (risks .env / binaries)
   git commit -m "<type>(<scope>): <imperative summary>"   # add -m "" -m "Closes <sink_id>" ONLY if the task has a sink_id
   ```

   Conventional commit, matching the repo's existing style (`git log --oneline -10`
   if unsure — or see `/pr` for the convention-detection algorithm). Add the
   `Closes <sink_id>` trailer **only when the task carries a `sink_id`**. No
   `sink_id` → no trailer (expected in the decoupled model).

   Then push:

   ```bash
   git push
   ```

   No upstream yet → `git push -u origin HEAD`. If the push fails (rejected
   non-fast-forward, network, hook), STOP and surface — do not touch Linear, do
   not mark the task `done`. It stays `in_progress` (now with a local commit); the
   user resolves the push before the next `/next`. Never `--no-verify` or
   `--force` to "fix" a push failure. Diagnose root cause.

5. Once the push succeeds, mark the task `done` with its short sha:

   ```bash
   bash ~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh \
     set-status <git-root> --identifier '[M{M}.{track}-{step}]' --status done --sha <short-sha>
   ```

6. **Only if the task has a `sink_id`**, close + archive the Linear issue:

   ```bash
   python3 ~/.stow_repository/claude/.claude/skills/next/set_state.py <sink_id> completed --archive
   ```

   `--archive` is mandatory here. If the call fails, STOP and surface — do not
   start a new task while Linear is out of sync. (No `sink_id` → skip this step.)

### Phase 3 — Pick the first unstarted task (`backlog`)

1. From `read-track`, find the first task (by order) whose `status` is `backlog`.
   Skip any `blocked` task.
2. If no `backlog` task remains:
   - At least one `blocked` task left → tell the user the track is **stalled on
     blocked tasks**, list them with `blocked_reason`, STOP. Do not declare the
     track complete.
   - Else if Phase 2 just marked a task `done` → the track is **complete**.
     Remind the user: **this track = ONE PR**, suggest `/pr`, then `/track` for the
     next track. STOP.
   - Else (Phase 2 was a no-op too) → already complete; remind the user and STOP.

### Phase 4 — Mark In Progress on the sink (only if `sink_id`)

```bash
python3 ~/.stow_repository/claude/.claude/skills/next/set_state.py <sink_id> started
```

If this fails, STOP and surface — do not start coding while Linear is out of
sync. (No `sink_id` → skip; the db `backlog` → `in_progress` write at Phase 8 is
the only state.)

### Phase 5 — Implement the task

**Guard first**: if the task's `description` OR `done_when` is empty/NULL in the
db, do NOT guess the task — set it `blocked` (reason: `missing spec`) and surface
to the user; an unspecified task is a `/backlog` bug, never something to invent.

Otherwise read the task's `description` (WHAT / WHY / WHERE / DONE WHEN) and
`done_when`, then execute. Stay strictly within scope — no "while I'm here". If
the task mixes multiple concepts, that's a `/backlog` bug: STOP and surface it.

**FORBIDDEN in this phase**: touching files outside the task's WHERE paths;
adding dependencies not listed in the task; refactoring adjacent code; upgrading
tooling; fixing "while I'm here" issues.

### Phase 6 — Verify

Run typecheck / tests / lint / build appropriate to the repo. If
`/nextnode-standards` applies, run those exact commands. Do NOT skip verification
on a "trivial" change. **Keep output small** — pipe noisy runs through `tail -40`.

**No test suite in the repo?** Skip the test run, but still run an explicit
minimal gate — typecheck + lint + build (whatever exists). Never fake it (no
"grep for syntax errors") and never silently skip verification entirely; state
which gate you ran.

### Phase 7 — Leave the working tree dirty (no commit)

**Do NOT commit.** The implementation is done; the working tree carries the
task's diff. Leave it — the user reviews the diff before the next `/next`, and
*that* run commits + pushes it (Phase 2). Working-tree-only is the contract.

### Phase 8 — Mark the task `in_progress`

```bash
bash ~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh \
  set-status <git-root> --identifier '[M{M}.{track}-{step}]' --status in_progress
```

`in_progress` means: *implemented, working-tree changes pending, NOT committed,
NOT pushed, awaiting user validation* (Linear In Progress if `sink_id`). The next
`/next` will commit + push it and set it `done`.

### Phase 9 — Report and STOP

Print, in 3-4 lines:

- `Closed: [M1.A-01] <title> - <sha> (committed + pushed)` (only if Phase 2
  committed + pushed a previous task; otherwise omit)
- `Implemented: [M1.A-02] <title> (working tree dirty, NOT committed - review the diff)`
- `Next up: [M1.A-03] <next title>` (or `Last task of track - next /next will commit + push it, then /pr.` if none left)
- `→ review the diff, then /next`

Then STOP. Do **not** call `/next` recursively. Do **not** auto-continue.

If the task got blocked mid-implementation (waiting on input, ambiguous spec,
missing dependency), STOP, **revert any partial work** that can't stand alone
(`git stash` / `git restore`), mark the task blocked in the db, and surface the
question:

```bash
bash ~/.stow_repository/claude/.claude/skills/cockpit-db/cockpit_db.sh \
  set-status <git-root> --identifier '[M{M}.{track}-{step}]' --status blocked --blocked-reason "<why>"
```

Do not leave half-work in the tree.

---

## Bundled helper

`set_state.py` — Linear adapter; called only in Phase 2 (`completed --archive`) and Phase 4 (`started`) when the task carries a `sink_id`.

---

## Rules

1. **`/next` does at most ONE close + ONE start per invocation.** Phase 2 closes a
   single `in_progress`, Phases 3-8 start a single `backlog`. Never two starts.
   After Phase 9, STOP — let the user trigger the next one.
2. **No auto-chaining.** Do not call `/next` from within a `/next` run.
3. **The db is the source of truth.** `~/mizraj/<slug>/progress.db`, read/written
   via `cockpit_db.sh`. The active track is chosen **explicitly** (`/next M{M}.{track}`,
   or auto when exactly one staged track is unfinished); `/next` never reads the
   git branch.
4. **At most one `in_progress` task at a time.** Multiple = bug; STOP and surface.
   If any Linear adapter call fails, stop and surface — never leave Linear out of
   sync.
5. **No half-implementations on block.** Can't complete cleanly → revert partial
   work (`git stash` / `git restore`) and set the task `blocked` with a reason.
   Never leave a stub in the tree just to tick a box — the next `/next` would
   commit it.
6. **A task NEVER touches a Claude skill.** If a task's `WHERE` resolves to
   `~/.claude/skills/...` or `~/.stow_repository/claude/.claude/skills/...`, the
   issue is a `/backlog` bug — refuse to implement, surface to the user.
7. **No commit and no push after Phase 7.** The dirty working tree is the
   contract; do not commit "to lock it in".
8. **Linear is optional.** Tasks without a `sink_id` are shipped purely via the db
   + git — no Linear calls. Never block a `/next` on Linear when the task carries
   no `sink_id`.
