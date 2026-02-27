# Swarm Development Loop — Spec

## Overview

Core development phase of the swarm orchestrator. Takes the task decomposition and failing tests from the planification/TDD phase, runs parallel code agents to implement the tasks, then runs parallel code review + security review with a merge agent to consolidate findings. Loops until all TDD tests pass (GREEN) with clean review or max iterations reached. Commits when green and clean.

## Context

This is the heart of swarm. After the planner has decomposed work into tagged tasks and the test agent has written failing tests, this module:

1. Groups tasks into parallel batches (respecting dependencies)
2. Dispatches code agents in parallel, routing each to the right backend/model based on task tags
3. Runs the test suite after each batch
4. Runs code review (Claude) and security review (GPT-5.3) in parallel
5. A merge agent consolidates review findings
6. If tests still fail or reviews have critical findings → re-run code agents with feedback (up to 5 iterations)
7. When tests pass GREEN and review is clean → commit

This spec depends on:
- `swarm-cli-config-events.spec.md` for events, state, config
- `swarm-driver-system.spec.md` for invoking agents
- `swarm-planification-tdd.spec.md` for task decomposition, test files, and shared types (`PlannerTask`, `TestResult`, `TaskTag`, `TechStack`, `runTestSuite()`)

## Functional Requirements

- **FR-1**: Implement a task scheduler that groups tasks into parallel batches based on their dependency graph:
  - Tasks with no dependencies form the first batch
  - Tasks whose dependencies are all in previous batches form the next batch
  - Continue until all tasks are scheduled
  - Tasks in the same batch run in parallel; batches run sequentially
- **FR-2**: For each batch, spawn code agents in parallel (bounded by `maxParallelAgents`, default 5, DL-SC-8). Each code agent receives:
  - Its specific task (title, description, files, test hints) from the planner output
  - The relevant test files and their expected behavior
  - The project's tech stack and conventions
  - Previous iteration feedback (review findings from prior iteration, if any — truncated per DL-SC-7)
- **FR-3**: Route each code agent to the correct backend and model based on the task's tag:
  - Use `registry.getDriver('code', task.tag)` to resolve the driver and model
  - If a tag-specific override exists (e.g., `code-frontend` in config), use it. Otherwise, fall back to the base `code` role.
  - This leverages `getModelAssignment(config, 'code', tag)` from the foundation spec, which resolves `config.models.tagged["code-<tag>"]` → `config.models.agents.code`
- **FR-4**: The code agent prompt template must instruct the agent to:
  - Implement the task as described
  - Write code that makes the associated tests pass
  - Follow the project's coding conventions
  - Report what files were created or modified
  - Run sanity checks before finishing: lint (detect from project — biome, eslint), type check (`tsc --noEmit`, `astro check`), and ensure no import errors
- **FR-5**: After all code agents in a batch complete, run the full test suite using `runTestSuite()` from Spec 3 (shared test runner):
  - Execute via `child_process.spawn()` with argument arrays (per PT-SC-2 from Spec 3, DL-SC-6)
  - Enforce configurable timeout (default: 120s) with process group kill
  - Capture and truncate test output to 64KB (per PT-SC-4)
  - Record the test result. Regardless of pass/fail, proceed to the review phase.
- **FR-6**: Run code review and security review in parallel using two independent agents:
  - **Code reviewer** (`review` role): reviews the git diff of changed files for correctness, code quality, patterns, DRY violations, potential bugs
  - **Security reviewer** (`security` role): reviews the git diff of changed files for OWASP top 10, injection risks, auth issues, data exposure
  - Each receives: the git diff (not full files — per DL-SC-5), the spec item context, the test results
- **FR-7**: After both reviewers complete, invoke a merge agent (`merge` role) that:
  - Receives both review outputs
  - Deduplicates findings (same issue reported by both reviewers — match by file + line + category)
  - Categorizes each finding as: `critical` (must fix), `important` (should fix), or `suggestion` (nice to have)
  - Produces a consolidated list of actionable findings
  - After merge, programmatically verify that every `critical`-severity finding from both input reviews is present in the merged output (DL-SC-9). If any critical finding was dropped, restore it and emit a warning.
- **FR-8**: After the merge agent produces the merged review, evaluate the iteration outcome:
  - If tests pass (`failingTests === 0`) AND no critical or important findings → exit loop successfully
  - If tests fail OR critical/important findings exist:
    - Increment the iteration counter
    - Feed the findings back to the code agents as additional context (truncated per DL-SC-7)
    - Re-run the development subloop (batched code agents → test → review → merge)
  - Continue until: tests pass AND no critical/important findings, OR max iterations (5) reached
