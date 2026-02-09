---
name: swarm
description: Orchestrate a team of specialized agents to autonomously complete development tasks
user-invocable: true
argument-hint: [task description]
allowed-tools: Task, Read, Glob, Grep, Write, Edit, Bash, Skill, AskUserQuestion
---

# Swarm Skill — Launcher

This skill is a thin launcher. It prepares the context, spawns the **Lead Agent** via `Task`, and handles PR creation when the Lead Agent finishes.

**You do NOT orchestrate the work yourself.** You prepare inputs, spawn the Lead Agent, and handle post-completion actions.

## Argument Parsing

The user invokes `/swarm <free-form task description>`.

Derive a kebab-case session name from the description for doc headers, git branch naming, and commit messages.

Examples:
- `/swarm add user authentication with OAuth` → `add-user-auth`
- `/swarm refactor the payment module` → `refactor-payment-module`
- `/swarm fix broken dark mode toggle` → `fix-dark-mode-toggle`

## Step 1 — Gather Context & Ensure Specs

Perform 1a through 1d in parallel, then run 1e (spec qualification) sequentially.

### 1a. Spec Detection

1. Glob `docs/specs/*.spec.md`
2. Read any matching specs that relate to the task description
3. Preliminary classification: `found` or `not-found`

### 1b. Tech Stack Detection

Build a `TechStack` object (see `agents/schemas/shared.md`):

- Read `package.json` (dependencies, devDependencies, scripts)
- Glob for framework config files (`astro.config.*`, `next.config.*`, `vite.config.*`, `tsconfig.json`, `tailwind.config.*`, `dagger.*`)
- Scan file extensions to identify languages in use
- Detect test runner from config or devDependencies (`vitest`, `jest`, `playwright`)
- Detect package manager from lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`)
- Detect build tool from config (`vite`, `webpack`, `turbopack`)

Result:
```
TechStack {
  languages: string[]
  frameworks: string[]
  testRunner: string | null
  packageManager: string
  buildTool: string | null
  configs: string[]         // Paths of detected config files
}
```

### 1c. Configuration

Read `.swarm.json` at project root (if it exists), merge with defaults to produce a `SwarmConfig`:

```
SwarmConfig {
  specialists: string[]                     // Default: auto-detect from tech stack
  defaultTestStrategy: "tdd-strict" | "tdd-flexible" | "configurable"  // Default: "configurable"
  autoCommit: boolean                       // Default: true
  prOnComplete: boolean                     // Default: true
  confirmExit: "auto" | "always" | "never"  // Default: "auto"
}
```

If `.swarm.json` is missing or has invalid fields, fall back to defaults. Warn about invalid specialist names but continue.

### 1d. Record the Base Branch and Project Directory

Run `git branch --show-current` and store the result as `baseBranch`. This is the branch the PR will target.

Also store `pwd` as `projectDir`. This is needed to return to the original directory after worktree cleanup in Step 5c.

### 1e. Spec Qualification (sequential — depends on 1a)

This step determines the `NormalizedSpec` that will be passed to the Lead Agent. **The Lead Agent must receive a complete, actionable spec.** The `/interview` skill is the mechanism to ensure this.

#### Case 1: No spec found (`not-found` from 1a)

**`/interview` is MANDATORY.** Invoke it immediately:

```
Skill: interview
Args: <task description>
```

Wait for the interview to complete. It will produce `docs/specs/<feature-name>.spec.md`. Read the produced file.

Result: `NormalizedSpec = { type: "full-spec", content: <file contents>, path: <file path> }`

#### Case 2: Spec found (`found` from 1a)

Read the spec and assess its completeness against these criteria:

1. **Has Functional Requirements** — at least one `FR-*` or equivalent numbered requirement
2. **Has Data Model** — entities, fields, types described (if applicable to the task)
3. **Has Acceptance Criteria** — clear, testable conditions for "done"
4. **No Open Questions** — the `## Open Questions` section is empty or absent
5. **Covers the task scope** — the spec FRs actually address the task description (not a different feature)

**If ALL criteria pass**: the spec is complete.

Result: `NormalizedSpec = { type: "full-spec", content: <file contents>, path: <file path> }`

