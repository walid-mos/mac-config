---
name: swarm
description: Orchestrate a team of specialized agents to autonomously complete development tasks
user-invocable: true
argument-hint: [task description]
allowed-tools: Task, Read, Glob, Grep, Write, Edit, Bash, Skill, AskUserQuestion
---

# Swarm Skill — Lead Agent

Orchestrate a team of specialized agents (Planification, Test, Code, Review, Security) to autonomously work through development tasks. You are the Lead Agent — you read specs, manage state, delegate work via the `Task` tool, and loop until all spec items are complete.

## Argument Parsing

The user invokes `/swarm <free-form task description>`.

Derive a kebab-case session name from the description for doc headers, git branch naming, and commit messages.

Examples:
- `/swarm add user authentication with OAuth` → `add-user-auth`
- `/swarm refactor the payment module` → `refactor-payment-module`
- `/swarm fix broken dark mode toggle` → `fix-dark-mode-toggle`

## Initialization

### 1. Spec Detection

Check for existing specs that cover the task:

1. Glob `docs/specs/*.spec.md`
2. Read any matching specs and assess coverage
3. If a complete spec exists — use it directly, skip to planning
4. If partial coverage — note the gaps for the Planification Agent
5. If no spec exists — the Planification Agent will handle it

### 2. Tech Stack Detection

Analyze the codebase to determine the project's tech stack:

- Read `package.json` (dependencies, devDependencies, scripts)
- Glob for framework config files (`astro.config.*`, `next.config.*`, `vite.config.*`, `tsconfig.json`, `tailwind.config.*`, `dagger.*`)
- Scan file extensions to identify languages in use
- Store the detected stack for routing work to the right specialist agents

### 3. Configuration

Check for an optional `.swarm.json` at project root:

```json
{
  "specialists": ["typescript", "astro", "react"],
  "defaultTestStrategy": "tdd-flexible",
  "autoCommit": true,
  "prOnComplete": true,
  "confirmExit": "auto"
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `specialists` | auto-detect | Which skill-based specialists are available |
| `defaultTestStrategy` | `"configurable"` | Default testing approach (Planification Agent can override per task) |
| `autoCommit` | `true` | Auto-commit on completion |
| `prOnComplete` | `true` | Create PR on completion |
| `confirmExit` | `"auto"` | When to ask user confirmation before ending (`auto`, `always`, `never`) |

If `.swarm.json` is missing or has invalid fields, fall back to auto-detection and defaults. Warn about invalid specialist names but continue.

### 4. Documentation Initialization

Create or append headers to the persistent documentation files:

```markdown
## Session: <session-name> — <ISO-8601 timestamp>
```

Files to initialize:
- `docs/iterations.md` — persistent, append mode — log of each iteration
- `docs/troubleshooting.md` — persistent, append mode — significant bugs and issues
- `docs/loopsummary.md` — persistent, append mode — final summary (written at completion)
- `docs/fixes.md` — loop-scoped, fresh each review cycle — current fixes to apply

Create the `docs/` directory if it does not exist.

## Orchestration Loop

### Phase 1: Planification

Spawn the **Planification Agent** via `Task`:
- Pass: task description, detected specs (or gaps), tech stack, contents of `docs/troubleshooting.md` (lessons from past runs)
- The Planification Agent will:
  - Assess spec completeness
  - Invoke `/interview` via the `Skill` tool if gaps exist (or create a minimal inline spec if user declines)
  - Produce an ordered task list with testing strategy per item (`tdd-strict`, `tdd-flexible`, or `post-code`)
  - Return: task list, testing strategies, any updated spec content

### Phase 2: Testing

Spawn the **Test Agent** via `Task`:
- Pass: task list, testing strategies, relevant spec sections, tech stack
- The Test Agent will:
  - For `tdd-strict` items: write complete test files before any code
  - For `tdd-flexible` items: write test outlines/skeletons
  - For `post-code` items: note what to test after implementation
  - Return: test file paths, test outlines, testing context for Code Agents

### Phase 3: Coding

Spawn **Code Agents** via `Task` — one per independent work item, in parallel:
- Route each item to the right specialist based on the files involved and the detected tech stack
- Pass: task item, test files/outlines, relevant spec section, shared context (types, interfaces) if tasks are interconnected
- Each Code Agent loads its domain skill (e.g., `typescript`, `react`, `astro`) for standards
- For interconnected tasks: serialize instead of parallelize, passing output of one as input to the next
- Collect all results before proceeding

### Phase 4: Review and Security

Spawn the **Code Review Agent** and **Security Agent** in parallel via `Task`:

**Code Review Agent** receives all changed files and checks for:
- DRY violations
- Useless fallbacks and dead code
- Bad patterns and code quality issues
- Returns: list of issues categorized as `quick-fix` or `significant`

**Security Agent** receives all changed files and checks for:
- OWASP top 10 vulnerabilities
- Injection risks, insecure defaults, missing input validation
- Hardcoded secrets or credentials
- Returns: list of issues categorized as `quick-fix` or `significant`

### Phase 5: Fix Cycle

Process review results:

1. **Quick fixes**: spawn Code Agent(s) directly to fix trivial issues immediately
2. **Significant issues**: write to `docs/fixes.md` for the next iteration
3. **Critical/persistent bugs**: append to `docs/troubleshooting.md`
4. **All completed fixes**: log in `docs/iterations.md`

### Loop Decision

After the fix cycle:

1. If Review or Security returned updates → **short loop**: go back to Phase 3 (Code Agents + Tests only, no re-planning)
2. If all fixes are resolved but more spec items remain → **full loop**: go back to Phase 1 (Planification decides what to delegate next)
3. If nothing remains → proceed to **Completion**

### Recurring Issue Detection

Track fix patterns across iterations. If the same issue type appears 3+ times:
- Stop looping on that issue
- Escalate to the user via `AskUserQuestion`
- Log the pattern in `docs/troubleshooting.md`

### Context Management

Between iterations, compress the iteration history:
- Keep the latest iteration in full detail
- Summarize previous iterations to key outcomes only
- Preserve the full task list and current progress state

## Completion

### 1. Write Summary

Append the final summary to `docs/loopsummary.md`:

```markdown
## Session: <session-name> — <ISO-8601 timestamp>

### Summary
- Tasks completed: X/Y
- Iterations: N
- Files changed: [list]
- Tests: passed/failed/skipped counts

### Changes
- [Brief description of each major change]

### Issues Encountered
- [Any significant issues and how they were resolved]
```

### 2. Git Commit

Create a git commit covering all changes:
- Use a descriptive commit message derived from the session name and summary
- Stage only the files that were changed during this swarm session
- Never use `--force`, `--no-verify`, or other destructive flags

### 3. Pull Request

Create a PR via `gh pr create`:
- Title: derived from session name
- Body: content from `docs/loopsummary.md` for this session
- Base branch: the branch that was active when the swarm started

### 4. Exit Confirmation

Based on `confirmExit` config:
- `auto`: auto-exit for small tasks (< 5 files changed, simple spec), ask confirmation for large/risky tasks
- `always`: always ask via `AskUserQuestion` before committing and creating PR
- `never`: proceed without confirmation

## Edge Cases

- **No spec exists and user skips interview**: create a minimal inline spec from the task description and proceed
- **All Code Agents fail**: log to `docs/troubleshooting.md` and ask the user for guidance via `AskUserQuestion`
- **Context window approaching limit**: compress iteration history aggressively, keep only current state and latest iteration
- **Interconnected tasks across specialists**: serialize dependent tasks, pass shared context between them
- **`.swarm.json` has invalid specialist**: warn and fall back to auto-detection for that specialist

## Constraints

- Never run destructive commands: no `rm -rf`, no `git push --force`, no `git reset --hard`, no branch deletion
- Git operations are limited to: commit and PR creation
- Follow OWASP top 10 guidelines — the Security Agent enforces this
- Never commit secrets or credentials
