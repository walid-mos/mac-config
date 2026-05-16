---
name: go
user-invocable: true
argument-hint: "[next | <phase-number>]"
description: >-
  Ship a Linear backlog phase one task at a time. Use when the user runs
  `/go` (setup mode: pick a phase, write plan.md + tasks.json) or `/go next`
  (next mode: commit + push the previous task, start the next one, stop).
  Companion to `/backlog` - the user paces validation, one
  `/go next` = one task shipped. **Never commits or pushes the current
  task**: commit + push only happen at the START of the next `/go next`, once
  the user has reviewed the working-tree diff and validated.
---

# go

### Plan checkbox states

`plan.md` uses three states for each task line:

| Marker        | Meaning                                                                        |
|---------------|--------------------------------------------------------------------------------|
| `[ ]`         | Not started.                                                                   |
| `[ ] ⚠ ... - <reason>` | Blocked. Skipped by `/go next` and `goloop` until unblocked. Linear stays unstarted (or whatever state the user moves it to). |
| `[~]`         | Implemented (working-tree changes only - NOT committed, NOT pushed); Linear is **In Progress**, awaiting user validation. |
| `[x]`         | User validated the dev on the previous `/go next`; commit was created + pushed; Linear is **Done + archived**. |

A task moves `[ ]` → `[~]` at the end of the `/go next` that ships it (working-tree changes only, no commit, no push), then `[~]` → `[x]` at the *start* of the following `/go next` (after the user has validated the diff): that's when the commit gets created, pushed, and Linear closed. The user's act of running `/go next` again is the validation signal.

**Commit + push policy**: `/go next` is **forbidden** from committing or pushing after implementing the current task. The only commit + push allowed is at the start of a `/go next` run, when transitioning the previously-validated task to Done. This keeps unvalidated work as a reviewable working-tree diff.

---

## Setup mode (`/go`, `/go <N>`)

### Phase 1 - Identify project + Linear binding

1. Detect repo: `git remote get-url origin` → repo slug (last path segment, strip `.git`).
2. Read `~/.stow_repository/claude/.claude/skills/nextnode-linear/workspace.md` and find the project whose repo binding matches.
3. If cwd is NOT a git repo, or no project matches → load `AskUserQuestion` via `ToolSearch query="select:AskUserQuestion"` and ask the user to pick.
4. Verify `LINEAR_API_KEY` is set: `test -n "$LINEAR_API_KEY"`. If not, REFUSE and tell the user.

Resolve and remember:
- `projectId` (UUID)
- A short slug (`infra`, `monitoring`, `ysumai`, etc.) for the temp dir.

### Phase 2 - Fetch open phases

If `$ARGUMENTS` is a number `N`, fetch only that phase (cheap):

```bash
python3 ~/.stow_repository/claude/.claude/skills/go/fetch_phases.py <projectId> --phase N
```

If no phase number was given, fetch all open phases so the user can choose:

```bash
python3 ~/.stow_repository/claude/.claude/skills/go/fetch_phases.py <projectId>
```

Outputs a JSON object with the matching phases (any task whose state is NOT `completed`/`canceled`). The `--phase N` form drops the other phases before printing - use it whenever the phase is already known, it saves ~75% of the helper output and the matching context bloat.

Print a 1-line summary per returned phase. If empty → tell the user the backlog is shipped (or the requested phase has no open tasks), STOP.

### Phase 3 - Pick a phase

If `$ARGUMENTS` is a number that matches an open phase → use it directly (already fetched in Phase 2 with `--phase`).

Otherwise, `AskUserQuestion`:
- Question: `Quelle phase on prend ?`
- One option per open phase. Label = `Phase N (X tasks)`. Description = the first 1–2 task titles, truncated.
- `multiSelect: false`.

### Phase 4 - Persist plan + tasks

Path: `/tmp/claude/go-<slug>-p<N>-<timestamp>/`. `mkdir -p` first.

