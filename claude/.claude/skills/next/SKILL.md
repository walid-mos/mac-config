---
name: next
user-invocable: true
description: >-
  Ship the next task of the active track, one task per invocation. Use when the
  user runs `/next`: it commits + pushes the previous task (now validated by the
  user), then starts the next one and stops. Companion to `/track` (which stages
  the track) and `/backlog`. **Never commits or pushes the current task**:
  commit + push happen only at the START of the next `/next`, after the user has
  reviewed the working-tree diff. A track ships as ONE PR.
---

# next

`/next` is the **ship** half of the loop (the other is `/track`). Each run does a
two-step ritual across two invocations:

- **Validate previous** (if any `[~]` task exists) — commit the working-tree
  changes, push, tick `[x]`, and (only if the task has a `sink_id`) close the
  Linear issue as Done + archived. **This is the ONLY moment `/next` is allowed
  to commit or push.**
- **Start next** (if any `[ ]` task remains) — set Linear In Progress (if
  `sink_id`), implement, verify. Do NOT commit. Tick `[~]`.

Then STOP. No chaining, no auto-loop. The user's next `/next` call is the
validation signal for the task just shipped.

**Commit + push policy**: `/next` is **forbidden** from committing or pushing
after implementing the current task. The only commit + push allowed is at the
start of a `/next` run, when transitioning the previously-validated task to done.
This keeps unvalidated work as a reviewable working-tree diff.

The identifier regex for this skill: `\[M(\d+)\.([A-Z]+)-(\d+)\]` (e.g.
`[M1.A-01]`).

---

### Phase 1 — Locate the active track

1. `git rev-parse --is-inside-work-tree` — if NOT a git repo, REFUSE and tell the user.
2. Slug = `git remote get-url origin` last path segment, strip `.git` (fallback: repo
   root dir name). The tracker store is `docs/plans/<slug>/` at the git root
   (`git rev-parse --show-toplevel`).
3. Read `docs/plans/<slug>/progress.md` and `docs/plans/<slug>/track.json`. Missing
   `progress.md` → there is no active track; tell the user to run `/track` first and
   STOP. (The slug is derived from the repo you're in, so there is no wrong-tree
   ambiguity to guard against — you're always operating on this repo's own track.)
4. If `progress.md` has neither a `[ ]` nor a `[~]` line → the track is fully
   shipped; remind the user (`/track` for the next one) and STOP.

### Phase 2 — Validate the previous task (commit + push + close any `[~]`)

1. Parse `progress.md`, find any line matching `^- \[~\] \[M\d+\.[A-Z]+-\d+\] .*$`.
2. If none → skip to Phase 3.
3. If MULTIPLE `[~]` lines exist → that's a bug (only one task in flight at a
   time). STOP and surface — do not blindly close them all.
4. If exactly one → look it up in `track.json` by identifier (gets `title`,
   `description`, `sink_id`), then commit the working-tree changes.

   **Sanity check first**: `git status --porcelain`. If the working tree is clean
   → STOP and surface. A `[~]` line with no working-tree changes means the user
   reverted the work, or the previous `/next` left no trace. Do not create an
   empty commit; ask how to resolve (typically: revert `[~]` → `[ ]` and re-run).

   If the working tree has changes:

   ```bash
   git add -A
   git commit -m "<type>(<scope>): <imperative summary>"   # add -m "" -m "Closes <sink_id>" ONLY if the task has a sink_id
   ```

   Conventional commit, matching the repo's existing style (`git log --oneline -10`
   if unsure). Add the `Closes <sink_id>` trailer **only when the task carries a
   `sink_id`** (Linear auto-closes on default-branch merge). No `sink_id` → no
   trailer, and no Linear auto-close (expected in the decoupled model).

   Then push:

   ```bash
   git push
   ```

   No upstream yet → `git push -u origin HEAD`. If the push fails (rejected
   non-fast-forward, network, hook), STOP and surface — do not touch Linear, do
   not tick `[x]`. The task stays `[~]` (now with a local commit); the user
   resolves the push before the next `/next`. Never use `--no-verify` or
   `--force` to "fix" a push failure. Diagnose root cause.

5. Once the push succeeds, **only if the task has a `sink_id`**, close + archive
   the Linear issue:

   ```bash
   python3 ~/.stow_repository/claude/.claude/skills/next/set_state.py <sink_id> completed --archive
   ```

   `--archive` is mandatory here: it triggers `issueArchive` so the issue leaves
   the active list immediately. If the call fails, STOP and surface — do not
   start a new task while Linear is out of sync. (No `sink_id` → skip this step.)

6. Update `progress.md`: replace this task's `[~]` with `[x]` and append the
   commit short SHA:

   ```
   - [x] [M1.A-01] Spawn process Claude Code - abc1234
   ```

### Phase 3 — Pick the first unstarted task (`[ ]`)

1. Parse `progress.md`, find the first line matching
   `^- \[ \] \[M\d+\.[A-Z]+-\d+\] .*$` that does NOT start with `- [ ] ⚠ `
   (blocked tasks are skipped, see Rule 6).
