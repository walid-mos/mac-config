# Execution Truthfulness - Spec

## Overview

Make swarm report the truth about execution. The current runtime can mark the code phase as successful even when tasks never converged, and it can mark every task as green even when some tasks are still blocked or looping.

## Context

The audit identified three core truthfulness bugs:

1. `runCodePhase()` hard-codes `success = true`.
2. `executeDag()` writes every `taskCompletion` with status `green`.
3. The main loop has no explicit convergence cap even though the result model already defines `max-iterations` and `timeout`.

This spec is the foundation for every later fix. Reports, status commands, observability, and optimization work all depend on correct task and session outcomes.

## Quick Resolution Summary

Add explicit execution limits, compute real terminal outcomes from task state, and persist truthful phase success. Future agents should treat this spec as the semantic source of truth for the swarm runtime.

## Functional Requirements

- **FR-1**: Replace the hard-coded `success = true` in the code phase with a computed boolean derived from final task outcomes and unresolved blocking findings.
- **FR-2**: Replace the hard-coded final task status assignment with truthful terminal statuses per task: `green`, `failed`, `max-iterations`, or `timeout`.
- **FR-3**: Introduce explicit convergence limits for DAG execution, including a maximum attempt count per task and a total execution timeout budget for the code phase.
- **FR-4**: When a task reaches its attempt cap, swarm must stop retrying it and record a terminal `max-iterations` outcome.
- **FR-5**: When the code phase exceeds its configured time budget, swarm must stop the execution loop and record a terminal `timeout` outcome for unfinished tasks.
- **FR-6**: `iteration:end`, `taskCompletions`, `CodePhaseResult`, and persisted state must all reflect the same final terminal outcome model.
- **FR-7**: All docs/reporting/state consumers must stop inferring success from the presence of iterations alone and instead consume the new truthful terminal outcomes.

## Data Model

```ts
type TaskTerminalStatus = 'green' | 'failed' | 'max-iterations' | 'timeout'

interface ExecutionLimits {
  maxAttemptsPerTask: number
  codePhaseTimeoutMs: number
}

interface TaskCompletionRecord {
  taskId: string
  title: string
  status: TaskTerminalStatus
  attempts: number
  commitHash?: string
  terminalReason?: string
}
```

## Implementation Tasks

- [ ] Add explicit execution limits to runtime configuration or code-phase defaults.
- [ ] Refactor `src/phases/code/dag-executor.ts` to track terminal state transitions instead of relying on implicit loop exit.
- [ ] Replace the final forced-green task completion block with status derived from each node's final state.
- [ ] Compute `CodePhaseResult.success` from actual task terminal states in `src/phases/code/code-phase.ts`.
- [ ] Record terminal reasons for `max-iterations`, `timeout`, and failed convergence.
- [ ] Update `src/phases/phase-results.ts` types and schemas to reflect the truthful model end to end.
- [ ] Update docs/report/state readers that currently assume success on completion.
- [ ] Add or update tests for green, non-converged, timed-out, and capped-attempt scenarios.

## File Targets

- `src/phases/code/dag-executor.ts`
- `src/phases/code/code-phase.ts`
- `src/phases/phase-results.ts`
- `src/core/types.ts`
- `tests/phases/code/dag-executor.test.ts`
- `tests/phases/code/code-phase.test.ts`
- `tests/phases/phase-results.test.ts`

## Edge Cases

- Some tasks may already be green when another task times out; preserve green tasks and mark only unfinished tasks as timed out.
- A task with no attributable findings but no commit must not be marked green unless the implementation actually converged.
- Timeout handling must honor `AbortSignal` semantics and not double-report aborted work as timeout.

## Dependencies

### Internal

- `src/phases/code/dag-executor.ts`
- `src/phases/code/code-phase.ts`
- `src/phases/phase-results.ts`
- `src/core/types.ts`

### External

- None

## Out of Scope

- Incremental review scope reduction
- Session CLI commands
- Event correlation redesign
- Module extraction/refactoring beyond what is required to implement truthful behavior

## Acceptance Criteria

- [ ] `CodePhaseResult.success` is computed from real terminal outcomes.
- [ ] `taskCompletions` preserve the actual final state for every task.
- [ ] The DAG loop has a bounded attempt cap and a bounded time budget.
- [ ] Non-converging tasks terminate as `max-iterations` or `timeout` instead of looping forever.
- [ ] Persisted state and typed results use the same terminal outcome vocabulary.
- [ ] `pnpm test` passes.
- [ ] `pnpm typecheck` passes.

## Future Agent Summary

- Fix semantics first, not structure.
- Keep this spec behavior-focused; do not bundle performance refactors here.
- Treat this spec as the authoritative contract for all later status, event, and report work.
