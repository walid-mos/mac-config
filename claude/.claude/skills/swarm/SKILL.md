---
name: swarm
description: Orchestrate a team of specialized agents to autonomously complete development tasks
user-invocable: true
argument-hint: [task description]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Skill, AskUserQuestion
---

# Swarm Skill — Launcher

This skill is a thin launcher. It prepares the context, invokes `swarm.sh` via `Bash`, and handles PR creation when the script finishes.

**You do NOT orchestrate the work yourself.** You prepare inputs, run the shell orchestrator, and handle post-completion actions.

**Architecture**: `swarm.sh` is a deterministic shell script that sequences all phases (decompose → plan → test → code → review → security → lint → build → commit) using `claude -p` for AI work and pure shell logic for orchestration. This eliminates the token cost and "creative interpretation" risks of AI-based orchestration. State persists via `$TMPDIR/swarm-<session-name>-state.json`.

## CRITICAL — NEVER STOP MID-FLOW

`/swarm` is an end-to-end pipeline: interview → spec → worktree → Lead Agent → PR. **You MUST execute Steps 1 through 5 in a single invocation.** If `/interview` runs in Step 2d, that is NOT the end — it is the beginning. The moment the interview produces a spec file, you MUST continue to Step 2e (commit spec), Step 3 (spawn Lead Agent), Step 4 (handle result), and Step 5 (create PR). Stopping after the interview to "let the user review" or "summarize what was gathered" is a critical failure.

## Argument Parsing

The user invokes `/swarm <free-form task description>`.

Derive a **date-prefixed kebab-case** session name from the description for doc headers, git branch naming, and commit messages. The prefix is today's date in `YYMMDD` format (6 digits, no separators), followed by a hyphen, then the kebab-case slug.

Examples (assuming today is 2026-02-16):
- `/swarm add user authentication with OAuth` → `260216-add-user-auth`
- `/swarm refactor the payment module` → `260216-refactor-payment-module`
- `/swarm fix broken dark mode toggle` → `260216-fix-dark-mode-toggle`

## Step 1 — Gather Context & Ensure Specs

Perform 1a through 1d in parallel. **Step 1 is READ-ONLY** — no files are created or modified. All file mutations happen after the worktree is created (Step 2).

### 1a. Spec Detection

