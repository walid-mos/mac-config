---
name: backlog
description: >-
  Build a Linear backlog from a plan that emerged from a Claude ↔ user
  discussion. Splits the plan into atomic issues organized by phase,
  generates a tasks.json bundle, then runs a bundled idempotent Python
  worker DETACHED so the conversation does not burn tokens waiting on N
  HTTP round-trips. Load when the user wants to turn a plan, design doc,
  audit, or roadmap into a Linear backlog of actionable issues -
  typically right after a planning conversation.
user-invocable: true
argument-hint: "[path to plan file]"
---

# backlog

Take a plan we just discussed → fan it out into an atomic Linear backlog, grouped by phase, on the right project. The model drafts the structured JSON; a bundled Python worker creates the issues idempotently in the background.

This skill complements `/nextnode-linear` - it APPLIES those conventions (atomicity, `[P{N}-{step}]` phase prefix, project mapping, detached execution) to the specific workflow of "plan → backlog".

## When to invoke

- Right after a planning / interview / audit conversation that produced a numbered roadmap.
- When the user says "envoie ça dans Linear", "génère les tâches", "découpe ce plan en issues".
- When the user pastes or points at a plan file (`.md`, conversation excerpt, audit doc).

DO NOT use for:
- A single one-shot issue → just call `issueCreate` directly via `/nextnode-linear`.
- Recurring task templates → not what Linear projects are for.
- Cross-project initiatives → load `/nextnode-linear` and use `initiativeCreate` first.
- **Anything under `~/.claude/skills/` or `~/.stow_repository/claude/.claude/skills/`** - Claude skills are personal tooling, not project deliverables. They never belong in a Linear backlog. See Rule 11.

## Arguments

- `$ARGUMENTS` (optional) - path to a plan file (e.g. `/Users/.../plan.md`). If omitted, use the plan from the current conversation context.

## Workflow

Execute the phases below in order. Stop and confirm with the user between Phase 4 and Phase 5 - never push to Linear without an explicit go.

### Phase 1 - Load context

