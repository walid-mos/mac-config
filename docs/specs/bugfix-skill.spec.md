<!-- PROCESSED BY SWARM: bugfix-skill — 2026-02-09T19:35:00 -->
# Bugfix Skill (`/bugfix`) — Spec

## Overview

A new Claude Code skill that orchestrates a team of specialized agents to autonomously investigate, reproduce, fix, and verify bugs. Based on the `/swarm` architecture but purpose-built for bugfixing — no feature specs, no planification agent. Instead: an investigator agent, a bugfix agent, and mandatory quality gates (test, code review, security) that loop until the bug is definitively resolved.

## Context

The `/swarm` skill is designed for feature development with spec-driven planning. Bugs require a fundamentally different workflow: investigation-first, reproduction-driven, with iterative fix-verify loops and external monitoring. This skill fills that gap with dedicated agents and phases optimized for bug hunting.

## Functional Requirements

- **FR-1**: Accept bug input as free-form description, GitHub issue URL, error logs/stack traces, or any combination. The skill auto-detects input type and extracts structured bug context.
- **FR-2**: Spawn a dedicated `bugfix-lead-agent` that orchestrates the full lifecycle: investigate → reproduce → fix → verify → monitor.
- **FR-3**: Spawn a read-only `investigator-agent` for deep codebase analysis, external research (Context7, web search), git history forensics, runtime debugging, DB inspection, and Playwright-based UI reproduction.
- **FR-4**: Spawn a `bugfix-agent` (replaces code-agent) that applies fixes with debug instrumentation support and auto-cleanup before final commit.
- **FR-5**: Mandatory quality gates per fix attempt: test-agent, code-review-agent, security-agent. These are NEVER skipped.
- **FR-6**: Verification loop: Tests → Build → Review+Security (parallel). Fast-fail on cheap checks.
- **FR-7**: Unlimited fix-verify loops. Ask user for hints after every 10 failed attempts. Never stop unless user stops or bug is definitively fixed.
- **FR-8**: Best-effort reproduction test before fix. If the bug is hard to reproduce in isolation (timing, infra), proceed without one but document why.
- **FR-9**: Full monitoring suite: GH Actions (full pipeline), local tests, live URL check, log tailing. Used to verify fix holds.
- **FR-10**: Always produce an RCA document in `docs/bugfix/<session>/rca.md`.
- **FR-11**: Full PR creation: branch, commit, push, PR with RCA summary in description.
- **FR-12**: Proactive dependency research via Context7 and web search — automatically check changelogs, known issues, breaking changes when bug might be dependency-related.
- **FR-13**: Log unrelated side bugs to `docs/bugfix/<session>/fixes.md`. Never fix them — stay focused on the target bug.
- **FR-14**: Read `docs/troubleshooting.md` for known patterns during investigation. Do NOT write back.
- **FR-15**: User's choice for worktree isolation (ask each time: worktree or current branch).
- **FR-16**: Single adaptive flow that scales investigation depth based on bug complexity. No explicit severity modes.
- **FR-17**: Auto-detect and load any relevant specialist skill from the project's tech stack.

## Architecture

### Agents

| Agent | Type | Role | Read-Only? |
|---|---|---|---|
| `bugfix-lead-agent` | New | Orchestrates entire bugfix lifecycle | N/A (orchestrator) |
| `investigator-agent` | New | Deep investigation: code, git, Context7, web, runtime, Playwright, DB | Yes (except debug scripts) |
| `bugfix-agent` | New (replaces code-agent) | Applies fixes, debug instrumentation, auto-cleanup | No |
| `test-agent` | Existing | Writes reproduction + regression tests | No (test files only) |
| `code-review-agent` | Existing | DRY/SOLID review of fix | Yes |
| `security-agent` | Existing | OWASP security review of fix | Yes |

### Phase Flow