1. Glob `docs/specs/*.spec.md`
2. Read any matching specs that relate to the task description
3. Preliminary classification: `found` or `not-found`
4. If `found`, store the spec content in memory for later qualification (Step 2d)

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
  defaultTestStrategy: "tdd-strict" | "tdd-flexible" | "post-code"  // Default: "post-code"
  autoCommit: boolean                       // Default: true
  prOnComplete: boolean                     // Default: true
  confirmExit: "auto" | "always" | "never"  // Default: "auto"
}
```

If `.swarm.json` is missing or has invalid fields, fall back to defaults. Warn about invalid specialist names but continue.

### 1d. Record the Base Branch and Project Directory

Run `git branch --show-current` and store the result as `baseBranch`. This is the branch the PR will target.

Also store `pwd` as `projectDir`. This is needed to return to the original directory after worktree cleanup in Step 5c.

### 1e. Skill Resolution (CRITICAL)

Scan the task description for explicit skill references — any `/skillname` pattern (e.g., `/nextnode-standards`, `/typescript`, `/clean-code`). These are **binding standards** that the swarm MUST follow scrupulously.

For each detected skill reference:

1. **Load the skill** via the `Skill` tool to get it injected into the current context
2. **Read the skill file** to capture its full content as text: glob `~/.claude/skills/<skillname>/SKILL.md` (or check the skill's base directory as indicated by the Skill tool output)
3. **Resolve dependent skills**: if the skill content references other skills (e.g., `/nextnode-standards` references `standards` and `nextnode`), load and read those too — recursively, max depth 2
4. Store the results as `resolvedSkills`: a map of `{ skillName: fullContent }`

**Example**: `/swarm fix security + /nextnode-standards` → detect `/nextnode-standards` → load it → read its SKILL.md → it references `standards` and `nextnode` skills → load and read those too → `resolvedSkills` has 3 entries.

**If a referenced skill contains an audit procedure** (like `/nextnode-standards` does): run the audit NOW, in Step 1e, against the current project state. Store the audit results as `skillAuditResults`: a map of `{ skillName: auditOutput }`. This gives the Lead Agent the exact list of FAIL/MISSING items to fix — not a vague "fix compliance gaps" instruction.

**Why this matters**: Sub-agents (Lead Agent, Planification Agent, Code Agents) do NOT have access to the Skill tool. They cannot load skills themselves. The ONLY way skill content reaches them is if the launcher embeds it in their prompts. Without this step, a spec item like "Run /nextnode-standards and fix all gaps" is unactionable — the agents have no idea what the standard requires.

> **Note**: Spec qualification (interview, deepening) happens in Step 2d — after the worktree is created. Step 1 only detects and reads specs; it never creates or modifies files. Step 1e is an exception — it reads skill files (which are outside the project) but does not modify anything.

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

### 2d. Spec Qualification (in the worktree — depends on 1a)

**All file creation and modification happens here, inside the worktree.** This ensures no files are left untracked on the base branch.

This step determines the `NormalizedSpec` that will be passed to the Lead Agent. **The Lead Agent must receive a complete, actionable spec.** The `/interview` skill is the mechanism to ensure this.

#### Case 1: No spec found (`not-found` from 1a)

**`/interview` is MANDATORY.** Invoke it now (inside the worktree):

```
Skill: interview
Args: <task description>
```

Wait for the interview to complete. It will produce `docs/specs/<feature-name>.spec.md`. Read the produced file.

Result: `NormalizedSpec = { type: "full-spec", content: <file contents>, path: <file path> }`

**CRITICAL: The interview completing does NOT mean /swarm is done. You MUST immediately continue to Step 2e, then Step 3, then Steps 4-5. No pausing, no summarizing, no asking the user if they want to proceed.**

#### Case 2: Spec found (`found` from 1a)

The spec file already exists in the worktree (inherited from the base branch). Assess its completeness against these criteria:

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

After obtaining the `NormalizedSpec`, store the spec path as `specPath`.

> **Note**: After Step 2d, the `NormalizedSpec` should ALWAYS be `full-spec`. The `partial-spec` and `no-spec` types exist in the schema for edge cases (user explicitly skips interview), but the default flow always produces a full spec.

**NOW CONTINUE IMMEDIATELY TO STEP 2e.** Do not stop. Do not summarize the spec to the user. Do not ask for confirmation. The spec was produced by the interview — it is ready. Proceed.

### 2e. Prepare spec files and initial commit

Now that the spec is qualified and we're on the feature branch, prepare the spec files and commit them:

1. Create `docs/swarm/<session-name>/` directory (via `mkdir -p`)
2. Copy the spec file to `docs/swarm/<session-name>/spec.md`
3. Prepend a processing banner to the spec file using Edit:
   ```
   <!-- PROCESSED BY SWARM: <session-name> — <ISO-8601 timestamp> -->
   ```
4. Stage and commit the spec files:
   - Stage the spec file (`specPath`) and the session copy (`docs/swarm/<session-name>/spec.md`)
   - Commit with format:
   ```
   docs(<session-name>): add spec

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```

This ensures the spec is committed on the feature branch before any implementation begins.

## Step 3 — Run the Shell Orchestrator

Invoke `swarm.sh` in the background and stream its log in real-time.

### 3a. Build the arguments

Construct a JSON string for each structured argument:

```bash
# Tech stack JSON
TECH_STACK_JSON='{"languages":["typescript","css"],"frameworks":["astro","react"],"testRunner":"vitest","packageManager":"pnpm","buildTool":"vite","configs":["tsconfig.json","astro.config.mjs"]}'