- **FR-9**: When the loop exits successfully (GREEN + clean review):
  - Verify all files in `changedFiles` against the staging blocklist (DL-SC-3)
  - Stage only the verified files via `spawn('git', ['add', ...files])` — never `git add -A` or `git add .`
  - Sanitize the commit message (DL-SC-4): strip control characters, limit to 500 chars
  - Create a git commit via `spawn('git', ['commit', '-m', message])` — message as a single array element, never shell-interpolated
  - Emit `commit` event with commit hash and changed files count
- **FR-10**: When the loop exits by reaching max iterations:
  - Report failure with: which tests still fail, which review findings are unresolved
  - Do NOT commit incomplete work
  - Emit `iteration:end` with `{ iteration: N, success: false }`
  - The orchestrator decides whether to continue with the next spec item or abort
- **FR-11**: Implement session-level git operations (run once before the first spec item):
  - Create a feature branch at session start: `feat/<sessionId>` from the current HEAD (DL-SC-10 validates sessionId)
  - Push the branch and open a draft PR (via `gh pr create --draft`)
  - PR body starts with "Work in progress — swarm session `<sessionId>`"
  - These operations are session-scoped, not spec-item-scoped
- **FR-12**: Implement per-spec-item commit and PR finalization:
  - Make commits per spec item (not per iteration — only commit when GREEN + clean review)
  - After all spec items complete, update PR body with delivery report (from Spec 5) and mark as ready for review
