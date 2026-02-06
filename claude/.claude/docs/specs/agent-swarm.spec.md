# Agent Swarm (`/swarm`) — Spec

## Overview

A Claude Code skill that orchestrates a team of specialized agents to autonomously work through development tasks. Triggered via `/swarm <task>`, a Lead Agent reads specs, delegates work to planning, testing, coding, review, and security agents, loops until all spec items are complete, and produces a git commit + PR at the end.

## Architecture

### High-Level Flow

```
/swarm <task description>
        │
        ▼
┌─────────────────────────────┐
│       LEAD AGENT            │ ──→ docs/iterations.md (persistent, append)
│  Reads specs, orchestrates  │ ──→ docs/troubleshooting.md (persistent, append)
│  Loops until finished       │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐     ┌──────────────────┐
│   PLANIFICATION AGENT       │◄───►│   TEST AGENT     │
│  - Smart spec detection     │     │   - TDD strategy │
│  - /interview if needed     │     │   - Configurable │
│  - Updates workflow         │     │     per task     │
└─────────┬───────────────────┘     └──────────────────┘
          │
          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Code     │ │ Code     │ │ Code     │  ← Auto-detected + configurable
│ Agent TS │ │ Agent TS │ │ Agent    │    specialists, run in parallel
│ Expert   │ │ Expert   │ │ Astro    │
└──────┬───┘ └──────┬───┘ └──────┬───┘
       └────────────┼────────────┘
                    ▼
       ┌────────────────────────┐
       │  CODE REVIEW + SECURITY│ ──→ docs/fixes.md (loop-scoped, not persistent)
       │  - DRY, bad code       │     Quick fixes → direct to code agent
       │  - Security pitfalls   │     Big bugs → troubleshooting.md
       └────────────┬───────────┘     All fixes → iterations.md (log)
                    │
                    ▼
          ┌─────────────────┐
          │ Has updates?    │──Yes──→ Loop back to Code Agents + Tests
          └────────┬────────┘
                   │ No
          ┌─────────────────┐
          │ More spec items?│──Yes──→ Loop back to Lead Agent
          └────────┬────────┘
                   │ No
                   ▼
          docs/loopsummary.md (persistent)
          git commit + PR
```

### Detailed Agent Topology

```
                    ┌──────────────────────────────────┐
                    │          /SWARM                  │
                    │                                  │
        ──→         │  LEAD AGENT                      │
                    │  - Trigger & manage agents       │──→ docs/iterations.md
                    │  - Read specs, global vision     │──→ docs/troubleshooting.md
                    │  - Keep knowledge                │
                    │  - Loop until finished           │
                    │  Outputs: specs, state, memory   │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────┼───────────────────┐
                    │              │                   │
                    ▼              ▼                   │
    ┌───────────────────┐  ┌──────────────────┐        │
    │   TEST AGENT      │  │ PLANIFICATION    │        │
    │   TDD - write     │◄►│ - Takes specs    │        │
    │   tests before    │  │ - /interview     │        │
    │   development     │  │ - Update workflow│        │
    └───────────────────┘  │ - Loop           │        │
                           └──────┬───────────┘        │
                                  │                    │
                                  ▼                    │ M
          ┌────────────┬────────────┬──────────┐       │ A
          │            │            │          │       │ I
          ▼            ▼            ▼          │       │ N
          ┌────────┐ ┌────────┐ ┌────────┐     │       │
          │Code    │ │Code    │ │Code    │◄── Each is  │ L
          │Agent   │ │Agent   │ │Agent   │    an expert│ O
          │TS exp. │ │TS exp. │ │Astro   │    on its   │ O
          └───┬────┘ └───┬────┘ └───┬────┘    field    │ P
          ────┴──────────┴──────────┴────              │
                          │                            │
              reads fixes.md                           │
                          ▼                            │
          ┌───────────┐ ┌───────────┐                  │
          │CODE REVIEW│ │ SECURITY  │──→ docs/fixes.md │
          │- DRY      │ │- OWASP    │                  │
          │- fallbacks│ │- pitfalls │                  │
          │- bad code │ └───────────┘                  │
          └─────┬─────┘                                │
                │                                      │
                ▼                                      │
     ┌──────────────────────┐                          │
     │ Review/Security      │──Yes──→ loop to Code Agents
     │ returned updates?    │        + Tests only
     └──────────┬───────────┘
                │ No
     ┌──────────────────────┐
     │ More things to do    │──Yes──→ loop to Lead Agent
     │ per specs?           │        (full orchestration)
     └──────────┬───────────┘
                │ No
                ▼
       docs/loopsummary.md
```