# Swarm config JSON
SWARM_CONFIG_JSON='{"specialists":["typescript","react","astro"],"defaultTestStrategy":"post-code","autoCommit":true,"prOnComplete":true,"confirmExit":"auto"}'

# Skills JSON (only if resolvedSkills is non-empty)
SKILLS_JSON='{"nextnode-standards":"<full SKILL.md content>","standards":"<full content>"}'

# Skill audit JSON (only if audit was run)
SKILL_AUDIT_JSON='{"nextnode-standards":"<full audit output>"}'
```

### 3b. Invoke swarm.sh (background + real-time streaming)

**MANDATORY**: Run swarm.sh in the background and stream its output in real-time. NEVER run it as a blocking call — the user must see live progress.

**Step 1** — Launch in background via `Bash(run_in_background: true)`:

```bash
bash ~/.claude/scripts/swarm.sh \
  --session "<session-name>" \
  --spec "<path-to-spec-file>" \
  --tech-stack "$TECH_STACK_JSON" \
  --swarm-config "$SWARM_CONFIG_JSON" \
  --project-dir "$(pwd)" \
  [--skills "$SKILLS_JSON"] \
  [--skill-audit "$SKILL_AUDIT_JSON"]
```

Include `--skills` and `--skill-audit` only if the corresponding data was gathered in Step 1e.

**Step 2** — Stream the log in real-time. Wait a moment for the log directory to be created, then stream:

```bash
LOG="$TMPDIR/swarm-<session>-logs/swarm.log"
DONE="$TMPDIR/swarm-<session>-done"

# Wait for log file to exist (max 10s)
for i in $(seq 1 20); do [ -f "$LOG" ] && break; sleep 0.5; done

# Stream log until the done marker appears, then stop
tail -f "$LOG" &
TAIL_PID=$!
# Wait for done marker (event-driven via kqueue/inotify, not polling)
while [ ! -f "$DONE" ]; do sleep 1; done
kill $TAIL_PID 2>/dev/null || true
cat "$DONE"
```

Use `Bash(timeout: 600000)` for the streaming call — swarm runs can take up to 10 minutes.

**ANTI-PATTERN — NEVER DO THIS**:
- `sleep 120 && tail -30 ...` — NO. This is polling, not streaming.
- Running swarm.sh as a blocking `Bash` call with no output — NO. The user sees nothing.
- Using `TaskOutput(block: false)` in a loop — NO. This is polling.

### 3c. Handle exit codes

Read the done marker file (`$TMPDIR/swarm-<session>-done`) to get the exit code:

- **Exit code `0` — Success**: All iterations completed. The result JSON is at `$TMPDIR/swarm-<session>-result.json`. Proceed to Step 4.

- **Exit code `1` — Failure**: Unrecoverable error. The log was already streamed in real-time. Read the last 50 lines of `$TMPDIR/swarm-<session>-logs/swarm.log` if needed. Present the error to the user via `AskUserQuestion` and offer options: retry, skip remaining items, or abort.

- **Exit code `2` — User input needed**: A blocker requires human intervention. The blocker description is at `$TMPDIR/swarm-<session>-blocker.txt`. Read the blocker file, present it to the user via `AskUserQuestion`. Once the user confirms the prerequisite is met, re-run with `--resume`:

```bash
bash ~/.claude/scripts/swarm.sh \
  --session "<session-name>" \
  --spec "<path-to-spec-file>" \
  --tech-stack "$TECH_STACK_JSON" \
  --swarm-config "$SWARM_CONFIG_JSON" \
  --project-dir "$(pwd)" \
  --resume