Resume support: if a directory `/tmp/claude/go-<slug>-p<N>-*` already exists with unchecked boxes in `plan.md`, ask the user: resume that plan, or start a fresh one? (Resume = re-use the same dir; fresh = new timestamp.)

Write **two** files in that dir:

#### `plan.md` - user-facing checklist

```markdown
# Phase {N} - {Project Name}

Started: {ISO timestamp}
Linear: https://linear.app/nextnode/project/{slug}
Project ID: {uuid}
Slug: {slug}

## Helpers

- Next task (LLM does it): `/go next` - commits + pushes the previous `[~]` task (now validated), then starts the next `[ ]`.
- Set state manually: `python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issueId> started`
- Set state + archive: `python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issueId> completed --archive`
- Commit format used at validation time: `<type>(<scope>): <imperative title>` body ends with `Closes <IDENTIFIER>` (Linear auto-closes on default-branch merge). The commit is created at the START of the *next* `/go next` run, never at the end of the current one - that way you review the working-tree diff first and can make changes before it lands.

## Tasks

- [ ] NEXT-123 [P1-01] Add port allocator state to R2
- [ ] NEXT-124 [P1-02] Allocate host port on first deploy of a project
- [ ] NEXT-125 [P1-03] Wire envEntrypoint to allocated port
```

#### `tasks.json` - full task data for `/go next`

```json
{
  "project_id": "<uuid>",
  "slug": "<slug>",
  "phase_number": 1,
  "tasks": [
    {
      "id": "<uuid>",
      "identifier": "NEXT-123",
      "title": "[P1-01] Add port allocator state to R2",
      "description": "WHAT...\n\nWHY...\n\nWHERE...\n\nDONE WHEN...",
      "priority": 2,
      "step": "01"
    }
  ]
}
```

Just dump the relevant subset of the `fetch_phases.py` output to `tasks.json` (the phase the user picked, plus the project-level metadata).

### Phase 5 - Hand off

Print to the user, in 4 short lines:

- `Plan: <absolute path to plan.md>`
- `Phase: P{N} - {X} tasks`
- `Next: /go next` (when ready to ship the first task)
- `À toi de jouer.`

Then STOP.

---

## Next mode (`/go next`)

Triggered by `/go next`. Two-step ritual per task across two invocations:

- **Validate previous** (if any `[~]` task exists) - commit the working-tree changes, push, close the issue as Done + archived in Linear, tick plan to `[x]`. **This is the ONLY moment `/go next` is allowed to commit or push.**
- **Start next** (if any `[ ]` task remains) - set Linear In Progress, implement, verify. Do NOT commit. Tick plan to `[~]`.

Then STOP. No chaining, no auto-loop. The user's next `/go next` call is the validation signal for the task just shipped.

### Phase 1 - Locate the active plan

1. Find candidate plan dirs: `ls -dt /tmp/claude/go-*-p*-*/` (most recent first).
2. Filter to dirs whose `plan.md` has at least one `[ ]` OR `[~]` line (work still pending OR awaiting validation).
3. Resolve to a single plan:
   - If exactly one candidate → use it.
   - If multiple → prefer the dir whose slug matches the current `cwd`'s repo slug. If still ambiguous, `AskUserQuestion`.
   - If zero candidates → tell the user there is no active plan (`/go` to set one up) and STOP.
4. Read `plan.md` and `tasks.json` from that dir.
5. **Sanity check the cwd**: parse the slug from `plan.md` frontmatter / `tasks.json`. If the current repo's slug does NOT match → REFUSE and tell the user to `cd` into the right repo first. Do not implement code in the wrong tree.

### Phase 2 - Validate the previous task (commit + push + close any `[~]`)

