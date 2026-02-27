# Swarm Planification & TDD — Spec

## Overview

First phase of the swarm orchestration loop. The planner agent decomposes a spec item into tagged tasks with non-overlapping file assignments, then the test agent writes failing tests (TDD RED phase). This module produces the work plan and test suite that the development loop (separate spec) consumes.

## Context

When swarm processes a spec, it iterates over spec items. For each item, this module runs two sequential agents:

1. **Planner agent** (Claude): reads the spec item and project context, outputs a structured task decomposition with tags (backend/frontend/fullstack) and file assignments
2. **Test agent** (strong model, e.g., GPT-5.3): reads the planner's output and writes test files that define the expected behavior. These tests MUST fail (RED) — they validate behavior that doesn't exist yet.

The planner's output is structured markdown following a rigid template. It is parsed into typed `PlannerTask[]` for validation (DAG check, file overlap check), then the raw markdown is injected as prompt context into downstream agents. The test agent writes actual test files to disk.

This spec depends on:
- `swarm-cli-config-events.spec.md` for events, state, and `SessionContext`
- `swarm-driver-system.spec.md` for invoking agents via `DriverRegistry`

## Functional Requirements

- **FR-1**: Implement a planification phase that:
  - Reads the current spec item content
  - Detects the project's tech stack (package.json, framework configs, file extensions, test runner, package manager)
  - Builds a prompt for the planner agent with: spec item content, tech stack, project structure, relevant existing code samples
  - Invokes the planner agent via the driver system with the `plan` role
  - Parses the structured markdown output into `PlannerTask[]` via `parseTaskDecomposition()`
  - Validates the task graph: DAG structure (no cycles) and non-overlapping file assignments for parallel tasks
- **FR-2**: The planner agent prompt template must instruct the agent to produce a task list where each task includes:
  - A unique identifier (e.g., `TASK-1`, `TASK-2`)
  - A title and description
  - A tag: `backend`, `frontend`, or `fullstack`
  - A list of files to create or modify (project-relative paths only — no absolute paths)
  - Dependencies on other tasks (by ID)
  - Test hints: what behavior should be tested for this task
- **FR-3**: The planner must ensure **non-overlapping file assignments** across tasks that have no dependency relationship. If two tasks can run in parallel (no dependency between them), they must not share any file paths. Tasks with dependencies (sequential) may share files. This constraint is validated at runtime after parsing the planner output (see Plan Validation).
- **FR-4**: Implement a TDD phase that:
  - Reads the planner's task decomposition output
  - Validates all file paths in the planner output are under `projectDir` (PT-SC-3)
  - Builds a prompt for the test agent with: planner output, tech stack, existing test patterns, testing conventions
  - Invokes the test agent via the driver system with the `test` role
  - The test agent writes test files to disk (file system access scoped to `projectDir` via worktree isolation)
  - After the agent completes, verifies all created/modified files are under `projectDir` (PT-SC-1)
- **FR-5**: The test agent prompt template must instruct the agent to:
  - Write test files using the project's test runner (prefer Vitest, fall back to detected runner)
  - Write tests that define the expected behavior from the planner's task descriptions
  - Ensure tests are syntactically valid and can be executed by the runner
  - Tests MUST fail when run (RED) — they test behavior that doesn't exist yet
  - Follow the project's testing conventions (file location, naming, import patterns)
- **FR-6**: After the test agent completes, run the test suite and verify the RED state:
  - Verify all test file paths from the agent's output are under `projectDir` (PT-SC-1). Delete and report any files outside the boundary.
  - Execute the project's test command using `child_process.spawn()` with argument arrays — never shell-interpolated `exec()` (PT-SC-2). Use the resolved `testCommand` from `TechStack`.
  - Enforce a configurable timeout on test execution (default: 120 seconds). If the test runner exceeds the timeout, kill the process group (SIGTERM, 5s drain, SIGKILL — same pattern as driver spec), treat the result as a load error.
  - Capture and truncate test output to 64KB (PT-SC-4)
  - Parse the test output to count passing/failing tests
  - Verify that newly created tests FAIL (at least one assertion failure in the total suite, no syntax errors across all new test files)
  - If new tests PASS (meaning the behavior already exists), emit a `test:green` event and skip those tests from the development loop
  - If tests have syntax errors or can't be loaded by the runner, sanitize the error output (PT-SC-4) and retry the test agent (up to 2 retries) with the sanitized error as context