1. **Read `/nextnode-linear` workspace map** (`~/.stow_repository/claude/.claude/skills/nextnode-linear/workspace.md`) to know team IDs, project IDs, and naming conventions.
2. **Load the plan**:
   - If `$ARGUMENTS` is a file path → `Read` it.
   - Otherwise → use the planning thread already in context (the user's previous turn, the latest large markdown the assistant produced, etc.).
3. **Verify `LINEAR_API_KEY`** is set: `test -n "$LINEAR_API_KEY"`. If not, REFUSE and tell the user to set it (see `/nextnode-linear api`).

### Phase 2 - Identify the target project

Match the plan's subject to a Linear project from `workspace.md`:

- Plan mentions `core/packages/<x>` → the matching `NextNode <X>` project (INT team).
- Plan mentions a product name (YSumAI, Kicked, Adiffi, NextNode Landing) → the SAS project of that name.
- Plan mentions a client → the CLI project.
- Plan covers infra/deploy/CI/Hetzner/Cloudflare → `NextNode Infrastructure`.
- Plan is multi-repo → ask the user; we likely need an Initiative (out of scope here, redirect to `/nextnode-linear`).

If ambiguous, load `AskUserQuestion` via `ToolSearch query="select:AskUserQuestion"` and ask the user to pick the project from the candidate list.

Resolve and remember:
- `projectId` (UUID from workspace.md)
- `teamId` (UUID from workspace.md, derived from the project's team)
- A short slug for the temp directory, e.g. `infra`, `monitoring`.

### Phase 3 - Break the plan into phases + atomic tasks

Apply `/nextnode-linear` Rule 2 (atomicity) and Rule 3 (phase naming) ruthlessly:

1. **Identify phases** from the plan's structure. The plan often labels them itself (`Phase A/B/C/D`, `Étape 1/2/3`, `1./2./3.`, an explicit table). Use those when present. Otherwise group tasks by dependency boundaries.
2. **Number phases starting at 1** (reserve `0` for setup/scaffolding tasks that pre-exist or are foundational and not in the plan itself). Phase numbers are integers.
3. **Each task = one PR.** No `and` / `et` / `+` / `puis` / `,` in titles. If the plan describes "do X and Y", split into 2 tasks. If a task feels >1 day of work or >300 changed lines, split it further.
4. **Phase size is flexible** - 5 tasks or 30 tasks, both are fine, as long as each task is atomic and the grouping is logical (same module, same dependency layer, same migration step).
5. **Title format**: titles are short imperative sentences, NO `[P{N}-{step}]` prefix in the JSON - the worker script adds it automatically based on phase number + task index.
   - GOOD: `Add port allocator state to R2`
   - BAD: `[P1-01] Add port allocator state to R2` (worker adds the prefix)
   - BAD: `Implement port allocation and persistence` (two concepts → split)
6. **Description** is mandatory and self-contained:
   - WHAT to do (one sentence)
   - WHY (one sentence linking to the plan's reasoning)
   - WHERE in the codebase (file paths if known)
   - DONE WHEN (acceptance criteria, ≤ 3 bullets)

Quoting / formatting in description: plain markdown is fine, Linear renders it. Avoid HTML, avoid raw URLs without anchor text.

### Phase 4 - Generate `tasks.json`

Write to `/tmp/claude/backlog-<slug>-<timestamp>/tasks.json` using the schema below. Use `mkdir -p` first.

```json
{
  "project_id": "01860302-1e60-4876-ac21-c2c512be5616",
  "team_id": "113334ef-299c-4929-85ae-c78cc49972ce",
  "default_priority": 3,
  "phases": [
    {
      "number": 1,
      "name": "Multi-apps support",
      "tasks": [
        {
          "step": "01",
          "title": "Add port allocator state to R2",
          "description": "...",
          "priority": 2
        },
        {
          "step": "02",
          "title": "Allocate host port on first deploy of a project",
          "description": "..."
        }
      ]
    }
  ]
}
```

Schema rules:

| Field | Required | Notes |
|---|---|---|
| `project_id` | yes | UUID from `workspace.md` |
| `team_id` | yes | UUID matching the project's team |
| `default_priority` | no | Linear int (0=none, 1=urgent, 2=high, 3=medium, 4=low). Default `3` |
| `phases[].number` | yes | Integer phase number (≥ 0) |
| `phases[].name` | yes | Short phase label, used in summary log only |
| `phases[].tasks[].step` | yes | 2-digit zero-padded string (`"01"` … `"99"`) |
| `phases[].tasks[].title` | yes | Atomic, imperative, NO `[P*]` prefix |
| `phases[].tasks[].description` | yes | Multi-line markdown |
| `phases[].tasks[].priority` | no | Overrides `default_priority` per task |

After writing, **show the user a preview**:

- `Project: <name> (id ...)` (resolved from workspace.md)
- One bullet per phase: `Phase N - <name> - X tasks`
- Total task count
- Path to the generated `tasks.json`

Then ask for explicit confirmation: "Lance le worker en détaché ?" - wait for `oui` / `go` / `yes` before Phase 5.

### Phase 5 - Copy worker + launch detached

This phase MUST follow `/nextnode-linear` Rule 10 (no inline waits).

```bash
TASK_DIR="/tmp/claude/backlog-<slug>-<timestamp>"
cp ~/.stow_repository/claude/.claude/skills/backlog/create_issues.py "$TASK_DIR/create_issues.py"

nohup python3 -u "$TASK_DIR/create_issues.py" "$TASK_DIR/tasks.json" \
  > "$TASK_DIR/run.log" 2>&1 &
disown
echo "Started PID $!"
```

The launch command MUST exit immediately. Do NOT pipe to `tee`/`tail`, do NOT chain `wait`, do NOT poll in a loop.

### Phase 6 - Hand off

Tell the user, in one short message:

- `Worker lancé en détaché (PID <pid>).`
- `Log: tail -50 <TASK_DIR>/run.log`
- `Tasks écrites: grep -c '^OK ' <TASK_DIR>/run.log`
- `Quand tu veux le rapport final, lance tail.`

Then STOP. Do not poll, do not sleep-then-tail. The user comes back when ready.

If the user comes back later asking "où ça en est", THEN run a single `tail -50 <log>` (cheap, returns instantly) - never a `sleep N && tail` chain.

## How the worker (`create_issues.py`) behaves

- **Idempotent by title**: queries Linear for issues in the target project, builds a set of existing titles (with `[P{N}-{step}] ` prefix), and skips any task whose generated title is already present. Re-runs are safe.
- **Worker pool**: 8 concurrent threads (matches the rate limit headroom Linear gives personal API keys).
- **Structured logs**: each task emits exactly one line:
  - `OK <identifier> [P1-01] Add port allocator` - created
  - `SKIP [P1-01] Add port allocator - already exists`
  - `FAIL [P1-01] Add port allocator - <error>`
- **Final line**: `Done - created=N skipped=M failed=K`. `grep -c '^OK '`, `grep -c '^FAIL '`, `grep '^Done'` give the user a sub-second status check.
- **Exit code**: `0` if `failed=0`, else `1`. Useful for chaining other automation.

## Rules

1. **Never push to Linear without confirmation.** Phase 4 generates JSON, Phase 5 needs the user's go. Skipping confirmation is a hard violation.
2. **Always launch detached.** Even for a 5-task plan - the cost difference is negligible, the discipline avoids accidents on larger plans.
3. **Atomicity is non-negotiable.** No "and" / "et" / "+" / "puis" in titles. If you cannot describe the task in one imperative verb phrase, split it.
4. **Phase numbers are integers ≥ 0.** `"P1.5"` and `"P1a"` are FORBIDDEN. If you need a sub-phase, it is actually a new phase - renumber.
5. **Step indices are zero-padded 2-digit strings.** `"01"` not `1`, `"15"` not `"15 "`. The worker validates this.
6. **Re-running with the same JSON is safe.** Idempotency by title means a partial failure can be resumed by re-launching the same script - no manual cleanup, no duplicates.
7. **The temp dir lives at `/tmp/claude/backlog-<slug>-<timestamp>/`.** Never write under the project repo, never under `~`. Sandbox-safe and easy to clean up.
8. **No inline polling.** After launching, hand off. The user pings back when they want a status; that is when (and only when) you run `tail`.
9. **`LINEAR_API_KEY` is read from the environment by the worker.** Never inline it into the JSON, never log it, never echo it.
10. **The worker is the single source of truth for the `[P{N}-{step}]` prefix.** Do NOT pre-prefix titles in the JSON - the worker formats them. This keeps the JSON re-usable and the prefix logic centralized.
11. **NEVER create a Linear task that updates a Claude skill.** Anything whose `WHERE` points at `~/.claude/skills/...`, `~/.stow_repository/claude/.claude/skills/...`, or any other personal Claude tooling path is hard-banned from the backlog - these are personal dev tools, not deliverables of a NextNode package, and they live in a separate repo (`mac-config`) on a per-user dotfiles branch. If a planning conversation produces a "document this in the skill" item, drop it from the JSON entirely. At most, skill sync is a side-task `/go` may handle when closing a phase (out of band, never tracked in Linear). When in doubt, drop the task and tell the user "skill update skipped - out of scope for the backlog".