```

## Step 4 — Handle Orchestrator Result

Read the result JSON at `$TMPDIR/swarm-<session>-result.json`.

### Result JSON format

```json
{
  "status": "completed | partial | failed",
  "completedItems": ["FR-1", "FR-2"],
  "pendingItems": ["FR-3"],
  "blockedItems": [],
  "totalIterations": 2,
  "filesChanged": ["src/auth.ts", "src/login.tsx"],
  "filesCreated": ["src/types/auth.ts"],
  "testResults": { "total": 28, "passed": 28, "failed": 0 },
  "summary": "Implemented authentication with login form and auth service"
}
```

### Output Validation (mandatory — before proceeding to Step 5)

1. Read `docs/swarm/<session-name>/delivery-report.md`
2. Check the "Per-Iteration Breakdown" table:
   - Every iteration MUST have a "Review Issues" column with actual counts (not "N/A" or missing)
   - Every iteration MUST show test counts in the "Tests" column
3. Check `docs/swarm/<session-name>/iterations.md`:
   - Every iteration entry MUST have `**Review**:` and `**Lint**:` and `**Build**:` lines
4. **Skill compliance validation** (if `resolvedSkills` was non-empty): Re-run the skill audit from Step 1e against the CURRENT project state (post-implementation). Compare the new audit results against the original `skillAuditResults`. Every item that was FAIL or MISSING in the original audit MUST now be PASS. If ANY skill audit item is still FAIL or MISSING:
   - Do NOT proceed to Step 5
   - Re-run swarm.sh with `--resume` and a modified spec that targets only the failing audit items
5. If ANY iteration is missing review/security/test evidence:
   - Do NOT proceed to Step 5
   - Re-run swarm.sh with `--resume` — the script will pick up from the last completed batch

### If status is "completed"

All spec items are done. Proceed to Step 5 (PR Creation).

### If status is "partial"

Some items remain. Evaluate:

1. Read the result JSON and log file to understand what completed and what remains
2. If remaining items are blocked by user decisions → ask the user via `AskUserQuestion`
3. If remaining items failed due to technical issues → re-run with `--resume`:
   ```bash
   bash ~/.claude/scripts/swarm.sh --session "<name>" --spec "<path>" \
     --tech-stack "$TECH_STACK_JSON" --swarm-config "$SWARM_CONFIG_JSON" \
     --project-dir "$(pwd)" --resume
   ```
4. Repeat until all items are done or the user decides to stop

### If status is "failed"

The orchestrator hit an unrecoverable error:

1. Read `$TMPDIR/swarm-<session>-logs/swarm.log` for error details
2. Present the error to the user via `AskUserQuestion`
3. Based on user response:
   - **Fix and retry**: re-run swarm.sh with `--resume`
   - **Skip remaining items**: proceed to PR with partial completion
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

- **`/swarm` ALWAYS executes the full flow** — Steps 1 through 5 must run every time. NEVER stop after gathering context, after the interview, or to display a summary/dashboard/status overview. The purpose of `/swarm` is to deliver working code and a PR, not to report on the project state or produce a spec. If spec detection finds nothing, proceed to `/interview`. **The moment `/interview` completes and produces a spec file, you MUST immediately continue to Step 2e → Step 3 → Step 4 → Step 5.** Stopping after the interview is the single most common failure mode — do NOT do it. There is no valid reason to stop before Step 3.
- **The launcher NEVER writes implementation code** — `swarm.sh` orchestrates AI agents that do the work. The launcher's job is to prepare context (Steps 1-2), invoke the script (Step 3), validate results (Step 4), and create the PR (Step 5).
- Never run destructive commands: no `rm -rf`, no `git push --force`, no `git reset --hard`, no branch deletion
- Git operations are limited to: branch creation, commit, push, and PR creation
- The skill is a launcher — all implementation work happens inside `swarm.sh` via `claude -p` agent calls
- **NEVER use `sleep` to poll for swarm status** — swarm.sh writes a done marker file (`$TMPDIR/swarm-<session>-done`) on exit. Use `tail -f` on the log for real-time streaming, then check the done marker. No `sleep N && check`, no `while/sleep` loops, no `TaskOutput(block:false)` loops.
- Never commit secrets or credentials