- **FR-7**: Emit the following events during this phase:
  - `phase:start` with `{ phase: "plan" }`
  - `agent:invoke` / `agent:result` (or `agent:error`) for the planner agent
  - `phase:end` with `{ phase: "plan", durationMs, taskCount: N }`
  - `phase:start` with `{ phase: "tdd" }`
  - `agent:invoke` / `agent:result` (or `agent:error`) for the test agent
  - `test:red` with `{ totalTests, passingTests, failingTests }` — numeric summary only, matching `TestRedEvent` in the foundation spec
  - `phase:end` with `{ phase: "tdd", durationMs }`

  NOTE: The `test:red` event carries only the numeric summary to match `TestRedEvent` in the foundation spec. The full `RedVerification` (including `syntaxErrors` and `testFiles`) is stored exclusively in `TddPhaseResult` via `state.phaseResults.tdd`. Do not widen event payloads — event types are a cross-cutting contract.
- **FR-8**: Persist the full `PlanPhaseResult` and `TddPhaseResult` in the session state via `phaseResults.plan` and `phaseResults.tdd` so the development loop can access them. Both types must have corresponding Zod/Valibot schemas for serialization/deserialization validation, consistent with the foundation spec's `phaseResults` extension point. `TddPhaseResult` is always persisted regardless of RED/GREEN outcome — the orchestration engine reads `redVerification.isRed` to decide whether to enter the development loop.
- **FR-9**: Detect the project's tech stack automatically by scanning:
  - `package.json` (dependencies, devDependencies, scripts — extract only these fields, not the entire file; reject files over 1MB per PT-SC-5)
  - Framework config files (`astro.config.*`, `next.config.*`, `vite.config.*`, `tsconfig.json`, `tailwind.config.*`) — reject files over 1MB per PT-SC-5
  - File extensions in `src/` to identify languages
  - Test runner from config or devDependencies (`vitest`, `jest`, `playwright`)
  - Package manager from lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`)
  - Always resolve a `testCommand` string (e.g., `pnpm test`) even when no test runner is detected
- **FR-10**: After receiving the planner output, validate the task dependency graph:
  - Parse task IDs and their declared dependencies via `parseTaskDecomposition()`
  - Perform topological sort (Kahn's algorithm) to detect cycles. If a cycle is detected, emit `phase:error` with `{ phase: "plan", reason: "Circular dependency: TASK-X -> TASK-Y -> ... -> TASK-X" }` and abort without retry — cycles are a planner logic error that retry will not fix.
  - Validate the non-overlapping file constraint: for every pair of tasks that can run in parallel (no direct or transitive dependency), verify their file lists are disjoint. If overlap is detected, automatically add a dependency edge to serialize the conflicting tasks and emit a warning to stderr.
- **FR-11**: After every driver invocation (planner or test agent), inspect `AgentResult.success`:
  - If `success === true`, proceed with `result.output`.
  - If `success === false`, behavior depends on `errorCode`:
    - `timeout`, `crash`: retry up to 2 times. Emit `agent:error` before each retry.
    - `aborted`: propagate cancellation immediately. Emit `phase:error` and return.
    - `spawn_error`: emit `phase:error` and abort (environment is broken).
    - `empty_output`, `invalid_json`: retry up to 2 times with the error details appended to the prompt.
  - If all retries are exhausted, emit `phase:error` and abort the phase.

## Data Model

```typescript
// Task tag — exhaustive over planner-valid values (FR-2)
type TaskTag = 'backend' | 'frontend' | 'fullstack'

// Parsed planner task (owned by this spec, consumed by Spec 4)
interface PlannerTask {
  id: `TASK-${number}`   // "TASK-1", "TASK-2" — validated by parser, unique within the plan
  title: string
  description: string
  tag: TaskTag
  files: string[]        // Project-relative paths (no absolute paths — validated under projectDir)
  dependencies: `TASK-${number}`[] // Task IDs — must form a DAG
  testHints: string[]
}

// Tech stack detection
interface TechStack {
  languages: string[]
  frameworks: string[]
  testRunner: 'vitest' | 'jest' | 'playwright' | null
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  buildTool: 'vite' | 'webpack' | 'turbopack' | null
  configFiles: string[]        // Project-relative paths to detected config files
  testCommand: string          // Always resolved: e.g., "pnpm test", "vitest run" (never empty)
}

// Shared test execution result (owned by this spec, consumed by Spec 4)
interface TestResult {
  totalTests: number
  passingTests: number
  failingTests: number
  durationMs: number
}

