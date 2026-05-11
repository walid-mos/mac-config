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

This skill complements `/nextnode-linear` - it APPLIES those conventions (atomicity, `[P{N}-{step}]` phase prefix, project mapping, detached execution) to the specific workflow of "plan → backlog".

## Arguments

- `$ARGUMENTS` (optional) - path to a plan file. If omitted, use the plan from the current conversation context.

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

## Rules

1. **Never push to Linear without confirmation.** Phase 4 generates JSON, Phase 5 needs the user's go.
2. **Always launch detached.** No inline polling. The user pings back for status; only then run `tail`.
3. **Atomicity is non-negotiable.** No "and" / "et" / "+" / "puis" in titles. If you cannot describe the task in one imperative verb phrase, split it.
4. **The worker is the single source of truth for the `[P{N}-{step}]` prefix.** Do NOT pre-prefix titles in the JSON. All scratch in `/tmp/claude/backlog-<slug>-<timestamp>/`.
5. **NEVER create a Linear task that updates a Claude skill.** Anything whose `WHERE` points at `~/.claude/skills/...` or `~/.stow_repository/claude/.claude/skills/...` is hard-banned - personal tooling, lives in a separate repo (`mac-config`). Drop these tasks entirely.