- **FR-13**: Emit the following events during this phase (all payloads must comply with SC-5, DL-SC-12):
  - `iteration:start` with `{ iteration: N, batchCount: N }`
  - `agent:invoke` / `agent:result` (or `agent:error`) for each code agent (with role `'code'`)
  - `test:green` or `test:fail` with test counts (using Spec 1's `TestGreenEvent` / `TestFailEvent` payloads)
  - `agent:invoke` / `agent:result` for each reviewer and the merge agent
  - `review:findings` with `{ critical: N, important: N, suggestion: N }`
  - `iteration:end` with `{ iteration: N, success: boolean }`
  - `commit` with `{ hash: string, message: string, filesChanged: number }`
  - `file:changed` for each file modified by code agents (path relative to projectDir) — emitted after post-agent file verification (FR-17) confirms the file is within `projectDir` and not a CI-sensitive violation
- **FR-14**: Track changed files across iterations to provide accurate diffs to reviewers:
  - After each batch, verify self-reported file lists against `git diff --name-only HEAD` as the authoritative source (DL-SC-2)
  - Only send actually modified files to review, not the entire codebase
  - Include discrepancies between self-reported and actual changes in the iteration state
- **FR-15**: After every driver invocation (code agents, reviewers, merge agent), inspect `AgentResult.success`:
  - If `success === true`, proceed with `result.output`
  - If `success === false`, behavior depends on `errorCode`:
    - `timeout`, `crash`: retry the individual agent up to 2 times. Emit `agent:error` before each retry.
    - `aborted`: propagate cancellation immediately. Emit `phase:error` and return.
    - `spawn_error`: emit `phase:error` and abort (environment is broken).
    - `empty_output`, `invalid_json`: retry up to 2 times with the error details appended to the prompt.
  - If all retries are exhausted, mark the task as failed and include it in the next iteration's feedback.
- **FR-16**: The development loop must accept an `AbortSignal` and propagate it to all `driver.invoke()` calls, `runTestSuite()` calls, and git operations. When aborted, all child processes are killed via process group (per DS-7 from driver spec).
- **FR-18**: Enforce a phase-level timeout (default: 60 minutes, configurable) as an upper bound for the entire development loop. When this fires, abort all running operations via an internal `AbortController` and return a failure `CodePhaseResult`. This prevents pathological cases (e.g., 5 iterations × multiple batch retries × agent timeouts) from running indefinitely.
- **FR-17**: After each code agent completes, verify all modified/created files via `git diff --name-only HEAD` (DL-SC-2). Every file must reside under `projectDir`. Modifications to CI-sensitive paths (`.github/`, `.gitlab-ci.yml`, `Dockerfile`, `docker-compose*`) not present in the agent's assigned file list are a hard error.

## Data Model

```typescript
// === Imported Types (owned by other specs — NOT re-declared here) ===
// From swarm-planification-tdd.spec.md (Spec 3):
//   PlannerTask  — { id: `TASK-${number}`, title, description, tag: TaskTag, files, dependencies, testHints }
//   TestResult   — { totalTests, passingTests, failingTests, durationMs }
//   TaskTag      — 'backend' | 'frontend' | 'fullstack'
//   TechStack    — { languages, frameworks, testRunner, packageManager, buildTool, configFiles, testCommand }
//
// From swarm-cli-config-events.spec.md (Spec 1):
//   SessionContext, SwarmEventEmitter, SwarmStateManager, SwarmConfig, ResolvedConfig, AgentRole, Phase
//   SessionId (branded), PhaseError, SwarmState, PhaseErrorEvent
//
// From swarm-driver-system.spec.md (Spec 2):
//   DriverRegistry, Driver, AgentRequest, AgentResult, DriverResolution, ModelId (branded), BackendName

// Task batch for parallel execution
interface TaskBatch {
  batchIndex: number
  tasks: PlannerTask[]  // Imported from Spec 3
}

// Code agent output (structured JSON output from code agents)
type CodeAgentOutput =
  | {
      taskId: `TASK-${number}`
      status: 'completed'
      filesModified: string[]       // Project-relative paths
      filesCreated: string[]        // Project-relative paths
      sanityChecksPassed: true
    }
  | {
      taskId: `TASK-${number}`
      status: 'failed' | 'blocked'
      filesModified: string[]
      filesCreated: string[]
      sanityChecksPassed: false
      sanityErrors: [string, ...string[]]  // Non-empty tuple — type-level guarantee
    }

// Review finding category — union type for consistent categorization
// 'security' is the umbrella category for all security-related findings (injection, auth, data exposure, etc.)
// The specific sub-type (e.g., "injection", "auth bypass") is captured in ReviewFinding.description.
type ReviewCategory = 'bug' | 'security' | 'quality' | 'performance' | 'dry-violation' | 'dead-code'

// Review finding from either code reviewer or security reviewer
interface ReviewFinding {
  file: string                       // Project-relative path
  line?: number                      // Absent for file-level findings
  severity: 'critical' | 'important' | 'suggestion'
  category: ReviewCategory
  description: string
  suggestedFix?: string
}

// Consolidated review output from the merge agent
interface MergedReview {
  findings: ReviewFinding[]
  criticalCount: number
  importantCount: number
  suggestionCount: number
  // Loop control is NOT stored here — the loop controller computes:
  //   const needsIteration = review.criticalCount > 0 || review.importantCount > 0
}

// Iteration outcome — discriminated union for loop control
type IterationOutcome =
  | { status: 'green'; testResult: TestResult; review: MergedReview }
  | { status: 'needs-iteration'; testResult: TestResult; review: MergedReview; reason: 'tests-failing' | 'review-findings' }
  | { status: 'max-iterations'; testResult: TestResult; review?: MergedReview }
  | { status: 'timeout'; testResult?: TestResult; review?: MergedReview }

// Per-iteration state snapshot
interface IterationState {
  iteration: number
  outcome: IterationOutcome
  changedFiles: string[]              // Authoritative list from git diff, not self-reported
}

// Individual commit record
interface CommitRecord {
  hash: string
  message: string
  specItem: string
  iteration: number
}

// Git state tracked across the session
interface GitState {
  branch: string
  prNumber?: number
  prUrl?: string
  commits: CommitRecord[]
}

// Phase result stored in SwarmState.phaseResults.code
// Validated via Zod/Valibot on read (same pattern as PlanPhaseResult, TddPhaseResult in Spec 3)
// Named return types for file verification functions
interface FileContainmentResult {
  violations: string[]               // Files outside projectDir
  ciSensitive: string[]              // CI-sensitive files not in assigned list
}

interface StagingCheckResult {
  allowed: string[]                  // Files safe to stage
  blocked: string[]                  // Files matching blocklist patterns
}

interface CodePhaseResult {
  batches: TaskBatch[]               // Task batches (same across all iterations)
  iterations: IterationState[]
  finalTestResult: TestResult        // Imported from Spec 3
  finalReview?: MergedReview         // Absent only when the loop exited at max-iterations before the review
                                     // phase completed for the final iteration. In this case,
                                     // iterations[last].outcome.review is also undefined.
  gitState: GitState
  changedFiles: string[]             // Cumulative across all iterations
  success: boolean
  codePhaseTimeoutMs?: number        // Set if the phase was aborted due to phase-level timeout
}
```

### Error Types

This module does not define new error classes. Phase-level failures are propagated as `PhaseError` entries (defined in `swarm-cli-config-events.spec.md`) written to `SwarmState.errors`. Unrecoverable failures (all agents in a batch fail after retry, max iterations reached) emit `phase:error` and return — the orchestration engine records them as `PhaseError` entries.

## Source File Structure

```
src/
  phases/
    code-phase.ts             # runCodePhase(), runIteration() — main dev loop + per-iteration logic
  task-scheduler.ts           # buildTaskBatches() — topological sort into parallel batches (FR-1)
  code-agent-output.ts        # parseCodeAgentOutput() — validates code agent structured output
  review-merge.ts             # runReviewPhase(), verifyMergeIntegrity() — review orchestration (FR-6, FR-7)
  git-operations.ts           # createFeatureBranch(), commitSpecItem(), openDraftPr(), markPrReady() (FR-9, FR-11, FR-12)
  file-verification.ts        # verifyFileContainment(), checkStagingBlocklist() — post-agent security (FR-14, FR-17)
  prompts/
    code-agent-prompt.ts      # buildCodeAgentPrompt() — assembles code agent prompt (FR-2, FR-4)
    review-prompt.ts          # buildReviewPrompt() — code reviewer prompt (FR-6)
    security-prompt.ts        # buildSecurityPrompt() — security reviewer prompt (FR-6)
    merge-prompt.ts           # buildMergePrompt() — merge agent prompt (FR-7)
  phase-results.ts            # All exported types (CodePhaseResult, IterationState, IterationOutcome,
                              #   MergedReview, ReviewFinding, ReviewCategory, CodeAgentOutput,
                              #   CommitRecord, GitState, TaskBatch, FileContainmentResult,
                              #   StagingCheckResult), Zod/Valibot schemas, readCodePhaseResult()
```

Type ownership: ALL types defined in this spec's Data Model section live in `phase-results.ts`. Other files import from there. This keeps the schema definition co-located with the Zod/Valibot validators and provides a single import path for Spec 5 consumers.

No `index.ts` — no barrel exports. Consumers import directly: `import { runCodePhase } from './phases/code-phase.ts'`.

Test files follow the `*.test.ts` convention co-located with source or in a `tests/` directory, using Vitest.

## API Contract

```typescript
// Code phase — src/phases/code-phase.ts
function runCodePhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  plan: PlanPhaseResult,
  tdd: TddPhaseResult,
  signal?: AbortSignal
): Promise<CodePhaseResult>
// Main development loop. Reads tasks from plan, builds batches via buildTaskBatches().
// Wraps runIteration() in a loop (max 5 iterations).
// Enforces a phase-level timeout (default: 60 minutes) as an upper bound for the
// entire development loop. When this fires, abort all running operations via AbortSignal.
// Note: ctx.config is ResolvedConfig — use ctx.config.config to access SwarmConfig for
// getModelAssignment(). Alternatively, destructure: const { config } = ctx.config.
// Emits all events listed in FR-13.
// Persists CodePhaseResult to ctx.state phaseResults.code.
//
// Session-level git operations (FR-11: createFeatureBranch, openDraftPr) and
// PR finalization (FR-12: markPrReady) are the responsibility of the orchestration
// engine that calls runCodePhase() per spec item. This function only handles
// per-spec-item commits via commitSpecItem().

function runIteration(
  ctx: SessionContext,
  registry: DriverRegistry,
  batches: TaskBatch[],
  techStack: TechStack,
  specItemContext: string,
  previousFindings?: ReviewFinding[],
  signal?: AbortSignal
): Promise<IterationOutcome>
// Single iteration body: runs batched code agents, test suite, review phase.
// specItemContext: the spec item title and description (passed through to runReviewPhase).
// Returns IterationOutcome discriminated union.
// Extracted from runCodePhase() for unit testability.

// Task scheduling — src/task-scheduler.ts
function buildTaskBatches(tasks: PlannerTask[]): TaskBatch[]
// Topological sort. Returns ordered batches.
// Throws on cycle detection (defensive — planification should catch this).
// Pure function, no I/O.

// Git operations — src/git-operations.ts
function createFeatureBranch(
  sessionId: SessionId,
  projectDir: string
): Promise<string>
// Creates feat/<sessionId> from HEAD via spawn('git', [...]).
// Validates sessionId matches /^[a-zA-Z0-9_-]{1,64}$/ (defense-in-depth).
// Returns branch name.

function openDraftPr(
  branch: string,
  sessionId: SessionId,
  projectDir: string
): Promise<{ prNumber: number; prUrl: string }>
// Opens a draft PR via spawn('gh', ['pr', 'create', '--draft', ...]).
// Pre-flight: verifies gh auth status before attempting PR creation.
// Returns PR metadata.

function commitSpecItem(
  projectDir: string,
  changedFiles: string[],
  message: string
): Promise<string>
// Stages only specified files via spawn('git', ['add', ...files]).
// If changedFiles exceeds 100 entries, stages in batches to avoid ARG_MAX limits.
// Checks staging blocklist first (DL-SC-3).
// Sanitizes message (DL-SC-4): strips control chars, limits to 500 chars.
// Creates commit via spawn('git', ['commit', '-m', message]).
// Returns commit hash via spawn('git', ['rev-parse', 'HEAD']) — not parsed from git commit stdout.
// Never uses git add -A or git add .

function markPrReady(
  prNumber: number,
  projectDir: string
): Promise<void>
// Marks the draft PR as ready via spawn('gh', ['pr', 'ready', ...]).

// Review orchestration — src/review-merge.ts
function runReviewPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  changedFiles: string[],
  specItemContext: string,
  testResult: TestResult,
  signal?: AbortSignal
): Promise<MergedReview>
// Runs code review ('review' role) and security review ('security' role) in parallel.
// MUST filter changedFiles against DL-SC-5 sensitive patterns before building review prompts.
// specItemContext: the spec item title and description (max 4KB, truncated if larger).
// Invokes merge agent ('merge' role) to consolidate findings.
// Verifies merge integrity (DL-SC-9): critical findings not silently dropped.
// Emits agent:invoke/agent:result events for each reviewer and the merge agent.

// File verification — src/file-verification.ts
function verifyFileContainment(
  projectDir: string,
  assignedFiles: string[],
  actualFiles: string[]
): FileContainmentResult
// Compares actual modified files (from git diff) against assigned file list.
// Identifies files outside projectDir and CI-sensitive modifications.

function checkStagingBlocklist(files: string[]): StagingCheckResult
// Filters files against sensitive patterns (.env*, *.pem, *.key, *.p12, *.pfx, .npmrc, .netrc, etc.).
// Returns partitioned lists.

// Phase result accessor — src/phase-results.ts
function readCodePhaseResult(state: SwarmState): CodePhaseResult | null
// Read state.phaseResults.code and validate via Zod/Valibot.
// Return null if absent. Throw validation error if present but structurally invalid.
// This is the ONLY way to read the code phase result — never cast directly.
```

## Prompt Templates

### Code Agent Prompt (template structure)

The code agent prompt must include these sections:
1. **Role**: You are a code agent implementing a specific task
2. **Task details**: title, description, files to create/modify, test hints
3. **Test files**: the test files written by the test agent, and their expected behavior
4. **Tech stack**: detected tech stack details and conventions
5. **Previous feedback** (iteration 2+): review findings from prior iteration (truncated per DL-SC-7)
6. **Constraints**:
   - Implement only the files assigned to this task
   - Make the associated tests pass
   - Follow project coding conventions
   - Run sanity checks (lint, type check) before completing
7. **Output format**: structured JSON matching `CodeAgentOutput` shape

### Review Agent Prompt (template structure)

The review prompt must include:
1. **Role**: You are a code reviewer assessing code quality
2. **Git diff**: the diff of changed files (not full file contents)
3. **Spec context**: the spec item being implemented
4. **Test results**: pass/fail summary from the test suite
5. **Output format**: list of findings with file, line, severity, category, description, suggestedFix

### Security Review Agent Prompt (template structure)

Same structure as the review prompt, but:
1. **Role**: You are a security reviewer assessing OWASP top 10 compliance
2. Focus areas: injection risks, auth issues, data exposure, input validation

### Merge Agent Prompt (template structure)

The merge prompt must include:
1. **Role**: You are a review merger consolidating findings from two reviewers
2. **Code review output**: full output from the code reviewer
3. **Security review output**: full output from the security reviewer
4. **Instructions**: deduplicate by file + line + category, categorize as critical/important/suggestion
5. **Output format**: consolidated `MergedReview` structure

## Business Logic

### Task Scheduling

Build batches using topological sort on the dependency graph:
1. Find all tasks with no unresolved dependencies → batch 0
2. Mark batch 0 tasks as resolved
3. Find all tasks whose dependencies are all resolved → batch 1
4. Repeat until all tasks are scheduled
5. If tasks remain with unresolved dependencies, there's a cycle (should have been caught by the planification phase — defensive check only, throw on detection)

### Parallel Code Agent Execution

- Spawn one agent per task in the batch using `Promise.allSettled` (bounded by `maxParallelAgents`, default 5, DL-SC-8)
- Each agent runs in the same project directory (safe because the planner guarantees non-overlapping files)
- If one agent fails, the others continue — collect all results before deciding next steps
- If an agent fails (driver error, timeout), mark the task as failed and include it in the next iteration's feedback
- After each agent completes, verify file containment (FR-17, DL-SC-2)

### Tag-Based Model Routing

The config supports per-tag overrides via `getModelAssignment(config, 'code', tag)`:

```toml
[models]
code = { backend = "opencode", model = "codex" }        # default for code agents

[models.code-frontend]                                    # override for frontend-tagged tasks
backend = "opencode"
model = "gemini"

[models.code-backend]                                     # override for backend-tagged tasks
backend = "opencode"
model = "codex"
```

Resolution: `config.models.tagged["code-<tag>"]` → `config.models.agents.code` (default). If `code-frontend` exists in config, frontend tasks use it. Otherwise, they use the generic `code` role.

### Review Strategy

- Code reviewer and security reviewer run in parallel (`Promise.all`)
- Each receives: the git diff of changed files (not full files — per DL-SC-5), the spec item context, the test results
- The merge agent receives both outputs and produces a unified finding list
- After merge, programmatic integrity check: verify all `critical` findings from both inputs survive (DL-SC-9)
- Findings with `critical` severity block the loop (must fix before committing)
- Findings with `important` severity trigger another iteration (should fix)
- `suggestion` findings are logged but don't block
- Loop control is computed by the controller: `criticalCount > 0 || importantCount > 0`

### Iteration Loop

The development loop runs as follows for each spec item:

```
for iteration = 1 to MAX_ITERATIONS (5):
  emit iteration:start
  for each batch in batches:
    spawn code agents (bounded by maxParallelAgents)
    verify file containment after each agent
  run test suite via runTestSuite()
  run review phase (code review + security review → merge)
  evaluate outcome:
    if failingTests === 0 AND criticalCount === 0 AND importantCount === 0:
      → exit loop with success
    else:
      → prepare feedback for next iteration
  emit iteration:end
```

### Commit Strategy

- One commit per spec item, not per iteration
- Commit message format: `feat(<scope>): <spec item title>` — sanitized per DL-SC-4
- Only commit when tests pass AND no critical/important review findings
- Stage only files from the verified `changedFiles` list — never `git add .` or `git add -A`
- Check staging blocklist before `git add` (DL-SC-3)

### PR Lifecycle

- Branch created at session start: `feat/<sessionId>` (FR-11, session-level)
- Draft PR opened immediately after first branch push (FR-11, session-level)
- PR body starts with "Work in progress — swarm session `<sessionId>`"
- Commits added per spec item (FR-12, spec-item-level)
- After all spec items complete: update PR body with delivery report, mark as ready for review (FR-12, session-level)

### Event Emission Table

| Scenario | Events emitted |
|---|---|
| Code agents succeed, tests GREEN, review clean | `iteration:start`, N × `agent:invoke` + `agent:result`, `test:green`, `agent:invoke`(review) + `agent:result`, `agent:invoke`(security) + `agent:result`, `agent:invoke`(merge) + `agent:result`, `review:findings(0,0,S)`, `iteration:end(success)`, `commit` |
| Code agents succeed, tests fail, review has findings | `iteration:start`, N × `agent:invoke` + `agent:result`, `test:fail`, review events, `review:findings(C,I,S)`, `iteration:end(false)` → next iteration |
| Code agent fails (timeout), retry exhausted | `agent:invoke`, `agent:error`, `agent:invoke` (retry), `agent:error` — task marked failed for next iteration |
| Max iterations reached | Last `iteration:end(false)` emitted. No `commit` event. |
| Code agent modifies file outside project | N × `agent:invoke` + `agent:result`, `file:changed`(violation), `phase:error` with `{ phase: 'code' }` |
| All code agents in batch fail, batch retry fails | `iteration:start`, N × `agent:error`, batch retry, N × `agent:error` → `phase:error` with `{ phase: 'code' }` |

## Edge Cases

- Code agent modifies a file not in its assigned file list: detected via `git diff --name-only HEAD`, logged as warning. CI-sensitive files (`.github/`, `Dockerfile`) are a hard error (DL-SC-2).
- All code agents in a batch fail: retry the batch once from scratch (fresh retry counts per FR-15 — the batch-level retry is a separate concern from per-agent retries within a single batch execution), then emit `phase:error` and abort.
- Test runner can't execute (missing deps, config error): hard error, swarm cannot continue. Emit `phase:error`.
- Review agents produce no findings: this is valid (clean code), proceed to commit if tests pass.
- Merge agent receives identical findings from both reviewers: deduplicate by file + line + category.
- Merge agent drops a critical finding: automatically restored by programmatic integrity check (DL-SC-9), warning emitted.
- Git conflicts during commit (shouldn't happen in a worktree): hard error, emit `phase:error`, log the conflict details.
- Batch has more tasks than `maxParallelAgents`: use a concurrency-limited `Promise` pool pattern (e.g., `p-limit` or manual semaphore). Within a single batch all tasks have their dependencies satisfied, so no ordering constraint exists — the concurrency limit is purely a resource cap.
- Code agent creates a file matching the staging blocklist (`.env`, `*.pem`, `*.key`): excluded from staging, warning emitted (DL-SC-3).
- Driver returns `AgentResult.success === false`: handled per FR-15 (retry for timeout/crash/empty/invalid, abort for spawn_error/aborted).
- AbortSignal fires during parallel code agent execution: all running agents are cancelled, remaining agents are not started, `phase:error` emitted.
- `git diff --name-only HEAD` fails (corrupted git state, detached HEAD): treated as a hard error for the current batch/iteration, emit `phase:error`, iteration cannot proceed.
- Phase-level timeout (default: 60 minutes) fires: all running operations aborted via AbortSignal, `CodePhaseResult.codePhaseTimeoutMs` set, `phase:error` emitted. The last iteration gets `IterationOutcome.status: 'timeout'` with partial results (testResult/review may be undefined if timeout fired before those phases completed).

## Security Constraints

- **DL-SC-1 — Safe command construction**: All shell commands (`git`, `gh`, test runner) MUST be invoked via `child_process.spawn()` with argument arrays — never `child_process.exec()` with string interpolation. Commit messages, branch names, and any string derived from LLM output must be passed as array arguments, not interpolated into shell strings.
- **DL-SC-2 — Post-agent file containment**: After each code agent completes, verify all modified/created files via `git diff --name-only HEAD` (authoritative source, not the agent's self-reported list). Every file must reside under `projectDir`. Modifications to CI-sensitive paths (`.github/`, `.gitlab-ci.yml`, `.env*`, `Dockerfile`, `docker-compose*`) not present in the agent's assigned file list are a hard error.
- **DL-SC-3 — Staging blocklist**: Before `git add`, scan the file list against a blocklist of sensitive patterns: `.env*`, `*.pem`, `*.key`, `*credential*`, `*.secret`, `id_rsa*`, `.npmrc`, `.netrc`, `*.p12`, `*.pfx`, `*.jks`. This is a minimum set — implementations should include a comprehensive list. Files matching these patterns must be excluded from staging and reported as warnings. Never use `git add -A` or `git add .` — always stage specific files from the verified `changedFiles` list.
- **DL-SC-4 — Commit message sanitization**: Commit messages derived from spec item titles must be sanitized: strip control characters (ASCII 0-31 except newline, ASCII 127 DEL, and Unicode control/formatting characters U+0080-U+009F, U+200B-U+200F, U+2028-U+2029), limit total message length to 500 characters. Messages are passed to `spawn('git', ['commit', '-m', message])` as a single array element — never shell-interpolated.
- **DL-SC-5 — Review payload safety**: Review diffs sent to external backends should not contain full file contents — only git diffs. Files matching sensitive patterns (`.env*`, `*.pem`, `*.key`) should be excluded from review payloads.
- **DL-SC-6 — Test execution safety**: Test suite execution MUST use `runTestSuite()` from Spec 3, which enforces `child_process.spawn()` with argument arrays (PT-SC-2), configurable timeout with process group kill, and output truncation to 64KB (PT-SC-4).
- **DL-SC-7 — Feedback sanitization**: Review findings fed back to code agents as iteration feedback must be truncated to 2KB per finding and 32KB total per iteration. Content must be wrapped in a clearly delimited block labeled as external review output.
- **DL-SC-8 — Parallel agent resource cap**: Maximum concurrent code agents per batch is configurable (default: 5, min: 1, max: 20). Batches with more tasks than the cap are sub-batched internally.
- **DL-SC-9 — Merge integrity verification**: After the merge agent consolidates review findings, programmatically verify that every `critical`-severity finding from both input reviews is present in the merged output (match by file + line + category). If any critical finding was dropped, restore it and emit a warning.
- **DL-SC-10 — Branch name validation**: Before creating `feat/<sessionId>`, assert that `sessionId` matches `/^[a-zA-Z0-9_-]{1,64}$/` (defense-in-depth, consistent with SC-1 from foundation spec).
- **DL-SC-11 — AbortSignal propagation**: The development loop must accept an `AbortSignal` and propagate it to all `driver.invoke()` calls, `runTestSuite()` calls, and git operations. When aborted, all child processes must be killed via process group (per DS-7 from driver spec).
- **DL-SC-12 — Event payload safety**: All events emitted during this phase must comply with SC-5 from the foundation spec (64KB max, no raw file contents, no full prompts, no stack traces). `rawOutput` from agent results must never appear in NDJSON events (per DS-6 from driver spec).

## Dependencies

### Internal (other specs in this project)
- `swarm-cli-config-events.spec.md`: `SwarmEventEmitter`, `SwarmStateManager`, `SwarmConfig`, `ResolvedConfig`, `AgentRole`, `SessionContext`, `PhaseError`, `SwarmState`, event types (`IterationStartEvent`, `IterationEndEvent`, `TestGreenEvent`, `TestFailEvent`, `ReviewFindingsEvent`, `CommitEvent`, `FileChangedEvent`, `PhaseErrorEvent`)
- `swarm-driver-system.spec.md`: `DriverRegistry`, `Driver`, `AgentRequest`, `AgentResult`, `DriverResolution`, `ModelId`, `BackendName`
- `swarm-planification-tdd.spec.md`: `PlannerTask`, `TestResult`, `TaskTag`, `TechStack`, `PlanPhaseResult`, `TddPhaseResult`, `runTestSuite()`

NOTE: `CodeAgentOutput`, `ReviewFinding`, `ReviewCategory`, `MergedReview`, `IterationState`, `IterationOutcome`, `CommitRecord`, `GitState`, and `CodePhaseResult` are defined in this spec and may be consumed by Spec 5 (`swarm-documentation-reporting.spec.md`).

### External (libraries, services)
- Node.js `child_process` (built-in) for running git commands
- `gh` CLI for PR creation and management
- `git` CLI for branch/commit operations
- `zod` or `valibot` — runtime validation for phase result schemas

## Out of Scope

- Planification and test writing (see `swarm-planification-tdd.spec.md`)
- Documentation generation (see `swarm-documentation-reporting.spec.md`)
- WebSocket streaming (future — events are streamed via NDJSON for now)
- Worktree creation (handled by the orchestration engine before entering this phase)

## Acceptance Criteria

- [ ] Task scheduler correctly groups tasks into parallel batches respecting dependencies (FR-1)
- [ ] Code agents run in parallel within a batch, bounded by `maxParallelAgents` (FR-2, DL-SC-8)
- [ ] Tag-based routing dispatches backend/frontend tasks to different models via `getModelAssignment()` (FR-3)
- [ ] Per-tag model overrides in config work (`code-frontend`, `code-backend`) (FR-3)
- [ ] Code agent prompt includes task details, test files, tech stack, and iteration feedback (FR-4)
- [ ] Test suite runs after each batch using `runTestSuite()` from Spec 3 (FR-5, DL-SC-6)
- [ ] Test execution uses `spawn()` not `exec()`, with timeout and output truncation (DL-SC-6)
- [ ] Code review and security review run in parallel (FR-6)
- [ ] Merge agent deduplicates and categorizes findings from both reviewers (FR-7)
- [ ] Merge integrity check ensures no critical findings are silently dropped (FR-7, DL-SC-9)
- [ ] Loop evaluates outcome: GREEN + clean review → commit, otherwise → loop (FR-8)
- [ ] Loop exits after 5 iterations with failure report if not GREEN (FR-10)
- [ ] Staging uses only verified `changedFiles` — never `git add -A` or `git add .` (FR-9, DL-SC-3)
- [ ] Staging blocklist prevents committing `.env*`, `*.pem`, `*.key` and other sensitive patterns (DL-SC-3)
- [ ] Commit messages are sanitized (no control chars, length-capped, not shell-interpolated) (DL-SC-4)
- [ ] Git branch created at session start with validated sessionId (FR-11, DL-SC-10)
- [ ] Draft PR opened after first push (FR-11)
- [ ] Commits made per spec item with descriptive messages (FR-12)
- [ ] PR marked ready after all spec items complete (FR-12)
- [ ] All events emitted correctly per the event emission table (FR-13, DL-SC-12)
- [ ] Changed files verified via `git diff --name-only HEAD`, not just self-reported (FR-14, DL-SC-2)
- [ ] Post-agent file containment catches CI-sensitive modifications (FR-17, DL-SC-2)
- [ ] `AgentResult.success === false` handled per FR-15 (retry/abort based on errorCode)
- [ ] `AbortSignal` propagated to all child operations (FR-16, DL-SC-11)
- [ ] Review diffs exclude sensitive file patterns (DL-SC-5)
- [ ] Feedback to code agents truncated per DL-SC-7
- [ ] `CodePhaseResult` persisted in session state with Zod/Valibot schema
- [ ] `readCodePhaseResult()` typed accessor validates on read
- [ ] `PlannerTask`, `TestResult`, `TaskTag` imported from Spec 3 — NOT re-declared
- [ ] Phase-level timeout (default: 60 minutes) aborts the entire dev loop (FR-18)
- [ ] `git rev-parse HEAD` used to extract commit hash (not parsed from `git commit` stdout)
- [ ] `gh auth status` verified before PR creation
- [ ] `git diff --name-only HEAD` failures treated as hard errors
- [ ] Batch-level retry has fresh per-agent retry counts (FR-15 retries are per batch execution)
- [ ] All tests pass with `pnpm test`
