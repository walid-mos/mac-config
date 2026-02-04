---
name: investigate
description: >
  Deep investigation skill for diagnosing issues without making permanent changes.
  Use when debugging bugs, understanding unexpected behavior, or tracing problems.
  Extensively uses MCP tools (Browser, Context7, claude-mem), code exploration,
  and temporary debug instrumentation. Outputs a structured investigation report
  with proposed fix plan. Does NOT implement fixes - only investigates.
---

# /investigate - Investigation-Only Debugging

## Iron Laws

1. **No Permanent Changes** - Investigation only. Fix implementation is a separate step.
2. **Evidence Before Hypothesis** - Gather facts before forming theories.
3. **Root Cause Required** - Trace to source, don't fix symptoms.
4. **Test Modifications Allowed** - BUT only when immediately verifiable and reverted before completion.

## When to Use

- Bug reports with unclear root cause
- Unexpected behavior that needs tracing
- Performance issues requiring profiling
- Integration failures between components
- "It works locally but not in CI/production"

## Investigation Arsenal

| Category | Tools | Purpose |
|----------|-------|---------|
| **Code exploration** | Glob, Grep, Read, Task(Explore) | Find relevant files, trace data flow |
| **Documentation** | Context7 | Verify expected API behavior |
| **Runtime inspection** | Browser MCP | Console logs, network requests, DOM state |
| **Historical context** | claude-mem | Past related work, decisions, patterns |
| **Error analysis** | Read, Bash (read-only) | Stack traces, log files, git history |
| **State inspection** | Bash (ls, env, git log) | Environment, file state, recent changes |

## Workflow

### Phase 1: Gather Context

```
1. Parse issue description - What exactly is broken?
2. Task(Explore) - Find relevant code areas
3. Read error messages carefully - Full stack trace, exact wording
4. claude-mem search - Has this happened before?
5. git log - What changed recently?
```

### Phase 2: Deep Investigation

```
1. Context7 - Verify expected API/library behavior
2. Browser MCP - Capture runtime state:
   - browser_console_messages - JavaScript errors
   - browser_network_requests - API failures
   - browser_snapshot - DOM state
3. Trace data flow through code
4. Add temporary debug statements if needed:
   - console.log/debug at key points
   - Immediately run to see output
   - Revert before moving on
```

### Phase 3: Form Hypothesis

```
1. State root cause clearly
2. Support with evidence from investigation
3. Rate confidence: High / Medium / Low
4. If Low confidence - gather more evidence
```

### Phase 4: Propose Fix

```
1. Write investigation report (use template)
2. Include concrete fix plan:
   - Exact files and line numbers
   - What to change
   - Why this fixes the root cause
3. Specify verification command
4. Do NOT implement - output report only
```

## Test Modification Rules

Temporary modifications are allowed ONLY when:

1. **Purpose is diagnostic** - console.log, debug statements, test assertions
2. **Immediately verifiable** - Run test/command in same turn to see result
3. **Reverted promptly** - Undo before completing investigation
4. **Documented** - Note what was tested in report

**Forbidden:**
- Production code changes
- Config file modifications
- Dependency updates
- Any change that "might fix it"

## Red Flags

| Pattern | Problem |
|---------|---------|
| "Let me just fix this quickly" | Investigation, not implementation |
| Making Edit without running test | Must verify immediately |
| Skipping Context7 for API questions | Use available documentation |
| Proposing fix without evidence | Need root cause first |
| Forgetting to revert test changes | Clean up required |
| "I think it might be..." | Hypothesis needs evidence |
| Fixing where error appears | Trace to actual source |

## Output Format

Use the investigation report template. Key sections:

1. **Symptoms** - What was observed
2. **Evidence** - What investigation found
3. **Root Cause** - Clear statement with confidence level
4. **Proposed Fix** - Concrete plan (files, lines, changes)
5. **Verification** - How to confirm fix works

## Example Session

```
User: The login button doesn't redirect after successful auth

Investigation:
1. Task(Explore) → Find auth-related code
2. Read login handler → See redirect logic
3. Browser MCP → Capture network requests during login
4. Context7 → Check Next.js router behavior
5. claude-mem → Any past auth issues?

Findings:
- Login API returns 200 with user data ✓
- Router.push() called but no navigation ✗
- Context7: Next.js 14 changed router behavior
- Similar issue in #1234 three weeks ago

Root Cause:
Next.js 14 requires await on router.push() in server actions.
Confidence: High (documented breaking change + matches symptoms)

Proposed Fix:
- File: src/app/login/actions.ts:47
- Change: Add await before router.push()
- Verify: npm test && manual login test
```

## Integration with Other Skills

- **/loop** - Use /investigate first, then /loop for persistent fix implementation
- **/bugfix-tests** - Investigation may reveal test case needed
- **systematic-debugging** - /investigate follows similar evidence-first methodology

## Checklist

Before completing investigation:

- [ ] Read all error messages and stack traces
- [ ] Used Task(Explore) to find relevant code
- [ ] Checked Context7 for library/API documentation
- [ ] Searched claude-mem for related past work
- [ ] Traced data flow from source to symptom
- [ ] Reverted any temporary debug modifications
- [ ] Root cause identified with evidence
- [ ] Fix plan specifies exact files and lines
- [ ] Verification command documented