// RED verification result
interface RedVerification extends TestResult {
  syntaxErrors: string[]        // Runner error messages for unparseable test files (truncated per PT-SC-4)
  testFiles: string[]           // Project-relative paths to test files created by the agent (validated under projectDir)
  isRed: boolean                // true if failingTests > 0 AND syntaxErrors.length === 0
}

// Phase results stored in SwarmState.phaseResults (validated via Zod/Valibot on read)
// Never read phaseResults.plan or phaseResults.tdd via direct cast.
// Use the typed accessors (readPlanPhaseResult, readTddPhaseResult) which validate via Zod/Valibot.

interface PlanPhaseResult {
  plannerOutput: string                   // Raw planner markdown (max 256KB — truncated if larger)
  tasks: PlannerTask[]                    // Parsed and validated task decomposition
  techStack: TechStack                    // Detected tech stack (passed to Spec 4 code agents)
  taskCount: number
  tags: Partial<Record<TaskTag, number>>  // e.g., { backend: 3, frontend: 2 }. Values are always >= 1 (key present only if at least one task uses the tag).
}

interface TddPhaseResult {
  testFiles: string[]           // Project-relative paths
  redVerification: RedVerification
}
```

### Error Types

This module does not define new error classes. Phase-level failures are propagated as `PhaseError` entries (defined in `swarm-cli-config-events.spec.md`) written to `SwarmState.errors`. Unrecoverable failures (planner output unparseable after retry, test syntax errors after 2 retries) emit `phase:error` and return — the orchestration engine records them as `PhaseError` entries.

## Source File Structure

```
src/
  phases/
    plan-phase.ts         # runPlanPhase() — orchestrates planner invocation and validation
    tdd-phase.ts          # runTddPhase() — orchestrates test agent invocation and RED verification
  tech-stack.ts           # detectTechStack() — project scanning, TechStack type and schema
  task-parser.ts          # parseTaskDecomposition() — parses planner markdown into PlannerTask[], validates DAG and file overlap
  test-runner.ts          # runTestSuite() — shared test execution logic (used by RED verification here and test checks in Spec 4)
  red-verification.ts     # verifyRed() — runs test suite, parses output, classifies RED/GREEN/error
  prompts/
    planner-prompt.ts     # buildPlannerPrompt() — assembles planner agent prompt
    test-prompt.ts        # buildTestPrompt() — assembles test agent prompt
  phase-results.ts        # readPlanPhaseResult(), readTddPhaseResult() — typed accessors with Zod/Valibot validation
```

No `index.ts` — no barrel exports. Consumers import directly: `import { runPlanPhase } from './phases/plan-phase.ts'`.

Test files follow the `*.test.ts` convention co-located with source or in a `tests/` directory, using Vitest.

## API Contract

```typescript
// Tech stack — src/tech-stack.ts
function detectTechStack(projectDir: string): Promise<TechStack>
// Scans package.json, config files, lock files, and src/ extensions.
// Always resolves testCommand (falls back to `<packageManager> test`).
// Rejects config files over 1MB (PT-SC-5).
// Pure project analysis — no side effects beyond file reads.

// Task parsing — src/task-parser.ts
interface ParseTaskResult {
  tasks: PlannerTask[]
  warnings: string[]     // Self-healing actions (e.g., "Added dependency TASK-2 → TASK-3 to resolve file overlap on src/foo.ts")
}

function parseTaskDecomposition(plannerOutput: string, projectDir: string): ParseTaskResult
// Parses the rigid markdown template into typed tasks.
// Validates:
//   - Each task has id (TASK-N format), title, tag, files, dependencies
//   - Tag is one of: backend, frontend, fullstack
//   - File paths are project-relative and do not contain traversal sequences (..)
//   - DAG structure (Kahn's topological sort — no cycles)
//   - Non-overlapping files for parallel tasks (no direct/transitive dependency)
// Throws on cycle detection or missing required fields.
// On file overlap: adds dependency edge to serialize, records in warnings[].

// Shared test runner — src/test-runner.ts
function runTestSuite(
  projectDir: string,
  techStack: TechStack,
  timeout?: number,         // Default: 120_000 (120 seconds)
  signal?: AbortSignal
): Promise<TestResult>
// Spawns the test command via child_process.spawn() (not exec) with { cwd: projectDir }.
// Enforces timeout with process group kill (SIGTERM → 5s → SIGKILL).
// Parses stdout/stderr for pass/fail counts.
// Shared between RED verification (this spec) and test checks (Spec 4).

