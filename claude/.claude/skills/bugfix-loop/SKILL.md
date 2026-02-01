---
name: bugfix-loop
description: Persistent bug-fixing loop with learning journal - loops until test passes with durable code fix
---

# Bugfix Loop

## Overview

Loop on a failing test until it passes with a DURABLE CODE FIX. Maintains a debug journal for context persistence across iterations, preventing circular debugging by tracking attempted approaches.

## Iron Laws

1. **Code fixes only** - Manual interventions invalidate the loop
2. **Journal every iteration** - Context survives even if you don't
3. **No circular debugging** - Check journal before repeating approaches

## Invocation

```
/bugfix-loop <test-command>
/bugfix-loop --max-iterations=30 <test-command>
```

**Examples:**
- `/bugfix-loop pnpm test src/auth.test.ts`
- `/bugfix-loop --max-iterations=30 npm run test:unit -- --grep "login"`

## Workflow (Subagent Architecture)

### Parent Agent Role

- Orchestrates loop iterations
- Owns and updates debug journal (`.claude/debug-journal.md`)
- Spawns fresh subagent per iteration
- Validates fix type (code vs manual)
- Enforces circuit breaker (default: 25 iterations)

### Phase 1: Initialize (Parent)

1. Parse arguments:
   - `--max-iterations=N` (default: 25)
   - Everything after flags is the test command
2. Create/read `.claude/debug-journal.md`
3. Initialize: `iteration = 0`, `last_fix_type = none`

### Phase 2: Iteration Loop (Parent)

```
WHILE iteration < max_iterations:
  iteration++

  # Spawn fresh subagent with Task tool
  subagent_result = Task(
    subagent_type: "general-purpose",
    prompt: """
      ## Context
      Debug journal contents:
      ---
      {journal_content}
      ---

      Iteration: {iteration} of {max_iterations}
      Test command: {test_command}

      ## Instructions

      1. **Read the journal** - Do NOT repeat approaches that already failed
      2. **Run the test** - Observe the actual failure
      3. **Form a NEW hypothesis** - Must differ from previous attempts
      4. **Make a CODE FIX** - Use Edit/Write tools ONLY on source files
         - NO manual interventions (rm, mv, data fixes, service restarts)
         - NO environment changes
         - NO database manual corrections
      5. **Run the test again** - Verify your fix
      6. **Return structured result:**
         - result: PASS or FAIL
         - fix_type: "code" or "manual"
         - files_changed: list of files modified
         - findings: what you learned (for journal)
    """
  )

  # Update journal with findings
  append_to_journal(iteration, subagent_result.findings)

  # Evaluate result
  IF subagent_result.result == PASS:
    IF subagent_result.fix_type == "code":
      goto Phase 3  # Validate
    ELSE:
      log_warning("Manual intervention detected - does not count")
      continue loop
  ELSE:
    continue loop

# Circuit breaker triggered
STOP and present journal summary to user
Request explicit decision to continue or change approach
```

### Phase 3: Final Validation (Parent)

1. Run test ONE MORE TIME (clean run, no subagent)
2. If PASS: SUCCESS - archive journal, report fix
3. If FAIL: Back to Phase 2 (subagent fix was fragile)

## Manual Intervention Detection

### Valid Actions (set fix_type = code)

- `Edit` on source files (`.ts`, `.js`, `.py`, `.go`, `.rs`, etc.)
- `Write` creating new source files
- `Bash` running tests (neutral - doesn't change fix_type)
- `Bash` git commands (neutral)
- `Read`, `Glob`, `Grep` (neutral)

### Invalid Actions (set fix_type = manual)

- `Bash` with `rm`, `mv`, `cp` on non-source files
- `Bash` database commands (`psql`, `mysql`, `mongo`, etc.)
- `Bash` service restarts (`systemctl`, `docker restart`, etc.)
- `Bash` environment modifications
- Any state modification outside source code

### Tracking Rule

If subagent performs ANY invalid action before test passes, the pass is invalidated. Journal records the manual intervention, loop continues.

## Debug Journal Structure

Location: `.claude/debug-journal.md` (project root)

```markdown
# Debug Journal: [Bug Description]

## Test Command
`pnpm test src/auth.test.ts`

## Iterations

### Iteration 1 - 2026-02-01T23:45:00Z
**Observation:** TypeError: Cannot read property 'id' of undefined at line 42
**Hypothesis:** User object not loaded before accessing id
**Attempted Fix:** Added null check in getUserId()
**Files Changed:** src/auth/utils.ts
**Result:** FAIL - Different error now, null check masks the real issue

### Iteration 2 - 2026-02-01T23:47:00Z
**Observation:** Now getting "User not authenticated" error
**Hypothesis:** Auth middleware not running before handler
**Attempted Fix:** Moved middleware order in router setup
**Files Changed:** src/routes/index.ts
**Result:** PASS

## Approaches Already Tried
- [x] Null check on user.id - masks issue, doesn't fix
- [x] Middleware reordering - SUCCESS

## Current Understanding
Auth middleware must run before any route handler that accesses user.
```

### Journal Rules

**Before Each Iteration:**
```
READ .claude/debug-journal.md
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
- Attempted fix (what we changed)
- Files changed
- Result (PASS/FAIL + why)
```

**On Success:**
```
IF test_passes AND fix_type == code:
  Archive journal (move to .claude/debug-journal-archive/)
  LOG "Bug fixed durably in {files_changed}"
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
| "Let me just restart the service" | Manual intervention | Won't count as fix |
| "I'll fix the data manually" | Manual intervention | Won't count as fix |
| "Same approach but with more logging" | Not a new hypothesis | Check journal, try different approach |
| "Test passes now" (after Bash commands) | Suspicious | Verify fix_type is "code" |
| Iteration 5+ with similar errors | Circular debugging | Step back, re-read full journal |

## Example Flow

```
1. User: /bugfix-loop pnpm test src/auth.test.ts

2. Parent: Creates .claude/debug-journal.md
   - Test command: pnpm test src/auth.test.ts
   - Max iterations: 25

3. Parent spawns Subagent #1:
   - Empty journal context (first iteration)
   - Subagent runs test, sees "TypeError: user.id undefined"
   - Subagent adds null check, tests again
   - Returns: {result: FAIL, fix_type: code, findings: "Null check didn't help..."}

4. Parent updates journal with Subagent #1 findings

5. Parent spawns Subagent #2:
   - Journal shows: "Null check approach failed"
   - Subagent forms NEW hypothesis (must differ)
   - Subagent fixes middleware order, tests again
   - Returns: {result: PASS, fix_type: code, findings: "Middleware order was wrong"}

6. Parent runs final validation test (clean, no subagent)
   - Test PASSES

7. Parent archives journal, reports success:
   "Bug fixed in src/routes/index.ts - middleware order corrected"
```

## Related Skills

- `bugfix-tests` - Write reproducing test FIRST (use before this skill if no test exists)
- `superpowers:systematic-debugging` - Deep root cause analysis
- `remember` - Save learnings to permanent config after fix
