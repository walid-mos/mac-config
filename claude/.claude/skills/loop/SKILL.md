---
name: loop
description: Persistent iteration loop - loops until verification command succeeds with durable changes
---

# Loop

## Overview

Loop on ANY task until verification succeeds. Maintains an iteration journal for context persistence across fresh subagents, preventing circular attempts by tracking what's been tried.

## Iron Laws

1. **Durable changes only** - Temporary fixes don't count
2. **Journal every iteration** - Context survives even if you don't
3. **No circular attempts** - Check journal before repeating approaches
4. **Context7 on uncertainty** - Fetch docs when unsure or stuck on same error twice

## Invocation

```
/loop [--max-iterations=N] "<goal>" <verification-command>
```

**Examples:**
- `/loop "Fix auth tests" pnpm test src/auth.test.ts`
- `/loop "Deploy worker to prod" wrangler deploy`
- `/loop --max-iterations=10 "E2E suite green" playwright test`
- `/loop "Terraform apply succeeds" terraform apply -auto-approve`
- `/loop "Fix login flow" npm run test:unit -- --grep "login"`

## Context7 Integration

### When to Trigger

Context7 lookup is **mandatory** in these situations:

1. **Consecutive same error** - If iteration N and N-1 have the same error pattern
2. **Uncertain about API/syntax** - When the fix involves library/framework APIs
3. **Deprecation warnings** - When errors mention deprecated methods
4. **Version mismatch hints** - When errors suggest version incompatibility

### How to Use

```
1. resolve-library-id: Get Context7-compatible library ID
2. get-library-docs: Fetch relevant documentation
3. Apply learnings to form NEW hypothesis
```

### Detection Logic (Parent)

```
BEFORE spawning subagent:
  IF iteration > 1:
    previous_error = journal.iterations[iteration-1].observation
    current_error = journal.iterations[iteration-2].observation  # from last run
    IF similar_error_pattern(previous_error, current_error):
      SET context7_required = true
      INCLUDE in subagent prompt: "MANDATORY: Use Context7 before attempting fix"
```

### Subagent Context7 Protocol

When Context7 is required or uncertainty exists:

1. Identify the library/framework involved in the error
2. Call `resolve-library-id` with library name
3. Call `get-library-docs` with topic relevant to the error
4. Form hypothesis based on CURRENT documentation (not cached knowledge)
5. Document Context7 findings in journal

## Workflow (Subagent Architecture)

### Parent Agent Role

- Orchestrates loop iterations
- Owns and updates iteration journal (`.claude/iteration-journal.md`)
- Spawns fresh subagent per iteration
- Validates action validity (durable vs temporary)
- Enforces circuit breaker (default: 25 iterations)

### Phase 1: Initialize (Parent)

1. Parse arguments:
   - `--max-iterations=N` (default: 25)
   - Goal description (quoted string)
   - Verification command (everything after goal)
2. Create/read `.claude/iteration-journal.md`
3. Initialize: `iteration = 0`, `last_action_type = none`

### Phase 2: Iteration Loop (Parent)

```
WHILE iteration < max_iterations:
  iteration++

  # Spawn fresh subagent with Task tool
  subagent_result = Task(
    subagent_type: "general-purpose",
    prompt: """
      ## Context
      Iteration journal contents:
      ---
      {journal_content}
      ---

      Iteration: {iteration} of {max_iterations}
      Goal: {goal_description}
      Verification command: {verification_command}

      ## Instructions

      1. **Read the journal** - Do NOT repeat approaches that already failed
      2. **Check for repeated errors** - If last 2 iterations have same error pattern:
         - MANDATORY: Use Context7 before attempting any fix
         - resolve-library-id → get-library-docs for relevant library
         - Document Context7 findings in your response
      3. **Run verification** - Observe the actual failure/error
      4. **Form a NEW hypothesis** - Must differ from previous attempts
         - If uncertain about API/syntax: Use Context7 first
         - If error mentions deprecation: Use Context7 first
      5. **Make DURABLE changes** - Use Edit/Write tools on project files
         - Changes must be reproducible and version-controlled
         - NO temporary fixes (manual state corrections, service restarts)
         - NO environment-specific hacks
      6. **Run verification again** - Confirm your changes work
      7. **Return structured result:**
         - result: PASS or FAIL
         - action_type: "durable" or "temporary"
         - action_justification: WHY this action is valid for the goal
         - files_changed: list of files modified
         - context7_used: true/false (and what was looked up)
         - findings: what you learned (for journal)
    """
  )

  # Update journal with findings
  append_to_journal(iteration, subagent_result.findings)

  # Evaluate result
  IF subagent_result.result == PASS:
    IF subagent_result.action_type == "durable":
      goto Phase 3  # Validate
    ELSE:
      log_warning("Temporary action detected - does not count")
      continue loop
  ELSE:
    continue loop

# Circuit breaker triggered
STOP and present journal summary to user
Request explicit decision to continue or change approach
```

### Phase 3: Final Validation (Parent)

1. Run verification ONE MORE TIME (clean run, no subagent)
2. If PASS: SUCCESS - archive journal, report completion
3. If FAIL: Back to Phase 2 (subagent changes were fragile)

## What Counts as Valid

### Core Principle

Actions that produce DURABLE, REPRODUCIBLE changes are valid.

### Always Valid (Regardless of Goal)