```
Phase A — Investigation
  ├─ Spawn investigator-agent (read-only exploration)
  │   ├─ Codebase search (Glob, Grep, Read)
  │   ├─ Git forensics (blame, log, bisect)
  │   ├─ Context7 + web search (dependency issues, known bugs)
  │   ├─ Runtime debugging (run app, query DB, inspect state)
  │   ├─ Playwright (reproduce UI bugs visually)
  │   └─ Read docs/troubleshooting.md
  └─ Output: InvestigationReport (root cause hypothesis, affected files, evidence)

Phase B — Reproduction
  ├─ Spawn test-agent (write failing repro test)
  │   ├─ Best-effort: write test that fails reproducing the bug
  │   ├─ If infeasible: document why, proceed without repro test
  │   └─ Output: repro test file path (or skip justification)
  └─ Gate: repro test fails (confirms bug exists) OR documented skip

Phase C — Fix Loop (unlimited iterations)
  ├─ C1: Spawn bugfix-agent
  │   ├─ Load relevant specialist skills (auto-detect)
  │   ├─ Apply fix based on investigation findings
  │   ├─ May add debug instrumentation (tracked for cleanup)
  │   └─ Output: changed files, debug artifacts list
  ├─ C2: Verification (fast-fail order)
  │   ├─ Step 1: Run tests (repro test + full suite)
  │   ├─ Step 2: Build check
  │   ├─ Step 3 (parallel): Code review + Security review
  │   └─ Gate: ALL must pass
  ├─ C3: If verification fails
  │   ├─ Inner fix loop (review/security → bugfix-agent, max 3 cycles)
  │   ├─ If still failing: re-enter Phase C from C1 with new findings
  │   ├─ Every 10 failed outer loops: ask user for hints
  │   └─ NEVER stop unless user says so or bug is fixed
  └─ C4: If verification passes → Phase D

Phase D — Cleanup & Delivery
  ├─ D1: Bugfix-agent strips all debug instrumentation
  ├─ D2: Final verification (tests + build + lint)
  ├─ D3: Write RCA to docs/bugfix/<session>/rca.md
  ├─ D4: Commit with descriptive message
  └─ D5: Push + create PR

Phase E — Monitoring (post-fix, pre-merge)
  ├─ E1: Monitor GH Actions (full pipeline) on PR
  ├─ E2: Run local tests one final time
  ├─ E3: Check live URL (if applicable)
  ├─ E4: Tail application logs (if accessible)
  ├─ If any monitoring fails → re-enter Phase C
  └─ If all pass → report success to user
```

### Bugfix Lead Agent vs Swarm Lead Agent

| Aspect | Swarm Lead | Bugfix Lead |
|---|---|---|
| Input | Spec items, tech stack | Bug description, error context |
| Planning | Planification agent per iteration | No planification — investigator instead |
| Iterations | Batched spec items (max 5) | Single bug, unlimited fix loops |
| Agents spawned | Planification + Test + Code + Review + Security | Investigator + Test + Bugfix + Review + Security |
| Success criteria | All spec items implemented | Bug is fixed and verified |
| Documentation | Delivery report | RCA + delivery report |

## Investigator Agent

### Capabilities

1. **Codebase Analysis**: Glob, Grep, Read — search for related code, error patterns, similar bugs
2. **Git Forensics**: `git blame`, `git log`, `git bisect` — find when/who introduced the bug, recent changes to affected files
3. **External Research**: Context7 (`resolve-library-id` → `query-docs`), WebSearch — find known issues, breaking changes, CVEs in dependencies
4. **Runtime Debugging**: Run the app locally, query databases, inspect process state, check environment variables
5. **Playwright**: Launch browser to reproduce and screenshot UI bugs, inspect DOM state
6. **Troubleshooting Knowledge**: Read `docs/troubleshooting.md` for known patterns

### Output: InvestigationReport

```typescript
interface InvestigationReport {
  bugSummary: string;
  rootCauseHypothesis: string;
  confidence: 'high' | 'medium' | 'low';
  affectedFiles: string[];
  evidence: Evidence[];
  relatedCommits: string[];
  dependencyIssues: DependencyIssue[];
  reproductionSteps: string[];
  suggestedFix: string;
  additionalContext: string;
}
```

## Bugfix Agent

### Differences from Code Agent

| Aspect | Code Agent | Bugfix Agent |
|---|---|---|
| Input | Task item + TDD tests | Investigation report + repro test |
| Scope | Implement spec | Fix a single bug |
| Skills | Specific specialist skill | Auto-detect all relevant skills |
| Debug mode | No | Yes — instrumentation with auto-cleanup |
| File scope | Strict (only assigned files) | Flexible (follow the bug wherever it leads) |
| Test writing | Never | Never (test-agent handles it) |
| Max self-correction | 3 cycles, escalate to planification | Unlimited (escalates to lead after 3 inner cycles) |

### Debug Instrumentation Protocol

1. Bugfix-agent MAY add temporary debug code (console.logs, debug endpoints, test scripts)
2. All debug artifacts are tracked in a `debugArtifacts[]` list
3. Before final commit (Phase D), ALL debug artifacts are stripped
4. Verification runs again after cleanup to confirm fix still works without instrumentation
5. If removal breaks the fix, the instrumentation was masking the real issue → re-investigate

### Output: BugfixAgentOutput

```typescript
interface BugfixAgentOutput {
  status: 'fixed' | 'partial' | 'blocked';
  filesChanged: string[];
  debugArtifacts: DebugArtifact[];
  fixDescription: string;
  testResults: { passed: number; failed: number; skipped: number };
  concerns: string[];
}
```

## Monitoring Suite

### Sources

