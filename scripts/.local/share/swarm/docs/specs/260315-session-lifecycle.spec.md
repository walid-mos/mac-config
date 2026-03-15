# Session Lifecycle - Spec

## Overview

Repair session correctness at the CLI and state boundary. Swarm currently has schema drift in persisted state, an inconsistent top-level phase model, and stubbed lifecycle commands for `resume`, `status`, and `config`.

## Context

The audit found that session behavior is split across `src/cli.ts`, runtime state, and phase code with mismatched ownership. `worktreePath` is saved but not validated, the CLI skips a top-level TDD phase even though the type model still exposes one, and key operator commands are not implemented.

## Quick Resolution Summary

Make the session model coherent, validate the full persisted state shape, define one authoritative phase sequence, and implement lifecycle commands that expose real runtime state.

## Functional Requirements

- **FR-1**: Add `worktreePath` and any other persisted runtime fields to the state validation schema so the saved state matches the runtime type.
- **FR-2**: Define one authoritative top-level phase model for swarm and remove the current ambiguity between top-level TDD and per-wave TDD.
- **FR-3**: Implement `swarm status` to load session state and print a truthful session snapshot, including current phase, iteration, task counts, and terminal outcomes.
- **FR-4**: Implement `swarm resume` to restore an interrupted session using persisted state instead of exiting with a stub message.
- **FR-5**: Implement `swarm config` to resolve and print the active configuration for a project directory.
- **FR-6**: Clarify CLI ownership of worktree, PR, push, cleanup, and phase result persistence so lifecycle behavior has one source of truth.

## Data Model

```ts
interface SwarmState {
  schemaVersion: 1
  sessionId: string
  specPath: string
  projectDir: string
  worktreePath?: string
  currentPhase: Phase
  currentIteration: number
  completedPhases: Phase[]
  phaseResults: Partial<Record<Phase, unknown>>
  errors: PhaseError[]
  startedAt: string
  updatedAt: string
}

interface SessionStatusSnapshot {
  sessionId: string
  currentPhase: string
  currentIteration: number
  completedPhases: string[]
  taskSummary?: {
    green: number
    failed: number
    maxIterations: number
    timeout: number
    pending: number
  }
}
```

## Implementation Tasks

- [ ] Update `src/core/validation.ts` so persisted state matches `src/core/types.ts`.
- [ ] Decide and codify the authoritative phase sequence for plan, TDD, code, and docs.
- [ ] Refactor `src/cli.ts` so lifecycle responsibilities are explicit and non-duplicated.
- [ ] Implement `resume` using persisted state, worktree path, and phase results.
- [ ] Implement `status` with a human-readable snapshot backed by real state.
- [ ] Implement `config` using the resolved config loader rather than a stub.
- [ ] Add tests covering resumed sessions, status output, config output, and state schema parity.

## File Targets

- `src/cli.ts`
- `src/core/types.ts`
- `src/core/validation.ts`
- `src/core/state-manager.ts`
- `src/config/config-resolver.ts`
- `tests/cli.test.ts`
- `tests/core/state-manager.test.ts`
- `tests/config/config-resolver.test.ts`

## Edge Cases

- Resume must handle missing worktree directories gracefully and surface a clear recovery path.
- Status must work for completed, active, failed, and partially-written sessions.
- Config output must not require a running session.

## Dependencies

### Internal

- `260315-execution-truthfulness.spec.md`

### External

- None

## Out of Scope

- Incremental review performance changes
- Event schema redesign beyond what status/resume need to read
- Final structural refactor of CLI modules

## Acceptance Criteria

- [ ] Persisted state schema includes all fields written by the runtime.
- [ ] The top-level phase model is documented and enforced consistently.
- [ ] `swarm resume`, `swarm status`, and `swarm config` are implemented and tested.
- [ ] CLI lifecycle ownership is clear enough that phase code is not duplicating state responsibilities unnecessarily.
- [ ] `pnpm test` passes.
- [ ] `pnpm typecheck` passes.

## Future Agent Summary

- Keep behavior aligned with the truthful execution model from the previous spec.
- Do not hide missing state behind fallbacks; surface explicit lifecycle errors.
- Treat the CLI as an application boundary, not as a place to re-implement phase logic.