1. Parse `plan.md`, find any line matching `^- \[~\] <IDENTIFIER> \[P\d+-\d+\] .*$`.
2. If none → skip to Phase 3.
3. If MULTIPLE `[~]` lines exist → that's a bug (only one task should ever be in flight). STOP and surface - do not blindly close them all.
4. If exactly one → look up the task in `tasks.json` by identifier (gets the issue UUID, title, description), then commit the working-tree changes.

   **Sanity check first**: run `git status --porcelain`. If the working tree is clean (no staged + no unstaged changes) → STOP and surface. A `[~]` line without working-tree changes means the user reverted the work, or the previous `/go next` left no trace. Do not create an empty commit; ask the user how to resolve (typically: revert the `[~]` to `[ ]` in `plan.md` and re-run).

   If the working tree has changes:

   ```bash
   git add -A
   git commit -m "<type>(<scope>): <imperative summary>" -m "" -m "Closes <IDENTIFIER>"
   ```

   Conventional commit, matching the repo's existing style (`git log --oneline -10` if unsure). The `Closes <IDENTIFIER>` trailer is mandatory - Linear auto-closes the issue on default-branch merge.

   Then push:

   ```bash
   git push
   ```

   If the branch has no upstream yet, fall back to `git push -u origin HEAD`. If the push fails (rejected non-fast-forward, network, hook failure, etc.), STOP and surface the error - do not close the Linear issue, do not tick the plan to `[x]`. The task stays `[~]` (now with a local commit) and the user resolves the push issue before the next `/go next`.

   Never use `--no-verify` or `--force` to "fix" a push failure. Diagnose root cause.

5. Once the push succeeds, close + archive the Linear issue:

   ```bash
   python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issue uuid> completed --archive
   ```

   `--archive` is **mandatory** here: it triggers `issueArchive` so the issue leaves the user's active list immediately (the user cares about WIP/active counts, see Rule 7).

   If the call fails, STOP and surface - do not start a new task while Linear is out of sync.

6. Update `plan.md`: replace this task's `[~]` with `[x]` and append the commit short SHA:

   ```
   - [x] NEXT-123 [P1-01] Add port allocator state to R2 - abc1234
   ```

### Phase 3 - Pick the first unstarted task (`[ ]`)

1. Parse `plan.md`, find the first line matching `^- \[ \] <IDENTIFIER> \[P\d+-\d+\] .*$` **that does NOT start with `- [ ] ⚠ `** (blocked tasks are skipped, see Rule 14).
2. Extract the identifier (e.g. `NEXT-123`).
3. Look up the matching entry in `tasks.json` by identifier - that gives the issue UUID, full description, step, etc.
4. If no pickable `[ ]` tasks remain:
   - If at least one `- [ ] ⚠ ` blocked task is left → tell the user the phase is **stalled on blocked tasks**, list them with their reasons, and STOP. Do not declare the phase complete.
   - Else if Phase 2 closed a `[~]` task → tell the user the phase is **complete** (last task validated, `/go` for the next phase) and STOP.
   - Else (Phase 2 was a no-op too) → the phase was already complete; remind the user and STOP.

### Phase 4 - Mark In Progress in Linear

```bash
python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issue uuid> started
```

If this fails, STOP and surface the error - do not start coding while Linear is out of sync.

### Phase 5 - Implement the task

Read the description (WHAT / WHY / WHERE / DONE WHEN) and execute. Stay strictly within the task's scope - no "while I'm here". If the task description mixes multiple concepts, that's a `/backlog` bug: STOP and surface it (do not paper over).

### Phase 6 - Verify

Run typecheck / tests / lint / build appropriate to the repo. If `/nextnode-standards` applies, run those exact commands. Do NOT skip verification on a "trivial" change.

**Keep verification output small.** Pipe noisy runs through `tail -40` (or `--reporter=basic` / `--silent` for Vitest). Pass/fail summary is what matters.

### Phase 7 - Leave working tree dirty (no commit)

**Do NOT commit.** The implementation is done; the working tree now carries the task's diff. Leave it that way - the user reviews the diff before the next `/go next`, and *that* run creates the commit + pushes it (see Phase 2).

If you're tempted to commit "for safety" or "to back up the work" - don't. Working-tree-only is the contract: it makes the diff trivial to review (`git diff`), trivial to amend (just edit + save), and trivial to discard (`git restore`) if the user rejects the work.