// RED verification — src/red-verification.ts
function verifyRed(
  projectDir: string,
  techStack: TechStack,
  testFiles: string[],
  signal?: AbortSignal
): Promise<RedVerification>
// Calls runTestSuite(), then checks new test files for RED state.
// Classifies: syntax errors vs passing vs failing.

// Planification phase — src/phases/plan-phase.ts
function runPlanPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  specItemContent: string,
  signal?: AbortSignal
): Promise<PlanPhaseResult>
// Detects tech stack via detectTechStack(ctx.projectDir).
// Builds planner prompt, invokes planner agent via registry.getDriver('plan').
// Handles AgentResult.success === false per FR-11.
// Parses output into PlannerTask[] via parseTaskDecomposition().
// Retries planner once if output doesn't follow template.
// Emits: phase:start, agent:invoke, agent:result/agent:error, phase:end.
// Persists PlanPhaseResult to ctx.state phaseResults.plan.
// plannerOutput truncated to 256KB if larger (warning emitted to stderr).

// TDD phase — src/phases/tdd-phase.ts
function runTddPhase(
  ctx: SessionContext,
  registry: DriverRegistry,
  plan: PlanPhaseResult,
  signal?: AbortSignal
): Promise<TddPhaseResult>
// Builds test agent prompt from plan and tech stack.
// Invokes test agent via registry.getDriver('test').
// Handles AgentResult.success === false per FR-11.
// Verifies test file containment under projectDir (PT-SC-1).
// Runs RED verification via verifyRed().
// Retries test agent up to 2 times on syntax errors (sanitized error output per PT-SC-4).
// Emits: phase:start, agent:invoke, agent:result/agent:error, test:red/test:green, phase:end.
// Persists TddPhaseResult to ctx.state phaseResults.tdd.

// Phase result accessors — typed, validated reads from phaseResults
function readPlanPhaseResult(state: SwarmState): PlanPhaseResult | null
function readTddPhaseResult(state: SwarmState): TddPhaseResult | null
// Read state.phaseResults.plan / .tdd and validate via Zod/Valibot.
// Return null if absent. Throw validation error if present but structurally invalid.
// These are the ONLY way to read phase results — never cast directly.
```

## Prompt Templates

### Planner Agent Prompt (template structure)

The planner prompt must include these sections in order:
1. **Role**: You are a software architect decomposing a spec into implementable tasks
2. **Spec content**: The full spec item to implement
3. **Tech stack**: Detected tech stack details
4. **Project structure**: Relevant directory tree and existing file paths
5. **Constraints**:
   - Non-overlapping file assignments for parallel tasks
   - Each task must be tagged (backend/frontend/fullstack)
   - Dependencies must form a DAG (no cycles)
   - File paths must be project-relative (no absolute paths, no `..` traversal)
6. **Output format**: Rigid markdown template (see below)

```markdown
## Task Decomposition

### TASK-1: <title>
- **Tag**: backend | frontend | fullstack
- **Files**: <list of project-relative file paths to create or modify>
- **Dependencies**: none | TASK-X, TASK-Y
- **Description**: <what this task implements>
- **Test hints**: <what behavior to test>

### TASK-2: <title>
...
```

### Test Agent Prompt (template structure)

The test prompt must include:
1. **Role**: You are a TDD test engineer writing failing tests
2. **Task decomposition**: The planner's full output
3. **Tech stack**: Test runner, framework, language
4. **Testing conventions**: Existing test file patterns from the project
5. **Constraints**:
   - Tests MUST fail — they define behavior that doesn't exist yet
   - Tests must be syntactically valid and runnable
   - Use the project's test runner and conventions
   - One test file per task (or logical grouping)
   - All test files must be within the project directory
6. **Output**: Write test files directly to disk using the available file tools

## Business Logic

### Tech Stack Detection
- Scan `package.json` dependencies for known frameworks (react, next, astro, vue, express, fastify, etc.) — extract only `dependencies`, `devDependencies`, `scripts` fields, not the entire file
- Detect test runner: vitest.config.* → vitest, jest.config.* → jest, playwright.config.* → playwright
- Detect package manager: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock` → bun, `package-lock.json` → npm
- If no test runner detected, default to vitest and note it in the planner prompt
- Always resolve `testCommand`: if test runner is detected, use it directly (e.g., `vitest run`); otherwise fall back to `<packageManager> test` (reading the scripts.test field from package.json)

### Plan Validation

After receiving the planner's markdown output and parsing it into `PlannerTask[]`:

1. **Structural validation**: every task must have a non-empty `id` (matching `TASK-\d+`), `title`, `tag` (one of `backend`/`frontend`/`fullstack`), and `files` list. Missing fields fail parsing.

2. **File path validation**: all file paths must be project-relative and must not contain `..` traversal sequences. Absolute paths or paths with traversal are rejected (PT-SC-3).

3. **DAG validation** (cycle detection): run Kahn's algorithm (iterative topological sort). Maintain an in-degree count per task. Repeatedly remove tasks with in-degree 0 and decrement neighbors. If tasks remain after the loop completes, the remaining tasks form one or more cycles. Report the cycle-participating task IDs in the error. Cycle detection failure aborts the phase without retry.

4. **Non-overlapping file validation**: build the transitive closure of the dependency graph. For every pair of tasks (A, B) where neither depends (directly or transitively) on the other, verify their file sets are disjoint. If overlap is detected, automatically add a dependency edge to serialize the conflicting tasks and emit a warning to stderr. This self-healing behavior avoids a full retry for a minor constraint violation.

Both DAG and file overlap validations run after planner output parsing and before entering the TDD phase.

### RED Verification
- Run tests via `runTestSuite()` with the configured timeout (default: 120 seconds)
- Parse stdout/stderr for pass/fail counts (vitest and jest both report these)
- A valid RED state means: at least one test fails in the total suite AND no syntax errors across all new test files (`isRed = failingTests > 0 && syntaxErrors.length === 0`)
- If a test passes, it means the behavior already exists — emit `test:green` event with details, exclude from development loop
- If tests can't load (import errors, syntax errors): sanitize error output (truncate to 4KB, strip absolute paths outside projectDir), retry test agent up to 2 times with the sanitized error as context

### Planner Retry
- Detect template violations via structural validation in `parseTaskDecomposition()`: missing `### TASK-\d+` headers, absent `- **Tag**:` / `- **Files**:` / `- **Dependencies**:` sections
- If the planner output fails structural validation, retry once with the validation errors included in the retry prompt
- If retry also fails, emit `phase:error` and abort

### Event Emission Table

| Scenario | Events emitted |
|---|---|
| Planner succeeds | `phase:start(plan)`, `agent:invoke`, `agent:result`, `phase:end(plan, taskCount)` |
| Planner fails after retry | `phase:start(plan)`, `agent:invoke`, `agent:error`, `agent:invoke` (retry), `agent:error`, `phase:error(plan, reason)` |
| Test agent succeeds, RED verified | `phase:start(tdd)`, `agent:invoke`, `agent:result`, `test:red(...)`, `phase:end(tdd)` |
| Test agent syntax errors, retries exhausted | `phase:start(tdd)`, `agent:invoke`, `agent:result`, [syntax detected], `agent:invoke` (retry), `agent:result`, [syntax again], `phase:error(tdd, reason)` |
| All tests pass (behavior exists) | `phase:start(tdd)`, `agent:invoke`, `agent:result`, `test:green(...)`, `phase:end(tdd)` |

## Edge Cases

- Spec item is trivially simple (one file, one function): planner produces a single task. This is valid.
- Project has no existing tests: test agent creates the test infrastructure (config file, first test file) as part of its work.
- Project uses a test runner swarm doesn't recognize: fall back to running the test command from `package.json` scripts (e.g., `pnpm test`).
- Planner produces tasks with circular dependencies: detect cycles via topological sort, emit `phase:error`, abort without retry.
- All tests pass immediately (behavior already exists): emit `test:green`, skip development loop for this spec item, move to next.
- Planner output exceeds 256KB: truncate `plannerOutput` in `PlanPhaseResult` to 256KB, emit warning to stderr. Full output available in the NDJSON event stream via `agent:result`.
- Test suite hangs (infinite loop, unclosed server): killed after timeout (default 120s) via process group kill, treated as a load error, triggers retry.
- Test agent writes files outside `projectDir`: files are deleted, `phase:error` emitted, treated as critical error.
- Driver returns `AgentResult.success === false`: handled per FR-11 (retry for timeout/crash/empty/invalid, abort for spawnerror/aborted).

## Security Constraints