**If ANY criteria fail**: gaps exist. Invoke `/interview` in **deepen** mode to fill them:

```
Skill: interview
Args: <task description> — deepening existing spec at <spec path>
```

The interview will enrich the existing spec via Edit. Read the updated file afterward.

Result: `NormalizedSpec = { type: "full-spec", content: <updated contents>, path: <file path> }`

After obtaining the `NormalizedSpec` (in both Case 1 and Case 2), copy the spec into the session folder and mark the original as processed:

1. Create `docs/swarm/<session-name>/` directory (via `mkdir -p`)
2. Copy the spec file to `docs/swarm/<session-name>/spec.md`
3. Prepend a processing banner to the **original** spec file using Edit:
   ```
   <!-- PROCESSED BY SWARM: <session-name> — <ISO-8601 timestamp> -->
   ```

> **Note**: After Step 1e, the `NormalizedSpec` should ALWAYS be `full-spec`. The `partial-spec` and `no-spec` types exist in the schema for edge cases (user explicitly skips interview), but the default flow always produces a full spec.

## Step 2 — Create Worktree

Create an isolated worktree for this swarm session using the `wt` function. This ensures parallel `/swarm` invocations on the same project don't conflict.

### 2a. Verify `wt` is available

```bash
type wt
```

If `wt` is not found, fall back to `git checkout -b feat/<session-name>` and warn the user that parallel swarms won't be isolated.

### 2b. Create the worktree

```bash
wt new feat/<session-name> -y
```

