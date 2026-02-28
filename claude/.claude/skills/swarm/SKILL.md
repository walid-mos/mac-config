---
name: swarm
description: Orchestrate a team of specialized agents to autonomously complete development tasks
user-invocable: true
argument-hint: [task description]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Skill, AskUserQuestion
---

# Swarm Skill — Launcher

This skill is a thin launcher. It prepares context (spec, worktree, skills), invokes the `swarm` CLI, and creates a PR when it finishes.

**You do NOT orchestrate the work yourself.** You prepare inputs, run the CLI, and handle post-completion actions.

**Architecture**: `swarm` is a TypeScript CLI (`scripts/.local/bin/swarm`) that handles all orchestration — phase sequencing (plan → tdd → code → review → commit → docs), agent invocation via drivers (claude/opencode), state persistence, TOML config resolution, and tech stack detection. Configuration lives in `swarm.toml` at the project root, `~/.config/swarm/default.toml`, or built-in defaults.

## CRITICAL — NEVER STOP MID-FLOW

`/swarm` is an end-to-end pipeline: interview → spec → worktree → `swarm run` → PR. **You MUST execute Steps 1 through 5 in a single invocation.** If `/interview` runs in Step 2d, that is NOT the end — it is the beginning. The moment the interview produces a spec file, you MUST continue to Step 2e → Step 3 → Step 4 → Step 5. Stopping after the interview is a critical failure.

## Argument Parsing

The user invokes `/swarm <free-form task description>`.

Derive a **date-prefixed kebab-case** session name from the description. Prefix: today's date as `YYMMDD` (6 digits, no separators), then a hyphen, then the kebab-case slug. Must match `/^[a-zA-Z0-9_-]{1,64}$/`.

Examples (assuming today is 2026-02-28):
- `/swarm add user authentication with OAuth` → `260228-add-user-auth`
- `/swarm refactor the payment module` → `260228-refactor-payment-module`

## Step 1 — Gather Context

Perform 1a through 1c in parallel. **Step 1 is READ-ONLY** — no files are created or modified.

### 1a. Spec Detection

1. Glob `docs/specs/*.spec.md`
2. Read any matching specs that relate to the task description
3. Classification: `found` or `not-found`
4. If `found`, store spec content for later qualification (Step 2d)

### 1b. Record Base Branch and Project Directory

Run `git branch --show-current` → store as `baseBranch`. Store `pwd` → `projectDir`.

### 1c. Skill Resolution (CRITICAL)

Scan the task description for explicit `/skillname` references (e.g., `/nextnode-standards`, `/typescript`). These are **binding standards** the swarm MUST follow.

For each detected skill reference:

1. **Load the skill** via the `Skill` tool
2. **Read the skill file**: glob `~/.claude/skills/<skillname>/SKILL.md`
3. **Resolve dependent skills** recursively (max depth 2)
4. Store as `resolvedSkills: { skillName: fullContent }`

**If a referenced skill contains an audit procedure**: run it NOW against the current project state. Store as `skillAuditResults`.

**Why this matters**: Sub-agents invoked by the CLI do NOT have access to the Skill tool. The only way skill content reaches them is if the launcher writes it to a well-known location they can read.

After gathering all skills, write them to `$TMPDIR/swarm-<session-name>-skills.json`:

```json
{
  "resolvedSkills": { "<skillName>": "<fullContent>", ... },
  "skillAuditResults": { "<skillName>": "<auditOutput>", ... }
}
```

## Step 2 — Create Worktree

### 2a. Verify `wt` is available

```bash
type wt
```

If not found, fall back to `git checkout -b feat/<session-name>` and warn the user that parallel swarms won't be isolated.

### 2b. Create the worktree

```bash
wt new feat/<session-name> -y
```

### 2c. Record the worktree path

Store `pwd` (after `wt new`) as `worktreePath`.

### 2d. Spec Qualification (in worktree — depends on 1a)