### Phase 8 - Tick the plan as `[~]`

Update `plan.md`: replace the `[ ]` of this task with `[~]`:

```
- [~] NEXT-123 [P1-01] Add port allocator state to R2
```

The `[~]` marker means: *implemented, working-tree changes pending, NOT committed, NOT pushed, Linear In Progress, awaiting user validation.* The next `/go next` will commit + push it and close the Linear issue.

### Phase 9 - Report and STOP

Print, in 3-4 lines:

- `Closed: <IDENTIFIER> <title> - <sha> (committed + pushed)` (only if Phase 2 committed + pushed + archived a previous task; otherwise omit)
- `Implemented: <IDENTIFIER> <title> (working tree dirty, NOT committed - review the diff)`
- `Next up: <next IDENTIFIER> <next title>` (or `Last task of phase - next /go next will commit + push it.` if none left)
- `→ review the diff, then /go next`

Then STOP. Do **not** call `/go next` recursively. Do **not** auto-continue. The user comes back when ready.

If the task got blocked mid-implementation (waiting on input, ambiguous spec, dependency missing), STOP, **revert any partial work** if it cannot stand alone (`git stash` or `git restore`), mark the task in `plan.md` as blocked (`- [ ] ⚠ <ID> ... - <reason>`), and surface the question. Do not leave half-work in the tree just to "make progress".

---

## Bundled helpers

- `fetch_phases.py <projectId> [--phase N]` - lists open issues grouped by `[P{N}-{step}]` prefix. `--phase N` narrows printed output to one phase.
- `set_state.py <issueId> <state_type> [--archive]` - state_type ∈ `{backlog, unstarted, started, completed, canceled}`; `--archive` also calls `issueArchive`. Used by Phase 4 (`started`) and Phase 2 (`completed --archive`).

Both read `LINEAR_API_KEY` (no `Bearer ` prefix), use `urllib` only.

---

## Rules

1. **`/go next` does at most ONE close + ONE start per invocation.** Phase 2 closes a single `[~]` (commits + pushes + archives), Phase 3-8 starts a single `[ ]` (implements, leaves working tree dirty). Never two starts. After Phase 9, STOP - let the user trigger the next one.
2. **No auto-chaining.** Do not call `/go next` from within a `/go next` run. The user types `/go next` again when ready; that is the contract that protects token cost.
3. **The plan file + `tasks.json` are the source of truth.** Linear is the durable store; `plan.md` is the working checklist; `tasks.json` is cached descriptions. Do not refetch Linear on `/go next` unless `tasks.json` is missing or corrupt.
4. **Sanity-check cwd in `/go next`.** Slug mismatch → refuse, do not implement in the wrong repo. All scratch in `/tmp/claude/go-<slug>-p<N>-<timestamp>/`.
5. **At most one `[~]` task at a time.** Multiple `[~]` lines = bug; STOP and surface. If any Linear state call fails, stop and surface - never leave Linear out of sync.
6. **No half-implementations on block.** If a task can't be completed cleanly, revert partial work (`git stash` / `git restore`) and mark blocked in `plan.md`. Never leave a stub in the working tree just to tick the box - the next `/go next` would commit it.
7. **A `/go` task NEVER touches a Claude skill.** If a task's `WHERE` resolves to `~/.claude/skills/...` or `~/.stow_repository/claude/.claude/skills/...`, the issue is a `/backlog` bug - refuse to implement, surface to the user, propose canceling the Linear issue. Skills live in a separate repo (`mac-config`) and must never be NextNode deliverables.
8. **No commit and no push after Phase 7.** `/go next` MUST NOT commit or push after implementing the current task. The only `git commit` + `git push` allowed in a `/go next` run is Phase 2, which packages the *previously-validated* `[~]` task's working-tree changes into a commit, pushes, and closes it in Linear. If you implemented in Phase 5-6 and feel the urge to commit "to lock it in" - stop. The dirty working tree is the contract; the user reviews + may amend before the next `/go next` commits it.