- `Edit` on project files (source, config, infrastructure)
- `Write` creating new project files
- `Read`, `Glob`, `Grep` (information gathering)
- The verification command itself
- `Bash` git commands (neutral)

### Always Invalid (Regardless of Goal)

- Manual state changes outside version-controlled files
- One-time fixes that won't persist (manual data corrections)
- Dashboard/UI changes instead of code/config
- Environment-specific hacks

### Context-Dependent (Subagent Decides)

The subagent must JUSTIFY why an action is valid for the stated goal:

| Action | Deploy Goal | Bug Fix Goal | Justification Required |
|--------|-------------|--------------|------------------------|
| `wrangler deploy` | Valid | Invalid | "Deployment is the stated goal" |
| `docker restart` | Usually invalid | Invalid | Temporary unless part of deploy script |
| `rm -rf node_modules` | Valid (clean deps) | Valid (dep issue) | "Clearing corrupted dependencies" |
| `psql UPDATE` | Invalid | Invalid | Manual data fix won't persist |

## Iteration Journal Structure

Location: `.claude/iteration-journal.md` (project root)

```markdown
# Iteration Journal: [Goal Description]

## Verification Command
`wrangler deploy`

## Configuration

- Max iterations: 25
- Current iteration: 0

## Iterations

### Iteration 1 - 2026-02-01T23:45:00Z
**Observation:** Error: Missing binding for KV namespace
**Hypothesis:** wrangler.toml missing KV binding configuration
**Context7:** Not used (first iteration, clear error)
**Action:** Added KV binding to wrangler.toml
**Action Type:** durable
**Justification:** Config file change is version-controlled
**Files Changed:** wrangler.toml
**Result:** FAIL - Different error now, D1 binding also missing

### Iteration 2 - 2026-02-01T23:47:00Z
**Observation:** Error: Missing binding for D1 database
**Hypothesis:** D1 binding also needs configuration
**Action:** Added D1 binding to wrangler.toml
**Action Type:** durable
**Justification:** Config file change is version-controlled
**Files Changed:** wrangler.toml
**Result:** PASS

## Approaches Already Tried
- [x] Added KV binding - partial fix, revealed D1 issue
- [x] Added D1 binding - SUCCESS

## Current Understanding
Both KV and D1 bindings must be configured in wrangler.toml for deployment.
```

### Journal Rules

**Before Each Iteration:**
```
READ .claude/iteration-journal.md
PARSE "Approaches Already Tried" section
IF current_hypothesis IN already_tried:
  MUST form different hypothesis
```

**After Each Iteration:**
```
APPEND to journal:
- Iteration number and timestamp
- Observation (actual error/behavior)
- Hypothesis (what we think is wrong)
- Action taken (what we changed)
- Action type (durable/temporary)
- Justification (why action is valid)
- Files changed
- Result (PASS/FAIL + why)
```

**On Success:**
```
IF verification_passes AND action_type == durable:
  Archive journal (move to .claude/iteration-journal-archive/)
  LOG "Goal achieved via {files_changed}"
```

## Circuit Breaker

**Default threshold:** 25 iterations

**On threshold reached:**
1. STOP iteration loop
2. Present journal summary:
   - All approaches tried with outcomes
   - Patterns observed across iterations
   - Suggested next directions
3. Require explicit user decision:
   - Continue with more iterations
   - Change approach entirely
   - Escalate or abandon

## Red Flags

Watch for these patterns that indicate problems:

| Pattern | Problem | Action |
|---------|---------|--------|
| "Let me just restart the service" | Temporary action | Won't count as valid |
| "I'll fix the data manually" | Temporary action | Won't count as valid |
| "Same approach but with more logging" | Not a new hypothesis | Check journal, try different approach |
| "Verification passes now" (after Bash commands) | Suspicious | Verify action_type is "durable" |
| Iteration 5+ with similar errors | Circular attempts | Step back, re-read full journal |
| Same error 2x without Context7 | Skipped documentation | MUST use Context7 before next attempt |
| Guessing API syntax | Uncertainty | Use Context7 to verify correct usage |
| "I think the method is..." | Assumption | Context7 lookup required |

## Example Flow

```
1. User: /loop "Deploy worker to prod" wrangler deploy

2. Parent: Creates .claude/iteration-journal.md
   - Goal: Deploy worker to prod
   - Verification: wrangler deploy
   - Max iterations: 25

3. Parent spawns Subagent #1:
   - Empty journal context (first iteration)
   - Subagent runs wrangler deploy, sees "Missing KV binding"
   - Subagent edits wrangler.toml, deploys again
   - Returns: {result: FAIL, action_type: durable, findings: "KV added, now D1 missing..."}

4. Parent updates journal with Subagent #1 findings

5. Parent spawns Subagent #2:
   - Journal shows: "KV binding approach - partial success"
   - Subagent forms NEW hypothesis (D1 binding)
   - Subagent edits wrangler.toml, deploys again
   - Returns: {result: PASS, action_type: durable, findings: "Both bindings needed"}

6. Parent runs final validation (clean wrangler deploy, no subagent)
   - Deploy SUCCEEDS

7. Parent archives journal, reports success:
   "Goal achieved: wrangler.toml updated with KV and D1 bindings"
```

## Related Skills

- `bugfix-tests` - Write reproducing test FIRST (use before loop for bug fixing)
- `superpowers:systematic-debugging` - Deep root cause analysis
- `remember` - Save learnings to permanent config after success