**All file creation happens here, inside the worktree.**

#### Case 1: No spec found

`/interview` is **MANDATORY**:

```
Skill: interview
Args: <task description>
```

Wait for completion. Read the produced spec file → `specPath`.

**CRITICAL: Continue immediately to Step 2e. Do not stop.**

#### Case 2: Spec found

Assess completeness:
1. Has Functional Requirements (FR-* items)
2. Has Acceptance Criteria
3. No Open Questions
4. Covers the task scope

**If ALL pass**: use existing path → `specPath`

**If ANY fail**: invoke `/interview` in deepen mode:

```
Skill: interview
Args: <task description> — deepening existing spec at <spec path>
```

Read the updated file → `specPath`

### 2e. Prepare spec files and initial commit

1. `mkdir -p docs/swarm/<session-name>/`
2. Copy spec to `docs/swarm/<session-name>/spec.md`
3. Prepend processing banner to the original spec via Edit:
   ```
   <!-- PROCESSED BY SWARM: <session-name> — <ISO-8601 timestamp> -->
   ```
4. Stage and commit:
   ```
   docs(<session-name>): add spec

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```

## Step 3 — Run the Swarm CLI

### 3a. Verify the binary

```bash
swarm --version
```

If not in PATH, try the development path: `<projectDir>/scripts/.local/bin/swarm --version`.

### 3b. Invoke `swarm run`

Run via `Bash(run_in_background: true)`:

```bash
swarm run \
  --session "<session-name>" \
  --spec "<specPath>" \
  --project-dir "$(pwd)"
```

Add `--config "<path>"` only if a non-default config path is needed.

Use `Bash(timeout: 600000)` — swarm runs can take up to 10 minutes.

### 3c. Handle exit

- **Exit 0 — Success**: all phases completed. Proceed to Step 4.
- **Non-zero — Failure**: read stderr. Present error to user via `AskUserQuestion` with options: retry, abort, or investigate.

To resume after failure:

```bash
swarm resume \
  --session "<session-name>" \
  --project-dir "$(pwd)"
```

## Step 4 — Validate Results

1. Read `docs/swarm/<session-name>/delivery-report.md`
2. Verify every iteration has review, test, and build evidence
3. **Skill compliance** (if `resolvedSkills` non-empty): re-run the audit from Step 1c against the current state. Every FAIL/MISSING item from the original audit must now be PASS. If not:
   - Do NOT proceed to Step 5
   - Re-run with `swarm resume`
4. Optionally check state at `$TMPDIR/swarm-<session-name>-state.json` for completion details

## Step 5 — Pull Request Creation

### 5a. Push and create PR

1. `git push -u origin feat/<session-name>`
2. Read `docs/swarm/<session-name>/delivery-report.md` for PR body
3. Create PR:

```bash
gh pr create \
  --title "feat(<session-name>): <short description>" \
  --body "$(cat docs/swarm/<session-name>/delivery-report.md)" \
  --base <baseBranch> \
  --head feat/<session-name>
```

4. Return the PR URL.

### 5b. Worktree Cleanup

If a worktree was created in Step 2:

```bash
cd <projectDir>
wt clean feat/<session-name> -y
```

## Edge Cases

- **No changes made**: do not create an empty PR — inform the user
- **PR creation fails**: show the error, provide the manual command
- **Context exhaustion**: the CLI persists state per-phase; `swarm resume` picks up where it left off

## Constraints

- **`/swarm` ALWAYS executes the full flow** — Steps 1 through 5. NEVER stop after the interview.
- **The launcher NEVER writes implementation code** — the `swarm` CLI orchestrates agents that do the work.
- Never run destructive commands: no `rm -rf`, no `git push --force`, no `git reset --hard`
- Git operations limited to: branch creation, commit, push, PR creation
- **NEVER use `sleep` to poll** — the CLI runs synchronously and exits with a status code
- Never commit secrets or credentials
