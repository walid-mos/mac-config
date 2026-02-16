---
name: bugfix
description: Orchestrate a team of specialized agents to autonomously investigate, reproduce, fix, and verify bugs
user-invocable: true
argument-hint: [bug description, GitHub issue URL, or error log]
allowed-tools: Task, Read, Glob, Grep, Write, Edit, Bash, Skill, AskUserQuestion, WebFetch, WebSearch
---

# Bugfix Skill — Launcher

This skill is a thin launcher. It parses bug input, gathers context, spawns the **Bugfix Lead Agent** via `Task`, and handles PR creation when the bug is fixed.

**You do NOT investigate or fix the bug yourself.** You prepare inputs, spawn the Bugfix Lead Agent, and handle post-completion actions.

## Argument Parsing

The user invokes `/bugfix <bug description | GitHub issue URL | error log | any combination>`.

### Input Type Auto-Detection (FR-1)

Analyze the user's input and classify each component:

1. **GitHub Issue URL**: matches `https://github.com/<owner>/<repo>/issues/<number>` — fetch issue title, body, labels, and comments via `gh issue view <number> --json title,body,labels,comments`
2. **Error Log / Stack Trace**: contains patterns like `Error:`, `at <function>`, `Traceback`, file paths with line numbers, exit codes — extract as raw error context
3. **Free-form Description**: everything else — natural language description of the bug

A single invocation may contain **multiple types combined**. Extract all of them:

```
/bugfix The login page crashes after the last deploy. Here's the error:
TypeError: Cannot read properties of undefined (reading 'email')
    at UserProfile (src/components/UserProfile.tsx:42)
See also https://github.com/acme/app/issues/123
```

Produces:
- `freeFormDescription`: "The login page crashes after the last deploy"
- `errorContext`: TypeError stack trace
- `githubIssue`: { url, title, body, labels, comments } (fetched via gh CLI)

Derive a **date-prefixed kebab-case** session name from the bug description. The prefix is today's date in `YYMMDD` format (6 digits, no separators), followed by a hyphen, then the kebab-case slug.

Examples (assuming today is 2026-02-16):
- `/bugfix login page crashes on submit` → `260216-fix-login-crash`
- `/bugfix https://github.com/acme/app/issues/123` → `260216-fix-issue-123`
- `/bugfix TypeError in UserProfile component` → `260216-fix-userprofile-typeerror`

## Step 1 — Gather Context

Perform 1a through 1d in parallel.

### 1a. Tech Stack Detection

Build a `TechStack` object:

- Read `package.json` (dependencies, devDependencies, scripts)
- Glob for framework config files (`astro.config.*`, `next.config.*`, `vite.config.*`, `tsconfig.json`, `tailwind.config.*`)
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
  configs: string[]
}
```

### 1b. Configuration

Read `.swarm.json` at project root (if it exists), extract bugfix-specific config and merge with defaults:

```
BugfixConfig {
  monitoring: {
    ghActions: boolean           // Default: true
    localTests: boolean          // Default: true
    liveUrl: string | null       // Default: null
    logFiles: string[]           // Default: []
  }
  maxInnerFixCycles: number      // Default: 3
  askUserEvery: number           // Default: 10
  worktreeDefault: "ask" | "worktree" | "branch"  // Default: "ask"
}
```

Also extract the standard `SwarmConfig` fields (specialists, autoCommit, prOnComplete, confirmExit).

If `.swarm.json` is missing, use defaults.

### 1c. Record the Base Branch and Project Directory

Run `git branch --show-current` and store the result as `baseBranch`.

Also store `pwd` as `projectDir` for worktree cleanup in Step 5c.

### 1d. Existing Documentation

Read `docs/troubleshooting.md` if it exists — this will be passed to the Bugfix Lead Agent for known pattern matching (FR-14).

## Step 2 — Worktree Isolation (FR-15)

The user chooses whether to work in a worktree or on the current branch. **Ask every time** unless `.swarm.json` overrides.

### 2a. Determine Isolation Strategy

Based on `bugfixConfig.worktreeDefault`:
- `"ask"` (default): Ask the user via `AskUserQuestion`:
  ```
  Bug investigation may modify files. Choose isolation strategy:
  1. Worktree — create an isolated copy (safe for parallel work)
  2. Current branch — work directly here (faster, simpler)
  ```
- `"worktree"`: auto-create worktree without asking
- `"branch"`: auto-use current branch without asking

### 2b. Create Worktree (if chosen)

```bash
type wt  # Verify wt is available
```

If `wt` is available and worktree was chosen:

```bash
wt new fix/<session-name> -y
```

If `wt` is not available, fall back to:

```bash
git checkout -b fix/<session-name>
```

Note: bugfix branches use the `fix/` prefix (not `feat/`).

### 2c. Use Current Branch (if chosen)

Stay on current branch. No worktree creation. Store current directory as `worktreePath`.

### 2d. Record the Worktree Path

Store `pwd` as `worktreePath` for cleanup in Step 5.

## Step 3 — Spawn the Bugfix Lead Agent

Spawn the Bugfix Lead Agent via `Task` with `subagent_type: "bugfix-lead-agent"`.

Build the prompt as a structured `BugfixLeadAgentInput`:

```
## BugfixLeadAgentInput

### bugDescription
<original free-form bug description>

### sessionName
<kebab-case session name>