| Source | How | Reloop Trigger |
|---|---|---|
| GH Actions | `gh run list`, `gh run watch` | Any job failure |
| Local tests | `vitest run` / test runner | Any test failure |
| Live URL | HTTP GET + content check | Non-2xx status or missing expected content |
| App logs | Tail log files or `docker logs` | Error patterns matching the bug |

### Monitoring Protocol

1. After Phase D commit, push branch
2. Start monitoring all sources in parallel
3. GH Actions: wait for full pipeline completion
4. Local tests: run full suite
5. Live URL: if deploy URL is known, check HTTP status and basic content
6. Logs: if log access is available, tail for error patterns related to the bug
7. If ANY source indicates failure → collect failure data → re-enter Phase C with new context
8. If ALL sources pass → declare success

## Documentation Artifacts

### Directory Structure

```
docs/
  bugfix/
    <session>/
      rca.md              # Root Cause Analysis (always produced)
      investigation-log.md # Raw investigation findings
      fixes.md            # Unrelated side bugs discovered
      delivery-report.md  # Final delivery report
```

### RCA Template

```markdown
# Root Cause Analysis — <Bug Title>

## Bug Summary
What happened, when, impact.

## Root Cause
Technical explanation of why the bug occurred.

## Timeline
- When was it introduced (commit/date)
- When was it detected
- When was it fixed

## Fix Description
What was changed and why.

## Files Changed
List of modified files with brief description of changes.

## Reproduction Test
Test file path that reproduces the bug (or why none was written).

## Prevention Measures
What can be done to prevent similar bugs in the future.

## Lessons Learned
Key takeaways from this bugfix.
```

## Skill Invocation

### Command Format

```
/bugfix <bug description | GH issue URL | error logs | any combination>
```

### Examples

```
/bugfix The login page returns 500 when email contains a plus sign
/bugfix https://github.com/org/repo/issues/42
/bugfix TypeError: Cannot read property 'map' of undefined at UserList.tsx:47
/bugfix GH Actions failing on main — tests pass locally but CI shows ENOMEM
```

### Input Parsing

The skill detects input type:
- **GitHub URL**: fetch issue details via `gh issue view`
- **Stack trace**: extract file paths, line numbers, error type
- **Free text**: use as-is for investigation context
- **Mixed**: combine all inputs into structured bug context

## Configuration

### `.swarm.json` Extension

```json
{
  "bugfix": {
    "monitoring": {
      "ghActions": true,
      "localTests": true,
      "liveUrl": null,
      "logFiles": []
    },
    "maxInnerFixCycles": 3,
    "askUserEvery": 10,
    "worktreeDefault": "ask"
  }
}
```

## Edge Cases

- **Bug is not reproducible**: Investigator marks confidence as 'low', bugfix-agent proceeds with best-effort fix, monitoring phase is critical for verification.
- **Bug is in a dependency**: Investigator identifies via Context7/web search. Fix may be: pin version, upgrade, patch, or workaround. RCA documents the dependency issue.
- **Bug requires DB migration**: Bugfix-agent flags as `concern`, lead asks user before proceeding.
- **Multiple interrelated bugs**: Focus on the reported bug. Log related bugs in fixes.md. User can run `/bugfix` again for each.
- **Flaky test masking the bug**: Investigator uses git bisect and repeated runs to distinguish flaky tests from real failures.
- **Fix introduces new test failures**: Verification catches this. Bugfix-agent must fix both the bug and the regression before proceeding.
- **Debug instrumentation masks the real fix**: Detected in Phase D cleanup verification. Triggers re-investigation.

## Security

- Bugfix-agent must not introduce new vulnerabilities while fixing (security-agent gate ensures this).
- Investigator-agent must not expose secrets in investigation logs.
- Debug instrumentation must NEVER be committed (auto-cleanup in Phase D).
- Runtime debugging (DB queries, process inspection) follows least-privilege — read-only where possible.

## Performance

- Fast-fail verification order (tests → build → review+security) minimizes wasted compute.
- Investigator runs in parallel with Context7/web search for maximum investigation speed.
- Inner fix loop (review/security ↔ bugfix-agent) avoids full re-investigation for trivial fixes.

## Dependencies

- Existing agents: `test-agent`, `code-review-agent`, `security-agent` (reused as-is from `/swarm`)
- New agents: `bugfix-lead-agent`, `investigator-agent`, `bugfix-agent`
- External tools: `gh` CLI, Context7 MCP, Playwright (optional), project test runner
- Existing skill infrastructure: worktree management, specialist skills

## Out of Scope

- Feature development (use `/swarm` for that)
- Fixing multiple unrelated bugs in one session
- Post-deploy monitoring (after PR merge)
- Writing back to `docs/troubleshooting.md`
- Auto-creating GH issues for side bugs

## Open Questions

- None — all decisions made during interview.