## Context

Currently, Claude Code skills are single-agent — one prompt, one context window. For complex tasks (multi-file features, full-stack work), the user must manually coordinate multiple `/interview`, coding, review, and testing steps. This skill automates the entire development loop by orchestrating specialized subagents through Claude Code's `Task` tool.

## Functional Requirements

### Invocation

- **FR-1**: User invokes `/swarm <free-form task description>` to start the swarm
- **FR-2**: The Lead Agent derives a kebab-case session name from the description (e.g., "add user auth" -> `add-user-auth`)
- **FR-3**: The session name is used for doc headers and git branch naming

### Lead Agent (Orchestrator)

- **FR-4**: The Lead Agent is the main execution context of the skill — it reads specs, manages state, and delegates via the `Task` tool
- **FR-5**: On start, the Lead Agent checks for existing specs in `docs/specs/` matching the task
- **FR-6**: The Lead Agent auto-detects the project's tech stack by analyzing the codebase (package.json, file extensions, framework configs)
- **FR-7**: The Lead Agent checks for an optional `.swarm.json` config file at project root for overrides
- **FR-8**: The Lead Agent initializes/appends to persistent documentation files on each run

### Planification Agent

- **FR-9**: Spawned as a `Task` subagent by the Lead Agent
- **FR-10**: Smart spec detection — checks if existing specs cover the task, identifies gaps
- **FR-11**: If gaps are found, invokes the `/interview` skill to gather missing requirements
- **FR-12**: If a complete spec exists, skips the interview entirely
- **FR-13**: Produces an ordered task list with testing strategy per item
- **FR-14**: Determines testing approach per task item: strict TDD, flexible TDD, or post-code testing — based on the nature of the work (e.g., pure logic = strict TDD, UI components = flexible)
- **FR-15**: Updates workflow context with lessons from previous troubleshooting (reads `docs/troubleshooting.md`)

### Test Agent

- **FR-16**: Spawned as a `Task` subagent, receives the task list and testing strategy from Planification
- **FR-17**: For strict TDD items: writes complete test files before any Code Agent runs
- **FR-18**: For flexible items: writes test outlines/skeletons that Code Agents should satisfy
- **FR-19**: Communicates directly with the Planification Agent for clarification (hybrid communication)

### Code Agents (Specialists)

- **FR-20**: Multiple Code Agents are spawned in parallel via concurrent `Task` calls for independent work items
- **FR-21**: Auto-detection: the Lead Agent analyzes which files need modification and routes to the right specialist (TS, Astro, React, etc.)
- **FR-22**: Config override: `.swarm.json` can define which specialists are available and any custom system prompts
- **FR-23**: Each specialist receives its domain context (e.g., TS expert gets the `typescript` skill standards loaded)
- **FR-24**: Code Agents receive test files/outlines as context so they write code that satisfies the tests
- **FR-25**: If tasks are interconnected (e.g., shared types between frontend and backend), the Lead Agent passes shared context between them

### Code Review Agent

- **FR-26**: Spawned after Code Agents complete, reads all changed files
- **FR-27**: Checks for: DRY violations, useless fallbacks, dead code, bad patterns, code quality issues
- **FR-28**: Quick/trivial fixes: directly spawns a Code Agent subagent to fix immediately (no roundtrip through fixes.md)
- **FR-29**: Significant issues: writes to `docs/fixes.md` for the next loop iteration
- **FR-30**: All completed fixes are logged in `docs/iterations.md`

### Security Agent

- **FR-31**: Spawned in parallel with the Code Review Agent
- **FR-32**: Checks for: OWASP top 10, injection vulnerabilities, insecure defaults, missing input validation, security pitfalls
- **FR-33**: Same output behavior as Code Review Agent (quick fix -> direct agent, significant -> fixes.md)
- **FR-34**: Big/critical bugs are also appended to `docs/troubleshooting.md` (persistent)

### Main Loop

- **FR-35**: After review phase, the Lead Agent checks if code review or security returned updates
  - If yes -> loop back to Code Agents + Tests only (short loop — no re-planning needed)
- **FR-36**: After fixes are resolved, check if more spec items remain
  - If yes -> loop back to Lead Agent for full orchestration (Lead decides what to delegate next)
- **FR-37**: If nothing remains -> proceed to completion
- **FR-38**: No hard iteration limit — the context window is the natural boundary
- **FR-39**: The Lead Agent should summarize and compress between iterations to manage context budget
- **FR-40**: Exit condition: auto-exit for small tasks, ask user confirmation for large/risky tasks (threshold determined by number of files changed and spec complexity)