### inputContext
freeFormDescription: <extracted description or null>
errorContext: <extracted error/stack trace or null>
githubIssue: <fetched issue data or null>

### techStack
languages: [<detected languages>]
frameworks: [<detected frameworks>]
testRunner: <detected or null>
packageManager: <detected>
buildTool: <detected or null>
configs: [<list of detected config file paths>]

### bugfixConfig
monitoring:
  ghActions: <boolean>
  localTests: <boolean>
  liveUrl: <string or null>
  logFiles: [<paths>]
maxInnerFixCycles: <number>
askUserEvery: <number>

### existingDocs
troubleshooting: <contents of docs/troubleshooting.md, or "null">

## CRITICAL INSTRUCTIONS

- You MUST investigate, reproduce, fix, and verify the bug before returning.
- If you encounter a blocker, escalate via AskUserQuestion — do NOT silently stop.
- Run the full bugfix loop: Investigate → Reproduce → Fix → Verify → repeat until fixed.
- Quality gates (test, code review, security) are MANDATORY on every fix attempt.
- Write the RCA to docs/bugfix/<session-name>/rca.md before returning.
- Commit the fix with a clear message.
- **ABSOLUTE RULE — VERIFICATION FAILURES ARE YOUR PROBLEM**: If ANY verification check fails after a fix attempt (tests, build, CI, monitoring, review, security), you MUST re-enter Phase C. You are NEVER allowed to classify a post-fix failure as "another bug" or "unrelated". If it was passing before your fix and failing after, YOUR FIX CAUSED IT — fix it. The ONLY bugs that go to fixes.md are pre-existing issues found during Phase A investigation.
- **NEVER return STATUS: fixed while any check is failing.** Loop until everything passes.
- When you are done, return a structured completion report:
  STATUS: fixed | not-fixed | blocked
  FIX_DESCRIPTION: <1-2 sentence description of the fix>
  FILES_CHANGED: <comma-separated list>
  ROOT_CAUSE: <1-sentence root cause>
  BLOCKER: <description if status is "blocked", or "none">
```

## Step 4 — Handle Bugfix Lead Agent Result

When the Bugfix Lead Agent returns, parse its completion report.

### If status is "fixed"

Bug is resolved. Proceed to Step 5 (PR Creation).

### If status is "not-fixed"

The agent exhausted its attempts:

1. Read the agent's output to understand what was tried
2. Present the findings to the user via `AskUserQuestion`:
   - What was investigated
   - What hypotheses were tested
   - What fix attempts were made
   - Ask: "Provide hints", "Try again with different approach", or "Abort"
3. If user provides hints, re-spawn with updated context
4. Repeat until fixed or user aborts

### If status is "blocked"

The agent hit an unresolvable issue:

1. Present the blocker to the user via `AskUserQuestion`
2. Based on user response:
   - **Resolve and retry**: re-spawn with updated context
   - **Abort**: stop without PR

## Step 5 — Pull Request Creation (FR-11)

Once the bug is fixed:

### 5a. Exit Confirmation

Based on `confirmExit` config:
- `auto`: auto-proceed for small fixes (< 5 files changed), ask for large fixes
- `always`: always ask via `AskUserQuestion`
- `never`: proceed without confirmation

### 5b. Create the PR

1. Push the fix branch: `git push -u origin fix/<session-name>`
2. Read `docs/bugfix/<session-name>/rca.md` for the PR body content
3. Create the PR:

```bash
gh pr create \
  --title "fix(<session-name>): <short description from fix report>" \
  --body "$(cat docs/bugfix/<session-name>/rca.md)" \
  --base <baseBranch> \
  --head fix/<session-name>
```

4. Return the PR URL to the user.

### 5c. Worktree Cleanup

If a worktree was created in Step 2:

1. Change back to the original project directory
2. Clean up the worktree:

```bash
cd <original-project-dir>
wt clean fix/<session-name> -y
```

This removes the worktree directory but keeps the branch (which is now on the remote via the PR).

## Edge Cases

- **Bugfix Lead Agent returns without completion report**: treat as "not-fixed", check `docs/bugfix/<session-name>/rca.md` and `git log` to assess what was done, then re-spawn if needed
- **Bugfix Lead Agent context exhaustion**: if the agent hits context limits mid-run, it should have committed progress; re-spawn with remaining context
- **No changes made**: if no files were changed, do not create a PR — inform the user that the bug could not be reproduced or fixed
- **PR creation fails**: show the error to the user, provide the manual command to run
- **GitHub issue URL inaccessible**: fall back to treating input as free-form description, warn user that issue details could not be fetched
- **Multiple bugs detected during investigation**: the Bugfix Lead Agent focuses on the reported bug and logs side bugs to `docs/bugfix/<session-name>/fixes.md` (FR-13)

## Constraints

- **`/bugfix` ALWAYS executes the full flow** — Steps 1 through 5 must run every time. NEVER stop after gathering context to display a summary or investigation report. The purpose of `/bugfix` is to deliver a working fix, not to report on the bug. There is no valid reason to stop before Step 3.
- Never run destructive commands: no `rm -rf`, no `git push --force`, no `git reset --hard`, no branch deletion
- Git operations are limited to: branch creation, commit, push, and PR creation
- The skill is a launcher — all investigation and fix work happens in the Bugfix Lead Agent and its sub-agents
- Never commit secrets or credentials
- Bug branches use `fix/` prefix (not `feat/`)