This will:
- Create the branch `feat/<session-name>` from current HEAD (if it doesn't exist)
- Create an isolated worktree at `~/development/worktrees/<project>-feat-<session-name>/`
- Change directory to the worktree

If the worktree already exists (resuming a session), `-y` auto-navigates to it.

### 2c. Record the worktree path

Store the worktree path (`pwd` after `wt new`) as `worktreePath` for cleanup in Step 5.

## Step 3 — Spawn the Lead Agent

Spawn the Lead Agent via `Task` with `subagent_type: "lead-agent"`.

Build the prompt as a structured `LeadAgentInput` (see `agents/schemas/lead-agent.md`):

```
## LeadAgentInput

### taskDescription
<original free-form task description>

### sessionName
<kebab-case session name>

### normalizedSpec
type: full-spec
path: <path to spec file>
content:
---
<full contents of the spec file>
---

### techStack
languages: [<detected languages>]
frameworks: [<detected frameworks>]
testRunner: <detected or null>
packageManager: <detected>
buildTool: <detected or null>
configs: [<list of detected config file paths>]

### swarmConfig
specialists: [<resolved list or "auto-detect">]
defaultTestStrategy: <resolved value>
autoCommit: <resolved value>
prOnComplete: <resolved value>
confirmExit: <resolved value>

### existingDocs
troubleshooting: <contents of docs/troubleshooting.md, or "null">
iterations: <contents of docs/swarm/<session-name>/iterations.md if resuming, or "null">

## CRITICAL INSTRUCTIONS

- You MUST complete ALL spec items before returning. Do NOT stop early.
- If you encounter a blocker, escalate via AskUserQuestion — do NOT silently stop.
- Run the full orchestration loop for EVERY iteration: Phase A (Planification + Test) → Phase B (Code + Review + Security) → Phase C (Escalation) → Phase D (Lint + Build + Commit).
- NEVER skip Code Review or Security Review — even for config-only packages, static sites, or "simple" changes. These gates are mandatory without exception.
- NEVER skip the Test Agent — every iteration MUST produce tests. For config packages, tests validate that configs are parseable and exports resolve correctly.
- Commit each validated iteration.
- Write the delivery report to docs/swarm/<session-name>/delivery-report.md before returning.
- Before returning your completion report, run the SELF-AUDIT CHECKLIST (see your agent definition). Your report will be validated against it.
- When you are done, return a structured completion report:
  STATUS: completed | partial | blocked
  COMPLETED: <N>/<total> spec items
  FILES_CHANGED: <comma-separated list>
  PENDING_ITEMS: <list or "none">
  BLOCKER: <description or "none">
  SUMMARY: <1-2 sentence summary>
```

## Step 4 — Handle Lead Agent Result

When the Lead Agent returns, parse its completion report.

### Output Validation (mandatory — before proceeding to Step 5)

Before accepting the Lead Agent's result, validate the delivery report:

1. Read `docs/swarm/<session-name>/delivery-report.md`
2. Check the "Per-Iteration Breakdown" table:
   - Every iteration MUST have a "Review Issues" column with actual counts (not "N/A" or missing)
   - Every iteration MUST show test counts in the "Tests" column
3. Check `docs/swarm/<session-name>/iterations.md`:
   - Every iteration entry MUST have `**Review**:` and `**Lint**:` and `**Build**:` lines
4. If ANY iteration is missing review/security/test evidence:
   - Do NOT proceed to Step 5
   - Re-spawn the Lead Agent with:
     - The current state of the codebase
     - A directive: "VALIDATION FAILURE: Iterations [list] are missing mandatory review/security/test gates. You MUST run the missing phases before returning. Do NOT re-implement code — only run the missing Phase B agents (code-review-agent, security-agent) and Phase A (test-agent) on the existing files."
   - Attach the list of changed files per iteration from the delivery report

### If status is "completed"

All spec items are done. Proceed to Step 5 (PR Creation).

### If status is "partial"

Some items remain. Evaluate:

1. Read the Lead Agent's output to understand what was completed and what remains
2. If remaining items are blocked by user decisions → ask the user via `AskUserQuestion`
3. If remaining items failed due to technical issues → re-spawn the Lead Agent with:
   - Only the pending items
   - The troubleshooting history (updated with what failed)
   - A directive to focus on the remaining work
4. Repeat until all items are done or the user decides to stop

### If status is "blocked"

The Lead Agent hit an unresolvable issue:

1. Present the blocker to the user via `AskUserQuestion`
2. Based on user response:
   - **Fix and retry**: re-spawn Lead Agent with updated context
   - **Skip blocked items**: proceed to PR with partial completion
   - **Abort**: stop without PR

## Step 5 — Pull Request Creation

Once the Lead Agent has completed (or the user accepts partial completion):

### 5a. Exit Confirmation

Based on `confirmExit` config:
- `auto`: auto-proceed for small tasks (< 5 files changed), ask for large tasks
- `always`: always ask via `AskUserQuestion`
- `never`: proceed without confirmation

### 5b. Create the PR

1. Push the feature branch: `git push -u origin feat/<session-name>`
2. Read `docs/swarm/<session-name>/delivery-report.md` for the PR body content
3. Create the PR:

```bash
gh pr create \
  --title "feat(<session-name>): <short description>" \
  --body "$(cat docs/swarm/<session-name>/delivery-report.md)" \
  --base <baseBranch> \
  --head feat/<session-name>
```

4. Return the PR URL to the user.

### 5c. Worktree Cleanup

If a worktree was created in Step 2 (i.e., `wt` was available):

1. Change back to the original project directory (the `baseBranch` repo root)
2. Clean up the worktree:

```bash
cd <original-project-dir>
wt clean feat/<session-name> -y
```

This removes the worktree directory but keeps the branch (which is now on the remote via the PR).

## Edge Cases

- **Lead Agent returns without completion report**: treat as "partial", check `docs/swarm/<session-name>/delivery-report.md` and `git log` to assess what was done, then re-spawn if needed
- **Lead Agent context exhaustion**: if the agent hits context limits mid-run, it should have committed per-iteration; re-spawn with remaining items and troubleshooting history
- **No changes made**: if no files were changed, do not create an empty PR — inform the user
- **PR creation fails**: show the error to the user, provide the manual command to run

## Constraints

- **`/swarm` ALWAYS executes the full flow** — Steps 1 through 5 must run every time. NEVER stop after gathering context to display a summary, dashboard, or status overview. The purpose of `/swarm` is to deliver working code, not to report on the project state. If spec detection finds nothing, proceed to `/interview`. If `/interview` completes, proceed to the Lead Agent. There is no valid reason to stop before Step 3.
- Never run destructive commands: no `rm -rf`, no `git push --force`, no `git reset --hard`, no branch deletion
- Git operations are limited to: branch creation, commit, push, and PR creation
- The skill is a launcher — all implementation work happens in the Lead Agent and its sub-agents
- Never commit secrets or credentials
