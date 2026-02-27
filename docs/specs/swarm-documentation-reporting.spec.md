# Swarm Documentation & Reporting — Spec

## Overview

Final phase of the swarm orchestration loop. After all spec items are implemented and committed, a documentation agent (Kimi K2.5) generates a delivery report covering what was built, how it was tested, and what review findings were resolved. The report is added to the PR body and committed as a markdown file.

## Context

This module runs once after all spec items have been processed by the development loop. It reads the accumulated session state (iterations, test results, review findings, commits) and produces human-readable documentation. The doc writer agent uses Kimi K2.5 via OpenCode, chosen for its strong long-form writing capabilities.

This spec depends on:
- `swarm-cli-config-events.spec.md` for events, state, and session context
- `swarm-driver-system.spec.md` for invoking the doc agent
- `swarm-planification-tdd.spec.md` for task types and test results
- `swarm-development-loop.spec.md` for iteration data, review findings, and git state

## Functional Requirements

- **FR-1**: After all spec items are complete, gather the following data from the session state via typed phase result accessors (`readPlanPhaseResult()`, `readTddPhaseResult()`, `readCodePhaseResult()`):
  - List of implemented spec items with their task decompositions
  - Per-spec-item iteration count and outcome (success/failure)
  - Test results: total tests, passing, failing, test file paths
  - Review findings: all critical/important findings and their resolutions
  - Git history: commits, changed files, branch name
  - Duration: start time, end time, total wall-clock time
- **FR-2**: Build a prompt for the doc writer agent that includes all gathered data (truncated per DOC-SC-1) and instructs it to produce a delivery report in markdown format containing:
  - **Summary**: one-paragraph overview of what was implemented
  - **Changes**: list of features/changes with the files involved
  - **Testing**: test coverage summary — which tests were written, pass/fail counts, test runner used
  - **Review**: security and code quality findings that were detected, how they were resolved
  - **Metrics**: iteration counts, agent invocations, total duration
- **FR-3**: Invoke the doc writer agent via the driver system with the `docs` role (Kimi K2.5 via OpenCode). Handle `AgentResult.success === false` as follows:
  - `timeout`, `crash`, `empty_output`, `invalid_json`: retry once. On second failure, fall back to template-based report and emit `agent:error`.
  - `aborted`: propagate cancellation immediately. Emit `phase:error` with `{ phase: 'docs', reason: 'aborted' }` and return without producing documentation.
  - `spawn_error`: fall back to template-based report immediately (no retry — the backend is unavailable). Emit `agent:error`.
  - Emit `agent:error` on every failure, including before retries.