- **PT-SC-1 — Test file containment**: After the test agent completes, every file path in the agent's output MUST be canonicalized via `fs.realpathSync()` and verified to reside under `projectDir`. Files written outside `projectDir` must be deleted immediately and reported as a critical error. This check MUST run before RED verification (FR-6). File discovery: use `git diff --name-only HEAD` combined with `git ls-files --others --exclude-standard` in the worktree as the authoritative list of changed/new files (more robust than relying solely on the agent's self-reported file list).
- **PT-SC-2 — Safe test execution**: Test commands MUST be executed via `child_process.spawn()` with an argument array — never `child_process.exec()` with shell interpolation. When using the project's test script, invoke via the detected package manager (e.g., `spawn('pnpm', ['test'])`) to avoid shell metacharacter injection.
- **PT-SC-3 — Planner output file path validation**: File paths in planner task definitions must be project-relative. Reject file paths containing traversal sequences (`..`) or absolute paths. Validate after parsing planner output and before entering the TDD phase.
- **PT-SC-4 — Test output sanitization**: Test runner stdout/stderr captured during RED verification must be truncated to 64KB. Error messages fed to retry prompts must be further sanitized: truncate to 4KB, strip absolute paths outside `projectDir`, strip environment variable values and raw stack traces.
- **PT-SC-5 — Config file size limits**: When scanning project files for tech stack detection (FR-9), reject any single file larger than 1MB. Extract only the minimum required fields from structured files (e.g., `dependencies`, `devDependencies`, `scripts` from `package.json`).

## Dependencies

### Internal (other specs in this project)
- `swarm-cli-config-events.spec.md`: `SwarmEventEmitter`, `SwarmStateManager`, `SwarmConfig`, `SwarmState`, `SessionContext`, `PhaseError`, event types (`TestRedEvent`, `TestGreenEvent`, `PhaseStartEvent`, etc.)
- `swarm-driver-system.spec.md`: `DriverRegistry`, `Driver`, `AgentRequest`, `AgentResult`, `DriverResolution`

NOTE: `PlannerTask`, `TestResult`, and `TaskTag` are defined in this spec and must be imported by Spec 4 (`swarm-development-loop.spec.md`) — Spec 4 must NOT re-declare them.

### External (libraries, services)
- The project's test runner (detected, not a dependency of swarm itself)
- Node.js `child_process` (built-in) for running test commands
- `zod` or `valibot` — runtime validation for phase result schemas

## Out of Scope

- Code implementation (see `swarm-development-loop.spec.md`)
- Code review and security review
- Git operations (commits, branches)
- Documentation generation
- Spec-item parsing (how a spec file is decomposed into items — defined by the orchestration engine)

## Acceptance Criteria

- [ ] Tech stack detection correctly identifies language, framework, test runner, package manager from a project
- [ ] `TechStack` uses literal union types for `testRunner`, `packageManager`, `buildTool`
- [ ] `testCommand` is always resolved (never empty)
- [ ] Planner agent is invoked with the correct prompt template and tech stack context
- [ ] Planner output is parsed into `PlannerTask[]` via `parseTaskDecomposition()`
- [ ] `TaskTag` is a literal union type (`'backend' | 'frontend' | 'fullstack'`)
- [ ] Non-overlapping file constraint is enforced at runtime: parallel tasks never share files
- [ ] File overlap triggers automatic serialization (dependency edge added, warning emitted)
- [ ] Circular dependencies in the task graph are detected via topological sort and abort the phase
- [ ] Planner output that fails structural validation triggers retry (once) with error context
- [ ] Test agent writes syntactically valid test files to disk
- [ ] Test file paths are validated under `projectDir` after agent completes (PT-SC-1)
- [ ] RED verification runs the test suite and confirms new tests fail
- [ ] Test suite execution uses `spawn()` not `exec()` (PT-SC-2)
- [ ] Test suite execution has a configurable timeout (default: 120s)
- [ ] Syntax errors in tests trigger retry (up to 2 retries) with sanitized error output
- [ ] Tests that pass immediately are detected, emit `test:green`, and are excluded from the development loop
- [ ] `AgentResult.success === false` is handled per FR-11 (retry/abort based on errorCode)
- [ ] `test:red` event payload matches foundation spec's `TestRedEvent.data` (numeric summary only)
- [ ] All events (phase:start, agent:invoke, agent:error, test:red, phase:end, phase:error) are emitted correctly per the event emission table
- [ ] `PlanPhaseResult` and `TddPhaseResult` are persisted in session state with Zod/Valibot schemas
- [ ] `readPlanPhaseResult()` and `readTddPhaseResult()` typed accessors validate on read
- [ ] `plannerOutput` truncated to 256KB if larger
- [ ] Config file scanning rejects files over 1MB (PT-SC-5)
- [ ] All phase functions accept optional `AbortSignal` for cancellation
- [ ] All tests pass with `pnpm test`
