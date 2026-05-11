---
name: go
user-invocable: true
argument-hint: "[next | <phase-number>]"
description: >-
  Ship a Linear backlog phase one task at a time. Use when the user runs
  `/go` (setup mode: pick a phase, write plan.md + tasks.json) or `/go next`
  (next mode: validate the previous task, start the next one, commit, push,
  stop). Companion to `/backlog` - the user paces validation, one
  `/go next` = one task shipped.
---

# go

Companion to `/backlog`. Where `/backlog` plans and creates the Linear issues, `/go` runs them.

Two modes:

| Invocation              | What it does                                                                |
|-------------------------|-----------------------------------------------------------------------------|
| `/go`                   | Setup mode - fetch open phases, ask which one, write `plan.md` + `tasks.json`, hand off. |
| `/go <phase-number>`    | Setup mode for a specific phase number - skip the question.                 |
| `/go next`              | Next mode - validate the previous task (Done + archive) if any, then start the next one (In Progress + implement + commit + push). One task per call, then STOP. |

The user paces the work. `/go next` is the explicit "validate the last and start the next one" trigger; the skill never chains tasks on its own. That keeps per-task token cost on the user's terms (one `/go next` = one normal Claude turn, no marathon loops, cache stays warm between turns).

### Plan checkbox states

`plan.md` uses three states for each task line:

| Marker        | Meaning                                                                        |
|---------------|--------------------------------------------------------------------------------|
| `[ ]`         | Not started.                                                                   |
| `[ ] ⚠ ... - <reason>` | Blocked. Skipped by `/go next` and `goloop` until unblocked. Linear stays unstarted (or whatever state the user moves it to). |
| `[~]`         | Implemented + committed + pushed; Linear is **In Progress**, awaiting user validation. |
| `[x]`         | User validated the dev on the previous `/go next`; Linear is **Done + archived**. |

A task moves `[ ]` → `[~]` at the end of the `/go next` that ships it, then `[~]` → `[x]` at the *start* of the following `/go next` (after the user has validated). The user's act of running `/go next` again is the validation signal.

## When to invoke

- Setup mode: right after `/backlog` finished, or when starting the next phase of an existing backlog.
- Next mode: whenever the user is ready to ship the next task in flight.

DO NOT use for:
- A single ad-hoc Linear issue without phase prefix.
- Cross-project sweeps.
- "Run the whole phase for me" - the user must call `/go next` explicitly per task; that's the contract.

## Arguments

- No argument → setup mode, ask which phase via `AskUserQuestion`.
- `<phase-number>` (e.g. `1`, `2`) → setup mode, skip the question.
- `next` → next-task execution mode.

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

- Next task (LLM does it): `/go next` - closes the previous `[~]` task as Done + archived, then starts the next `[ ]`.
- Set state manually: `python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issueId> started`
- Set state + archive: `python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issueId> completed --archive`
- Commit: `<type>(<scope>): <imperative title>` body ends with `Closes <IDENTIFIER>` (Linear auto-closes on default-branch merge). After commit, push to remote.

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

- **Validate previous** (if any `[~]` task exists) - close it as Done + archived in Linear, tick plan to `[x]`.
- **Start next** (if any `[ ]` task remains) - set Linear In Progress, implement, verify, commit, push, tick plan to `[~]`.

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

### Phase 2 - Validate the previous task (close any `[~]`)

1. Parse `plan.md`, find any line matching `^- \[~\] <IDENTIFIER> \[P\d+-\d+\] .* - [a-f0-9]{7,}$`.
2. If none → skip to Phase 3.
3. If one → extract the identifier, look up the issue UUID in `tasks.json`, then:

   ```bash
   python3 ~/.stow_repository/claude/.claude/skills/go/set_state.py <issue uuid> completed --archive
   ```

   `--archive` is **mandatory** here: it triggers `issueArchive` so the issue leaves the user's active list immediately (the user cares about WIP/active counts, see Rule 7).

   If the call fails, STOP and surface - do not start a new task while Linear is out of sync.

4. Update `plan.md`: replace this task's `[~]` with `[x]` (keep the rest of the line intact, including the commit SHA).
5. If MULTIPLE `[~]` lines exist → that's a bug (only one task should ever be in flight). STOP and surface - do not blindly close them all.

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

**Keep verification output small.** What matters is the pass/fail summary, not the per-test logs:
- Vitest: pipe to `tail -40` (or use `--reporter=basic` / `--silent`) - the suite summary stays, the per-test `console.log` flood drops.
- Lint/typecheck: usually concise enough; if a run prints hundreds of warnings, pipe through `tail -40` too.
- A flooded verification step is the single biggest avoidable token cost in `/go next`. Don't dump 1000-line tool outputs into context just to read "all green" at the bottom.

### Phase 7 - Commit

Conventional commit, matching the repo's existing style (`git log --oneline -10` if unsure). End the body with the Linear trailer:

```
<type>(<scope>): <imperative summary>

Closes <IDENTIFIER>
```

The trailer is mandatory - Linear auto-closes the issue on default-branch merge when it lands.

### Phase 8 - Push to remote

```bash
git push
```

If the branch has no upstream yet, fall back to `git push -u origin HEAD`. If the push fails (rejected non-fast-forward, network, hook failure, etc.), STOP and surface the error - do not tick the plan, do not pretend the task shipped. The Linear state stays In Progress; on the next `/go next` Phase 2 will be a no-op (no `[~]` tick yet) and Phase 3 will re-pick the same task once the user resolves the push issue.

Never use `--no-verify` or `--force` to "fix" a push failure. Diagnose root cause.

### Phase 9 - Tick the plan as `[~]`

Update `plan.md`: replace the `[ ]` of this task with `[~]` and append the commit short SHA:

```
- [~] NEXT-123 [P1-01] Add port allocator state to R2 - abc1234
```

The `[~]` marker means: *implemented + committed + pushed, Linear In Progress, awaiting user validation.* The next `/go next` will close it.

### Phase 10 - Report and STOP

Print, in 3-4 lines:

- `Closed: <IDENTIFIER> <title>` (only if Phase 2 archived a previous task; otherwise omit)
- `Started: <IDENTIFIER> <title> - <commit-sha> (pushed)`
- `Next up: <next IDENTIFIER> <next title>` (or `Last task of phase - next /go next will validate it.` if none left)
- `→ /go next` (when ready, after validating the dev)

Then STOP. Do **not** call `/go next` recursively. Do **not** auto-continue. The user comes back when ready.

If the task got blocked mid-implementation (waiting on input, ambiguous spec, dependency missing), STOP, **revert any partial work** if it cannot stand alone (`git stash` or `git restore`), mark the task in `plan.md` as blocked (`- [ ] ⚠ <ID> ... - <reason>`), and surface the question. Do not commit half-work just to "make progress".

---

## Bundled helpers

### `fetch_phases.py <projectId> [--phase N]`

Queries Linear for issues in the project where `state.type ∉ {completed, canceled}`. Parses `[P{N}-{step}]` prefixes, groups by phase, sorts. Outputs JSON. See file docstring for schema.

`--phase N` filters the printed output to only that phase. Use it whenever the phase number is already known (e.g. `/go 3` → `--phase 3`) - it avoids dumping every other phase's full descriptions into context.

### `set_state.py <issueId> <state_type> [--archive]`

`<state_type>` ∈ `{backlog, unstarted, started, completed, canceled}`. Picks the canonical state of the matching type in the issue's team (preferring `In Progress` over siblings like `In Review`, `Done` over `Duplicate`, etc.) and calls `issueUpdate`. Exits 0 on success, 1 on failure.

`--archive` (optional): after the state update, also call `issueArchive` so the issue leaves the workspace's active list immediately. `/go next` Phase 2 always passes this flag when closing a `[~]` task - the user wants completed tasks out of their active list right away, not on Linear's auto-archive delay.

Used by `/go next` (Phase 4 with `started`, Phase 2 with `completed --archive`). Also callable manually from a terminal.

Both scripts read `LINEAR_API_KEY` from env, reject `Bearer ` prefix, use `urllib` only (no `pip install`).

---

## Rules

1. **Setup mode stops at hand-off.** No per-task work, no implementation.
2. **`/go next` does at most ONE close + ONE start per invocation.** Phase 2 closes a single `[~]`, Phase 3-9 starts a single `[ ]`. Never two starts. After Phase 10, STOP - let the user trigger the next one.
3. **No auto-chaining.** Do not call `/go next` from within a `/go next` run, do not "since I'm here, also do the next one". The user types `/go next` again when ready; that is the contract that protects token cost.
4. **The plan file + `tasks.json` are the source of truth.** Linear is the durable store; `plan.md` is the working checklist; `tasks.json` is the cached descriptions for `/go next`. Do not refetch Linear on `/go next` unless `tasks.json` is missing or corrupt.
5. **All scratch in `/tmp/claude/go-<slug>-p<N>-<timestamp>/`.** Never under the repo, never under `~`.
6. **Sanity-check cwd in `/go next`.** Slug mismatch → refuse, do not implement in the wrong repo.
7. **Linear state syncs around the user's validation.** `started` BEFORE Phase 5 (implement). `completed --archive` happens at the START of the *next* `/go next` (Phase 2), once the user has had a chance to validate the dev. Archiving immediately is mandatory: the user tracks active task counts and Linear's auto-archive delay would pollute them. If any state call fails, stop and surface - never leave Linear out of sync with reality.
8. **At most one `[~]` task at a time.** A `[~]` line means "implemented + pushed, waiting for user validation". Multiple `[~]` lines = bug; STOP and surface.
9. **Atomicity is `/backlog`'s job.** Non-atomic task description encountered → stop, surface as backlog bug, do not paper over.
10. **No half-commits on block.** If a task can't be completed cleanly, revert partial work and mark blocked in `plan.md`. Never commit a stub just to tick the box.
11. **Push after every commit.** Phase 8 push is mandatory. If the push fails, do NOT tick the plan to `[~]` and do NOT mark Linear In Progress as "shipped" - the task is not done from the user's POV until the commit is on the remote.
12. **Mandatory `Closes <ID>` trailer.** Linear's GitHub integration relies on it for auto-close on merge. Without the trailer, the Linear `completed` state we set in Phase 2 will look detached from history.
13. **A `/go` task NEVER touches a Claude skill.** If a task's `WHERE` resolves to `~/.claude/skills/...` or `~/.stow_repository/claude/.claude/skills/...`, the issue is a `/backlog` bug - refuse to implement, surface to the user, and propose canceling the Linear issue. Skills are personal tooling in a separate repo (`mac-config`) and must never be deliverables of a NextNode project. The only acceptable place to refresh skills mid-flow is **after a phase fully closes**, as a side-task done out of band (no Linear issue, no plan tick) and only when the user explicitly asks.
14. **Blocked tasks (`- [ ] ⚠ ... - <reason>`) are skipped, not picked.** Phase 3 must scan for the first `[ ]` line that does NOT start with `- [ ] ⚠ `. The same skip applies to `goloop`'s next-task banner. A blocked task remains in the plan as a visible reminder; only the user can unblock it (edit the line back to plain `- [ ] ` or close the Linear issue). Never auto-retry a blocked task by stripping the `⚠` yourself - the block is a signal, not a bug to paper over.