- **FR-4**: Write the delivery report to `docs/swarm/<sessionId>/delivery-report.md` in the project directory. Create the directory if it doesn't exist. The AI-generated content must be sanitized per DOC-SC-4 before writing. Output path must be verified under `projectDir` per DOC-SC-3.
- **FR-5**: Write a per-iteration log to `docs/swarm/<sessionId>/iterations.md` that records what happened in each iteration:
  - Which agents were invoked (role, model, duration)
  - Which tests passed/failed
  - What review findings were raised (count by severity)
  - Which files changed
  - This file is generated deterministically from accumulated events via `ctx.emitter.getEvents()`, NOT by an AI agent (it's a structured log, not prose)
  - If the event stream contains zero `iteration:start` events, write an `iterations.md` with a "No iterations recorded" header
- **FR-6**: Update the PR body with the delivery report content. Invoke via `spawn('gh', ['pr', 'edit', prNumber.toString(), '--body-file', '-'])` piping the sanitized report content via stdin to avoid `ARG_MAX` limits (DOC-SC-1). If the delivery report exceeds 60,000 characters, truncate the PR body to a summary with a link to the committed `delivery-report.md`. If the PR update fails (network error, auth issue, PR closed/deleted), log a warning but don't fail the session — the report is already committed as a file.
- **FR-7**: Commit the documentation files (`delivery-report.md`, `iterations.md`) as a final commit on the feature branch. Stage only these two files by explicit path via `spawn('git', ['add', ...paths])` — never `git add -A`. Commit message: `docs(<sessionId>): add delivery report` — sanitized per DOC-SC-2, executed via `spawn('git', ['commit', '-m', message])`.
- **FR-8**: Mark the PR as ready for review using `spawn('gh', ['pr', 'ready', prNumber.toString()])`. Pre-flight: verify `gh auth status` before attempting PR operations. If `gh` is not authenticated or not installed, log a warning, skip FR-6 and FR-8, and still commit docs locally.
- **FR-9**: Emit the following events (all payloads must comply with DOC-SC-5):
  - `phase:start` with `{ phase: 'docs' }`
  - `agent:invoke` / `agent:result` (or `agent:error`) for the doc writer agent
  - `phase:end` with `{ phase: 'docs', durationMs }`
  - `session:end` with `{ success: boolean, durationMs }` — final summary metrics. The docs phase is ALWAYS the terminal phase and owns `session:end` emission. No phase runs after docs.
- **FR-10**: The docs phase must accept an optional `AbortSignal` and propagate it to `driver.invoke()` and all `gh`/`git` child processes. When aborted: kill the doc writer agent process if running, skip PR update and PR ready operations, emit `phase:error` with `{ phase: 'docs', reason: 'aborted' }`, and return a `DocsPhaseResult` with `success: false`. Do NOT fall back to template — an abort means the session is being cancelled, not that the agent failed.

## Data Model

```typescript
// === Imported Types (owned by other specs — NOT re-declared here) ===
// From swarm-cli-config-events.spec.md (Spec 1):
//   SessionContext, SwarmEventEmitter, SwarmStateManager, SwarmState, SessionId (branded)
//   Phase, AgentRole, SwarmEvent, PhaseError
//
// From swarm-driver-system.spec.md (Spec 2):
//   DriverRegistry, Driver, AgentRequest, AgentResult, ModelId (branded), BackendName
//
// From swarm-planification-tdd.spec.md (Spec 3):
//   PlannerTask, TaskTag, TestResult, PlanPhaseResult, TddPhaseResult
//
// From swarm-development-loop.spec.md (Spec 4):
//   CodePhaseResult, IterationState, IterationOutcome, MergedReview, ReviewFinding
//   ReviewCategory, GitState, CommitRecord, TaskBatch

// Input to the doc writer agent
interface DeliveryReportInput {
  sessionId: SessionId             // Branded — from Spec 1
  specPath: string
  specItems: SpecItemSummary[]
  totalDuration: number            // ms
  startedAt: string                // ISO-8601
  completedAt: string              // ISO-8601
}

interface SpecItemSummary {
  title: string
  iterationCount: number           // How many iterations were run for this spec item
  success: boolean
  tasks: TaskSummary[]
  testResult: TestResult           // From Spec 3 (singular — one TestResult per spec item)
  reviewFindings: ReviewFindingSummary[]
  commitHash?: string              // Absent when success is false (failed items not committed per Spec 4 FR-10)
}

interface TaskSummary {
  id: `TASK-${number}`             // From Spec 3
  title: string
  tag: TaskTag                     // From Spec 3: 'backend' | 'frontend' | 'fullstack'
  filesModified: string[]
}

// Extends ReviewFinding from Spec 4 with resolution tracking
type ReviewFindingSummary = Pick<ReviewFinding, 'severity' | 'category' | 'description'> & {
  resolved: boolean
  resolution?: string              // How the finding was resolved (absent when unresolved)
}

// Named type for agent invocation records in the iteration log
interface AgentInvocationRecord {
  role: AgentRole                  // From Spec 1
  model: string                   // Plain string because extracted from SwarmEvent payloads where ModelId brand is erased (AgentInvokeEvent.data.model: string)
  durationMs: number
}

// Iteration log entry (generated from events + phase results, not AI)
interface IterationLogEntry {
  specItem: string                 // Spec item title — derived from CodePhaseResult mapping, not from events
  iterationIndex: number           // 1-based index within the spec item
  agentsInvoked: AgentInvocationRecord[]
  testResult?: TestResult          // From Spec 3 — optional: absent when iteration timed out before tests
  reviewFindingCount: number       // Count of findings (the full findings are in the delivery report)
  filesChanged: string[]
}

// Phase result stored in SwarmState.phaseResults.docs
// Validated via Zod/Valibot on read (same pattern as CodePhaseResult in Spec 4)
interface DocsPhaseResult {
  deliveryReportPath: string       // Project-relative path: docs/swarm/<sessionId>/delivery-report.md
  iterationsLogPath: string        // Project-relative path: docs/swarm/<sessionId>/iterations.md
  commitHash?: string              // Absent if git commit failed. Present when success is true.
  prUpdated: boolean               // Whether the PR body was successfully updated
  prMarkedReady: boolean           // Whether the PR was successfully marked as ready
  usedFallbackReport: boolean      // true if doc writer agent failed and template-based fallback was used
  success: boolean                 // true if docs were written and committed (even with fallback).
                                   // false only on abort (FR-10) or git commit failure (FR-7).
                                   // Template fallback with successful commit = success: true.
}
```

### Error Types

This module does not define new error classes. Phase-level failures are propagated as `PhaseError` entries (defined in `swarm-cli-config-events.spec.md`) written to `SwarmState.errors`. Doc writer agent failures trigger a fallback to template-based report rather than propagating — the docs phase is resilient by design.

## Source File Structure

```
src/
  phases/
    docs-phase.ts              # runDocsPhase() — orchestrates data gathering, agent invocation, file writes, PR update
  report-builder.ts            # buildDeliveryReportInput() — transforms session state into DeliveryReportInput
  iteration-log-builder.ts     # buildIterationLog(), renderIterationLog() — deterministic NDJSON events → markdown
  fallback-report.ts           # generateFallbackReport() — template-based report when AI agent fails
  prompts/
    docs-prompt.ts             # buildDocWriterPrompt() — assembles doc writer agent prompt from DeliveryReportInput
  phase-results.ts             # DocsPhaseResult type, Zod/Valibot schema, readDocsPhaseResult() accessor
                               # (extends the existing phase-results pattern from Specs 3 and 4)
```

Type ownership: ALL types defined in this spec's Data Model section live in `phase-results.ts`. Other files import from there. This keeps the schema definition co-located with the Zod/Valibot validators and provides a single import path for consumers.

No `index.ts` — no barrel exports. Consumers import directly: `import { runDocsPhase } from './phases/docs-phase.ts'`.

Test files follow the `*.test.ts` convention co-located with source or in a `tests/` directory, using Vitest.

## API Contract

```typescript
// Docs phase — src/phases/docs-phase.ts
function runDocsPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  signal?: AbortSignal
): Promise<DocsPhaseResult>
// Reads plan, tdd, and code phase results from ctx.state via typed accessors
// (readPlanPhaseResult(), readTddPhaseResult(), readCodePhaseResult()).
// Gathers DeliveryReportInput via buildDeliveryReportInput().
// Builds iteration log via buildIterationLog() from ctx.emitter.getEvents().
// Invokes doc writer agent via registry.getDriver('docs').
// Falls back to generateFallbackReport() if agent fails after retry.
// Writes delivery-report.md and iterations.md to docs/swarm/<sessionId>/.
// Updates PR body (via stdin pipe to gh pr edit) and marks ready.
// Commits documentation files with sanitized message.
// Emits: phase:start(docs), agent:invoke, agent:result/agent:error, phase:end(docs), session:end.
// The docs phase is ALWAYS the terminal phase — it owns session:end emission.
// No phase runs after docs. The orchestration engine calls runDocsPhase() last.
// Persists DocsPhaseResult to ctx.state phaseResults.docs.
// See "Execution Order" in Business Logic for FR-6/FR-7/FR-8 sequencing.
//
// PR number: obtained from readCodePhaseResult().gitState.prNumber.
// If prNumber is undefined (no PR was created), skip FR-6 and FR-8 with a warning.
//
// Missing phase results: if readCodePhaseResult() or readPlanPhaseResult() returns null
// (phase never completed), skip buildDeliveryReportInput() and produce a minimal
// "session incomplete" fallback report. TddPhaseResult missing is non-fatal (test section
// will note "TDD phase did not complete").
//
// When codeResult is null, buildIterationLog() also cannot be called (it requires
// codeResult for spec item context). In this case, write iterations.md with the
// "No iterations recorded" fallback via renderIterationLog([]).

// Report builder — src/report-builder.ts
function buildDeliveryReportInput(
  ctx: SessionContext,
  planResult: PlanPhaseResult,
  tddResult: TddPhaseResult | null,
  codeResult: CodePhaseResult
): DeliveryReportInput
// Pure transformation — no I/O.
// Maps CodePhaseResult.iterations and planResult tasks into SpecItemSummary[].
// When tddResult is null (TDD phase did not complete), the "Testing" section notes this absence.
// When tddResult is present, uses tddResult.testFiles for "which tests were written."
// Uses codeResult.finalTestResult for per-spec-item test results.
// Computes totalDuration from session startedAt and current time.
// Derives review finding resolutions via classifyFindingResolutions():
// a finding is "resolved" if it appeared in iteration N but not in the MergedReview of iteration N+1.

// Review finding resolution classifier — src/report-builder.ts
function classifyFindingResolutions(
  iterations: IterationState[]
): ReviewFindingSummary[]
// Cross-iteration diffing: compares MergedReview.findings between consecutive iterations.
// A finding is "resolved" if it appeared in iteration N's review but not in iteration N+1's review
// (matched by exact string equality on file + category + whitespace-normalized description).
// Narrowing strategy: only iterations where outcome.status === 'green' || outcome.status === 'needs-iteration'
// have a guaranteed review. Iterations with status 'max-iterations' or 'timeout' may lack review —
// skip these for diffing. Findings from the preceding iteration with a defined review are treated as
// unresolved if the next iteration has no review.
// Pure function, no I/O.

// Iteration log — src/iteration-log-builder.ts
function buildIterationLog(
  events: SwarmEvent[],
  codeResult: CodePhaseResult
): IterationLogEntry[]
// Deterministic transformation of accumulated events + phase result context.
// The specItem field is derived from codeResult mapping (not from events, which lack spec item context).
// Groups events by iteration:start/iteration:end boundaries.
// Correlates agent:invoke with agent:result by role within each iteration
// (matched by temporal ordering: the first agent:result for a given role
// after an agent:invoke with that role, within the same iteration boundary).
// Extracts test results from test:green/test:fail events.
// Counts review findings from review:findings events.
// Collects changed files from file:changed events.
// If the number of iteration:start events found is less than codeResult.iterations.length,
// some events were evicted by the in-memory accumulator (10K bound, Spec 1). Add a note
// in the rendered output: "N iterations omitted due to event eviction."
// Pure function, no I/O.

function renderIterationLog(entries: IterationLogEntry[]): string
// Renders IterationLogEntry[] as markdown (structured sections, one per iteration).
// If entries is empty, returns "# Iterations\n\nNo iterations recorded.\n".
// Pure function, no I/O.

// Fallback report — src/fallback-report.ts
function generateFallbackReport(input: DeliveryReportInput): string
// Template-based markdown report populated from structured data.
// Used when the doc writer agent fails after retry.
// Produces the same sections as the AI report (Summary, Changes, Testing, Review, Metrics)
// but with straightforward data formatting instead of prose.
// Pure function, no I/O.

// Phase result accessor — src/phase-results.ts
function readDocsPhaseResult(state: SwarmState): DocsPhaseResult | null
// Read state.phaseResults.docs and validate via Zod/Valibot.
// Return null if absent. Throw validation error if present but structurally invalid.
// This is the ONLY way to read the docs phase result — never cast directly.
```

## Prompt Templates

### Doc Writer Agent Prompt (template structure)

The doc writer prompt must include these sections:
1. **Role**: You are a technical writer producing a delivery report for a software development session
2. **Session context**: session ID, spec file path, project description
3. **Spec items**: for each item — title, success/failure, iteration count, tasks involved
4. **Test results**: per-item test counts (total, passing, failing), test runner used
5. **Review findings**: all critical/important findings with their resolutions
6. **Git summary**: commits, changed files count, branch name
7. **Metrics**: total duration, per-item durations, agent invocation counts
8. **Output format**: produce a markdown document with sections: Summary, Changes, Testing, Review, Metrics
9. **Constraints**: aim for 1-2 pages, be concise, focus on what matters to a code reviewer

## Business Logic

### Delivery Report Generation
- The doc writer agent receives structured data (via `DeliveryReportInput`), not raw event logs. Swarm prepares a clean input summary via `buildDeliveryReportInput()`.
- The agent produces prose — this is the human-readable PR description.
- The report should be concise (aim for 1-2 pages). Detailed per-iteration data goes in `iterations.md`.
- The prompt payload must not exceed 256KB (DOC-SC-1). Individual finding descriptions are truncated to 2KB.

### Iteration Log Construction
- The iteration log is NOT generated by an AI agent. It's a deterministic transformation of the accumulated events from `ctx.emitter.getEvents()`.
- Events are correlated within `iteration:start` / `iteration:end` boundaries. Within each iteration:
  - `agent:invoke` and `agent:result` events are matched by `role` + temporal ordering (the first `agent:result` for a given role after an `agent:invoke` with that role)
  - `test:green` or `test:fail` provides the `testResult` (absent for `timeout` iterations where tests never ran)
  - `review:findings` provides the `reviewFindingCount`
  - `file:changed` events provide the `filesChanged` list
- Format: markdown structured sections, one per iteration.
- This file serves as the detailed audit trail for debugging and review.
- Size capped at 1MB (DOC-SC-6). If exceeded, keep first and last iterations with a truncation note.

### PR Update
- The PR was opened as a draft in the development loop phase (Spec 4 FR-11).
- This phase updates the body with the delivery report and marks it ready.
- Pre-flight: verify `gh auth status` before attempting PR operations. If `gh` is not authenticated or not installed, log a warning, skip PR update and ready marking, and still commit docs locally.
- PR body content piped via stdin to `spawn('gh', ['pr', 'edit', prNumber.toString(), '--body-file', '-'])` to avoid `ARG_MAX` limits.
- If the delivery report exceeds 60,000 characters, truncate the PR body to a summary section with a link to the committed `delivery-report.md` file.
- If the PR was closed or deleted during the session: log warning, skip PR update, still commit docs.

### Partial Success
- If some spec items failed (hit max iterations without GREEN), the delivery report must clearly state which items succeeded and which failed, with failure reasons.
- The PR is still updated and marked ready — the reviewer decides whether to merge partial work.

### Execution Order
- FR-6 (PR update), FR-7 (commit docs), FR-8 (mark PR ready) execute in order.
- If FR-6 fails: FR-7 still runs (commit docs locally), FR-8 is skipped (can't mark ready if body wasn't updated).
- If FR-7 fails (git commit error): FR-8 is skipped. Emit `phase:error`.
- The docs phase never aborts the session — even total failure of all doc operations results in a warning, not a session failure. The code is already committed.

## Edge Cases

- No review findings at all: the "Review" section states "No issues detected."
- All spec items failed: delivery report becomes a failure report with details on what went wrong.
- Doc writer agent fails (timeout, crash, empty output, invalid JSON): retry once, then fall back to a template-based report (fill in the data without AI prose). The structured data is always available. Emit `agent:error`.
- Doc writer agent fails with `spawn_error`: fall back to template immediately (no retry — backend unavailable).
- Doc writer agent fails with `aborted`: propagate cancellation. Emit `phase:error`. Do NOT fall back to template.
- PR was closed or deleted during the session: log warning, skip PR update, still commit docs.
- Session has zero iterations (all tests passed immediately in TDD phase): report this unusual case.
- `gh` CLI not authenticated or not installed: log warning, skip PR operations (FR-6, FR-8), commit docs locally (FR-7).
- PR body exceeds 60,000 characters: truncate with a link to the committed file.
- AbortSignal fires during doc writer invocation: kill agent process, skip PR operations, return `DocsPhaseResult` with `success: false`.
- Session state missing phase results (e.g., code phase never ran or crashed): `buildDeliveryReportInput()` handles absent results gracefully, producing a report that notes missing phases.
- Iteration log has no events (empty session): produce `iterations.md` with a "No iterations recorded" header.
- `git add` fails (file deleted between verification and staging, disk full): treat as git commit failure — emit warning, `commitHash` undefined, `success: false`.
- `git commit` fails during docs commit: emit warning, `DocsPhaseResult.commitHash` left undefined, `DocsPhaseResult.success` set to `false`.
- `prNumber` is undefined (no PR was created by the development loop): skip PR update (FR-6) and PR ready (FR-8) with a warning, still commit docs locally (FR-7).

## Security Constraints

- **DOC-SC-1 — Doc agent prompt payload limits**: The structured data embedded in the doc writer agent prompt must not exceed 256KB total. `ReviewFindingSummary.description` and `ReviewFindingSummary.resolution` fields must be individually truncated to 2KB (consistent with DL-SC-7). `AgentResult.rawOutput` from prior phases must never appear in the doc agent's prompt (per DS-6 from driver spec). Only structured summaries derived from session state are passed to the doc writer.
- **DOC-SC-2 — Commit message sanitization**: Commit messages MUST be sanitized per DL-SC-4: strip control characters (ASCII 0-31 except newline, ASCII 127, Unicode U+0080-U+009F, U+200B-U+200F, U+2028-U+2029), limit to 500 characters. The `<sessionId>` in `docs(<sessionId>): ...` is already validated as `SessionId` (SC-1). Messages passed to `spawn('git', ['commit', '-m', message])` as a single array element — never shell-interpolated.
- **DOC-SC-3 — Output path containment**: The `sessionId` used in file path construction (`docs/swarm/<sessionId>/`) MUST be the branded `SessionId` type (validated per SC-1). Output paths must be constructed via `path.resolve(projectDir, 'docs', 'swarm', sessionId, filename)` and verified to reside under `projectDir` before any write operation. Consistent with SC-4.
- **DOC-SC-4 — AI output sanitization**: The delivery report from the doc writer agent MUST be sanitized before writing to disk or injecting into the PR body. Steps in order: (a) validate as valid UTF-8, (b) strip dangerous HTML elements (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`), inline event handlers (`on*` attributes), `javascript:` URIs, and `data:` URIs, (c) strip invisible Unicode characters (U+200B-U+200F, U+2028-U+2029, U+FEFF, U+2060-U+2064), (d) truncate to 256KB maximum as the final step (after all other sanitization).
- **DOC-SC-5 — Event payload compliance**: All events emitted during the documentation phase must comply with SC-5 from the foundation spec (64KB max, no raw file contents, no full prompts). The delivery report content must NOT be included in event payloads — use file path and byte count references only.
- **DOC-SC-6 — Iteration log size bound**: The generated `iterations.md` file must be capped at 1MB. If the accumulated events would produce a larger file, keep the first and last iterations with a note indicating truncation.
- **DOC-SC-7 — Safe command construction**: All shell commands (`gh`, `git`) MUST be invoked via `child_process.spawn()` with argument arrays — never `child_process.exec()` with string interpolation. The PR body content must be piped via stdin (not passed as a shell argument). PR numbers must be validated as positive integers and converted via `prNumber.toString()`. Consistent with DL-SC-1.
- **DOC-SC-8 — Command timeouts**: All `gh` CLI commands (`gh pr edit`, `gh pr ready`, `gh auth status`) must have a 30-second timeout. All `git` commands (`git add`, `git commit`) must have a 60-second timeout. On timeout, the command is killed and the operation is treated as failed (warning logged, not session-fatal). Timeouts use the same SIGTERM → 5s → SIGKILL pattern from the driver spec (DS-7), including the `let killStarted = false` kill-guard to prevent concurrent timeout + AbortSignal from executing the kill sequence twice.

## Dependencies

### Internal (other specs in this project)
- `swarm-cli-config-events.spec.md`: `SessionContext`, `SwarmEventEmitter`, `SwarmStateManager`, `SwarmState`, `SessionId`, `Phase`, `AgentRole`, `SwarmEvent`, `PhaseError`, event types (`PhaseStartEvent`, `PhaseEndEvent`, `PhaseErrorEvent`, `AgentInvokeEvent`, `AgentResultEvent`, `AgentErrorEvent`, `SessionEndEvent`)
- `swarm-driver-system.spec.md`: `DriverRegistry`, `Driver`, `AgentRequest`, `AgentResult`, `ModelId`, `BackendName`
- `swarm-planification-tdd.spec.md`: `PlannerTask`, `TaskTag`, `TestResult`, `PlanPhaseResult`, `TddPhaseResult`
- `swarm-development-loop.spec.md`: `CodePhaseResult`, `IterationState`, `IterationOutcome`, `MergedReview`, `ReviewFinding`, `ReviewCategory`, `GitState`, `CommitRecord`, `TaskBatch`

NOTE: `DeliveryReportInput`, `SpecItemSummary`, `TaskSummary`, `ReviewFindingSummary`, `AgentInvocationRecord`, `IterationLogEntry`, and `DocsPhaseResult` are defined in this spec and are terminal — no downstream spec consumes them.

### External (libraries, services)
- Node.js `child_process` (built-in) for running git and gh commands
- `gh` CLI for PR body update and ready marking
- `git` CLI for committing documentation files
- `zod` or `valibot` — runtime validation for phase result schemas

## Out of Scope

- AI-powered PR review comments (the PR body is updated, but no inline review comments)
- Changelog generation (separate from delivery report)
- Notifications (Slack, email) — future integration point

## Acceptance Criteria

- [ ] Session state is correctly gathered via typed phase result accessors (FR-1)
- [ ] Doc writer agent is invoked with structured input data, prompt capped at 256KB (FR-2, DOC-SC-1)
- [ ] `AgentResult.success === false` handled per FR-3 (retry for timeout/crash/empty/invalid, fallback for spawn_error, propagate abort)
- [ ] Delivery report is written to `docs/swarm/<sessionId>/delivery-report.md` (FR-4)
- [ ] Delivery report contains: Summary, Changes, Testing, Review, Metrics sections (FR-2)
- [ ] AI output sanitized before disk write and PR body injection (DOC-SC-4)
- [ ] Iteration log is written to `docs/swarm/<sessionId>/iterations.md` (FR-5)
- [ ] Iteration log is generated from events (deterministic, not AI) (FR-5)
- [ ] Iteration log capped at 1MB with truncation (DOC-SC-6)
- [ ] PR body updated via stdin pipe to `gh pr edit --body-file -` (FR-6, DOC-SC-7)
- [ ] PR body truncated to 60K chars with file link if report too large (FR-6)
- [ ] PR marked as ready for review (FR-8)
- [ ] `gh auth status` verified before PR operations (FR-8)
- [ ] Documentation files staged by explicit path — never `git add -A` (FR-7)
- [ ] Commit message sanitized per DOC-SC-2 (FR-7)
- [ ] Documentation files committed with `docs(<sessionId>): add delivery report` (FR-7)
- [ ] Partial success (some spec items failed) is clearly reported (Business Logic)
- [ ] Doc writer failure falls back to template-based report (FR-3, Edge Cases)
- [ ] All events emitted correctly per FR-9, compliant with SC-5 (DOC-SC-5)
- [ ] `AbortSignal` propagated to driver.invoke() and child processes (FR-10)
- [ ] Output file paths verified under `projectDir` (DOC-SC-3)
- [ ] All shell commands use `spawn()` with argument arrays — no `exec()` (DOC-SC-7)
- [ ] `DocsPhaseResult` persisted in session state with Zod/Valibot schema
- [ ] `readDocsPhaseResult()` typed accessor validates on read
- [ ] `DeliveryReportInput`, `TaskSummary`, `ReviewFindingSummary` use proper branded/union types from upstream specs
- [ ] `buildDeliveryReportInput()` accepts `PlanPhaseResult`, `TddPhaseResult`, and `CodePhaseResult`
- [ ] `buildIterationLog()` accepts events + `CodePhaseResult` for spec item context
- [ ] `classifyFindingResolutions()` correctly identifies resolved findings by cross-iteration diffing
- [ ] Fallback report contains the same 5 sections as the AI report (Summary, Changes, Testing, Review, Metrics)
- [ ] `gh` and `git` commands have timeouts (30s and 60s respectively, DOC-SC-8)
- [ ] `session:end` emitted by docs phase (terminal phase)
- [ ] All tests pass with `pnpm test`
