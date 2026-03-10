---
name: swarm
description: Orchestrate a team of specialized agents to autonomously complete development tasks
user-invocable: true
argument-hint: [task description]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Skill, AskUserQuestion
---

# Swarm Skill — Interview → CLI Pipeline

This skill is a thin launcher. It interviews the user to produce a spec, then invokes the `swarm` CLI which handles everything else (worktree, orchestration, PR).

**You do NOT orchestrate implementation work yourself.** You prepare the spec via interview, run the CLI, and report results.

**Architecture**: `swarm` is a TypeScript CLI (`scripts/.local/bin/swarm`) that handles all orchestration — phase sequencing (plan → tdd → code → review → commit → docs), worktree isolation, agent invocation, PR creation, state persistence, and TOML config resolution.

## CRITICAL — NEVER STOP MID-FLOW

`/swarm` is an end-to-end pipeline: interview → spec → `swarm run` → report. **You MUST execute Steps 1 through 4 in a single invocation.** The moment the interview produces a spec file, you MUST continue to run the CLI. Stopping after the interview is a critical failure.

## Argument Parsing

The user invokes `/swarm <free-form task description>`.

Derive a **date-prefixed kebab-case** session name from the description. Prefix: today's date as `YYMMDD` (6 digits, no separators), then a hyphen, then the kebab-case slug. Must match `/^[a-zA-Z0-9_-]{1,64}$/`.

Examples (assuming today is 2026-02-28):
- `/swarm add user authentication with OAuth` → `260228-add-user-auth`
- `/swarm refactor the payment module` → `260228-refactor-payment-module`

## Step 1 — Gather Context

Perform 1a and 1b in parallel. **Step 1 is READ-ONLY** — no files are created or modified.

### 1a. Record Project Info

Run `git branch --show-current` → store as `baseBranch`. Store `pwd` → `projectDir`.

### 1b. Skill Resolution (if applicable)

Scan the task description for explicit `/skillname` references (e.g., `/nextnode-standards`, `/typescript`). These are **binding standards** the swarm MUST follow.

For each detected skill reference:

1. **Load the skill** via the `Skill` tool
2. **Read the skill file**: glob `~/.claude/skills/<skillname>/SKILL.md`
3. **Resolve dependent skills** recursively (max depth 2)
4. Store as `resolvedSkills: { skillName: fullContent }`

**If a referenced skill contains an audit procedure**: run it NOW against the current project state. Store as `skillAuditResults`.

After gathering all skills, write them to `$TMPDIR/swarm-<session-name>-skills.json`:

```json
{
  "resolvedSkills": { "<skillName>": "<fullContent>", ... },
  "skillAuditResults": { "<skillName>": "<auditOutput>", ... }
}
```

If no `/skillname` references are found, skip this step entirely.

## Step 2 — Interview → Spec

The interview is **always** run. It handles existing spec detection internally (deepen vs new vs replace).

### 2a. Invoke `/interview`

```
Skill: interview
Args: <task description>
```

The interview skill will:
1. Check for existing specs at `docs/specs/*.spec.md`
2. Conduct a deep interactive interview
3. Write the final spec to `docs/specs/<feature-name>.spec.md`

### 2b. Locate the Spec File

After the interview completes, find the generated spec:

1. Glob `docs/specs/*.spec.md` — sort by modification time (most recent first)
2. The most recently modified spec is the one just produced → `specPath`
3. Read `specPath` to verify it has FR-* items and acceptance criteria

**CRITICAL: Continue immediately to Step 3. Do not stop.**

## Step 3 — Run the Swarm CLI

### 3a. Verify the binary

```bash
swarm --version
```

If not in PATH, try: `<projectDir>/scripts/.local/bin/swarm --version`.

### 3b. Commit the spec before running

The spec must be committed so the CLI's worktree has access to it:

```bash
git add <specPath>
git commit -m "$(cat <<'EOF'
docs(<session-name>): add spec for swarm run

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### 3c. Invoke `swarm run`

Run via `Bash(run_in_background: true)`:

```bash
swarm run \
  --session "<session-name>" \
  --spec "<specPath>" \
  --project-dir "<projectDir>"
```

Add `--config "<path>"` only if a non-default config path is needed.

Use `Bash(timeout: 600000)` — swarm runs can take up to 10 minutes.

**What the CLI does internally:**
- Creates a git worktree (`swarm/<session-name>` branch)
- Runs phases: plan → code (with TDD/review/commit per wave) → docs
- Opens a draft PR, marks it ready when done
- Pushes to remote
- Cleans up the worktree on exit

### 3d. Handle exit

- **Exit 0 — Success**: proceed to Step 4.
- **Non-zero — Failure**: read stderr. Present error to user via `AskUserQuestion` with options: retry, abort, or investigate.

To resume after failure:

```bash
swarm resume \
  --session "<session-name>" \
  --project-dir "<projectDir>"
```

## Step 4 — Report Results

### 4a. Read CLI Output

The CLI outputs the PR URL and session summary. Parse the output for:
- PR URL (the CLI creates the PR itself)
- Session state at `$TMPDIR/swarm-<session-name>-state.json`

### 4b. Skill Compliance (if applicable)

If `resolvedSkills` is non-empty: re-run the audit from Step 1b against the current state. Every FAIL/MISSING item from the original audit must now be PASS. If not:
- Inform the user of remaining failures
- Suggest running `swarm resume` to fix

### 4c. Present Results

Report to the user:
- PR URL
- Brief summary of what was implemented
- Any skill compliance results

## Edge Cases

- **No changes made**: the CLI won't create a PR — inform the user
- **Context exhaustion**: the CLI persists state per-phase; `swarm resume` picks up where it left off
- **Spec already exists**: the interview skill handles this (offers deepen/new/replace options)

## Constraints

- **`/swarm` ALWAYS executes the full flow** — Steps 1 through 4. NEVER stop after the interview.
- **The launcher NEVER writes implementation code** — the CLI orchestrates agents that do the work.
- **The launcher NEVER creates worktrees or PRs** — the CLI handles both internally.
- Never run destructive commands: no `rm -rf`, no `git push --force`, no `git reset --hard`
- **NEVER use `sleep` to poll** — the CLI runs synchronously and exits with a status code
- Never commit secrets or credentials