### Completion

- **FR-41**: Write final summary to `docs/loopsummary.md` (persistent, append with session header and timestamp)
- **FR-42**: Create a git commit with a descriptive message covering all changes
- **FR-43**: Create a PR via `gh pr create` with the summary content from loopsummary.md

## Documentation Model

| File | Persistence | Mode | Content |
|------|-------------|------|---------|
| `docs/iterations.md` | Persistent | Append | Log of each swarm session: iterations, what was done, fixes applied |
| `docs/troubleshooting.md` | Persistent | Append | Significant bugs and issues encountered across all sessions |
| `docs/loopsummary.md` | Persistent | Append | Final summary of each swarm run |
| `docs/fixes.md` | Loop-scoped | Fresh each iteration | Current fixes to apply — cleared after each review->fix cycle |

### Session Header Format

Each run appends a header like:
```markdown
## Session: add-user-auth — 2026-02-06T14:30:00

### Iteration 1
- Planification: detected existing spec, 5 tasks identified
- Test Agent: wrote 3 test files (strict TDD)
- Code Agents: TS expert (2 files), React expert (1 file)
- Review: 1 DRY violation (quick-fixed), 0 security issues

### Iteration 2
...
```

## Agent Communication Model

- **Hub model (default)**: All coordination goes through the Lead Agent
- **Hybrid exceptions**:
  - Test Agent <-> Planification Agent: direct context sharing for testing strategy
  - Review/Security Agent -> Code Agent: direct quick-fix delegation for trivial issues
- **Mechanism**: The `Task` tool's prompt parameter carries context between agents. No shared files needed for intra-loop communication — only the documentation files persist across loops.

## Configuration (`.swarm.json`)

Optional file at project root. Everything auto-detects by default.

```json
{
  "specialists": ["typescript", "astro", "react"],
  "defaultTestStrategy": "tdd-flexible",
  "autoCommit": true,
  "prOnComplete": true,
  "confirmExit": "auto"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `specialists` | `string[]` | auto-detect | Which skill-based specialists are available |
| `defaultTestStrategy` | `"tdd-strict" \| "tdd-flexible" \| "configurable"` | `"configurable"` | Default testing approach (Planification Agent can override per task) |
| `autoCommit` | `boolean` | `true` | Whether to auto-commit on completion |
| `prOnComplete` | `boolean` | `true` | Whether to create a PR on completion |
| `confirmExit` | `"auto" \| "always" \| "never"` | `"auto"` | When to ask user confirmation before ending |

## Edge Cases

- **No spec exists and user skips interview**: Lead Agent creates a minimal inline spec from the task description and proceeds
- **All code agents fail**: Lead Agent logs to troubleshooting.md and asks user for guidance
- **Review agents keep finding the same issue**: Lead Agent detects recurring fix patterns and escalates to user instead of looping infinitely
- **Context window approaching limit**: Lead Agent compresses iteration history, keeping only the latest iteration + summary of previous ones
- **Interconnected tasks across specialists**: Lead Agent serializes dependent tasks instead of parallelizing, passing output of one as input to the next
- **`.swarm.json` has invalid specialist**: Lead Agent warns and falls back to auto-detection for that specialist

## Security

- Code Agents follow OWASP top 10 guidelines (enforced by Security Agent in review)
- No secrets or credentials are committed (Security Agent checks for this)
- The swarm never runs `rm -rf`, `git push --force`, or other destructive commands
- Git operations are limited to: commit and PR creation (no force push, no branch deletion)

## Dependencies

- Claude Code CLI with `Task` tool support (subagent spawning)
- Existing Claude Code skills: `interview`, `typescript`, `react`, `astro`, `tailwind`, `vitest` (loaded as specialist context)
- `gh` CLI for PR creation
- Git for commit operations

## Out of Scope

- Real-time streaming of agent progress to the user (agents run as subagents)
- Custom agent definitions beyond skill-based specialists (no arbitrary agent configs in v1)
- Multi-repo support (single repo per swarm run)
- Rollback/undo of swarm changes (user can `git reset` manually)
- CI/CD integration (swarm creates PR, CI handles the rest)

## Open Questions

- Should the Lead Agent maintain a "knowledge base" that persists across swarm runs (beyond the doc files)? Could use Claude's auto-memory for this.
- Should there be a `/swarm --dry-run` mode that shows the plan without executing?
- Should the swarm support resuming a crashed/interrupted run?