2. Extract the identifier (e.g. `[M1.A-01]`).
3. Look up the matching entry in `track.json` by identifier — gives `description`,
   `done_when`, `sink_id`, etc.
4. If no pickable `[ ]` tasks remain:
   - At least one `- [ ] ⚠ ` blocked task left → tell the user the track is
     **stalled on blocked tasks**, list them with reasons, STOP. Do not declare
     the track complete.
   - Else if Phase 2 closed a `[~]` task → the track is **complete**. Remind the
     user: **this track = ONE PR**, suggest `/pr` to open it, then `/track` for
     the next track. STOP.
   - Else (Phase 2 was a no-op too) → the track was already complete; remind the
     user and STOP.

### Phase 4 — Mark In Progress (only if `sink_id`)

```bash
python3 ~/.stow_repository/claude/.claude/skills/next/set_state.py <sink_id> started
```

If this fails, STOP and surface — do not start coding while Linear is out of
sync. (No `sink_id` → skip; the `[ ]` → `[~]` tick at Phase 8 is the only state.)

### Phase 5 — Implement the task

Read the description (WHAT / WHY / WHERE / DONE WHEN) and the `done_when` field,
then execute. Stay strictly within scope — no "while I'm here". If the task
mixes multiple concepts, that's a `/backlog` bug: STOP and surface it.

### Phase 6 — Verify

Run typecheck / tests / lint / build appropriate to the repo. If
`/nextnode-standards` applies, run those exact commands. Do NOT skip verification
on a "trivial" change. **Keep output small** — pipe noisy runs through `tail -40`
(or `--reporter=basic` / `--silent` for Vitest).

### Phase 7 — Leave working tree dirty (no commit)

**Do NOT commit.** The implementation is done; the working tree carries the
task's diff. Leave it — the user reviews the diff before the next `/next`, and
*that* run commits + pushes it (Phase 2). Working-tree-only is the contract: it
makes the diff trivial to review (`git diff`), amend (edit + save), or discard
(`git restore`).

### Phase 8 — Tick the task as `[~]`

Update `progress.md`: replace the `[ ]` of this task with `[~]`:

```
- [~] [M1.A-01] Spawn process Claude Code
```

`[~]` means: *implemented, working-tree changes pending, NOT committed, NOT
pushed, awaiting user validation* (and Linear In Progress if `sink_id`). The next
`/next` will commit + push it.

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
(`git stash` / `git restore`), mark the task blocked in `progress.md`
(`- [ ] ⚠ [M1.A-02] ... - <reason>`), and surface the question. Do not leave
half-work in the tree.

---

## Bundled helper

- `set_state.py <issue_id> <state_type> [--archive]` — the **optional** Linear
  adapter. state_type ∈ `{backlog, unstarted, started, completed, canceled}`;
  `--archive` also calls `issueArchive`. Called by Phase 4 (`started`) and Phase 2
  (`completed --archive`) **only when the task carries a `sink_id`**. Reads
  `LINEAR_API_KEY` (no `Bearer ` prefix), `urllib` only.

---

## Rules

1. **`/next` does at most ONE close + ONE start per invocation.** Phase 2 closes a
   single `[~]`, Phases 3-8 start a single `[ ]`. Never two starts. After Phase 9,
   STOP — let the user trigger the next one.
2. **No auto-chaining.** Do not call `/next` from within a `/next` run. The user
   types `/next` again when ready; that contract protects token cost.
3. **The tracker files are the source of truth.** In `docs/plans/<slug>/`:
   `track.json` is the cached task data, `progress.md` the working checklist. Do not
   re-read `plan.json` on `/next` unless `track.json` is missing or corrupt.
4. **Tracker state lives in the repo, never `/tmp`.** `progress.md` + `track.json`
   sit in `docs/plans/<slug>/` (gitignored, durable across reboots). The slug is
   derived from the current repo, so there is no wrong-tree ambiguity.
5. **At most one `[~]` task at a time.** Multiple `[~]` lines = bug; STOP and
   surface. If any Linear adapter call fails, stop and surface — never leave
   Linear out of sync.
6. **No half-implementations on block.** Can't complete cleanly → revert partial
   work (`git stash` / `git restore`) and mark blocked. Never leave a stub in the
   tree just to tick the box — the next `/next` would commit it.
7. **A task NEVER touches a Claude skill.** If a task's `WHERE` resolves to
   `~/.claude/skills/...` or `~/.stow_repository/claude/.claude/skills/...`, the
   issue is a `/backlog` bug — refuse to implement, surface to the user. Skills
   live in a separate repo (`mac-config`) and must never be a deliverable.
8. **No commit and no push after Phase 7.** The dirty working tree is the
   contract; do not commit "to lock it in".
9. **Linear is optional.** Tasks without a `sink_id` are shipped purely via the
   checklist + git — no Linear calls. Never block a `/next` on Linear when the
   task carries no `sink_id`.
