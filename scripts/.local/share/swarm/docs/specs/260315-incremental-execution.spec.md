# Incremental Execution - Spec

## Overview

Reduce token burn and runtime cost by making swarm operate on deltas instead of repeatedly paying for the full accumulated session state on every wave.

## Context

The audit found that swarm re-runs TDD as a wave-wide gate, re-reviews the full cumulative change set every wave, repeats expensive prompt boilerplate, performs duplicated remote operations, and serializes more git work than necessary.

## Quick Resolution Summary

Make the execution loop incremental: review only current-wave deltas, pipeline or narrow TDD work, trim prompt payloads, and stop paying repeated git and remote costs for already-known state.

## Functional Requirements

- **FR-1**: Review scope must default to wave-local or task-local deltas instead of the full accumulated changed file set.
- **FR-2**: TDD generation must stop acting as a full-wave blocking gate when only a subset of tasks needs tests.
- **FR-3**: The execution loop must maintain an incremental changed-file model so it does not recompute the full project diff on every wave without need.
- **FR-4**: Review, merge, and code prompts must be reduced to task-specific context and must not resend large static guidance that can be shared or inferred.
- **FR-5**: Remote git/PR operations must not happen twice for the same branch state.
- **FR-6**: Commit flow must minimize unnecessary serial git process overhead while preserving correct commit semantics.
- **FR-7**: Docs/report generation must consume incremental execution metadata instead of recomputing broad global snapshots when precise data already exists.

## Data Model

```ts
interface WaveDelta {
  waveIndex: number
  taskIds: string[]
  changedFiles: string[]
  newTestFiles: string[]
  reviewScopeFiles: string[]
}

interface ReviewScope {
  mode: 'wave-delta' | 'task-delta' | 'full-session'
  files: string[]
}
```

## Implementation Tasks

- [ ] Add explicit per-wave delta tracking in the DAG executor.
- [ ] Narrow review inputs to files touched in the current wave unless escalation requires a broader scope.
- [ ] Replace cumulative `accumulatedTestFiles` prompt growth with incremental or filtered test context.
- [ ] Shrink TDD and code prompts so they stop resending planner-wide or policy-heavy text on every attempt.
- [ ] Remove duplicated remote push behavior between PR creation and final CLI completion.
- [ ] Reduce per-task commit overhead where possible without weakening correctness.
- [ ] Add tests proving that later waves do not re-review unchanged files unless explicitly required.

## File Targets

- `src/phases/code/dag-executor.ts`
- `src/phases/code/review-merge.ts`
- `src/phases/code/code-agent-prompt.ts`
- `src/phases/tdd/test-prompt.ts`
- `src/phases/tdd/tdd-phase.ts`
- `src/git/git-operations.ts`
- `src/cli.ts`
- `tests/phases/code/dag-executor.test.ts`
- `tests/phases/code/code-agent-prompt.test.ts`
- `tests/phases/tdd/test-prompt.test.ts`
- `tests/git/git-operations.test.ts`

## Edge Cases

- Some findings require broader context than the current wave; escalation to a wider review scope must be explicit and testable.
- New files must still be visible to review agents even when using delta review scope.
- Commit batching must not merge unrelated task changes into a misleading commit history.

## Dependencies

### Internal

- `260315-execution-truthfulness.spec.md`

### External

- None

## Out of Scope

- Event correlation redesign
- JSON reporting schema redesign
- Structural extraction of shared orchestration helpers

## Acceptance Criteria

- [ ] Review scope is incremental by default.
- [ ] Prompt payloads are meaningfully smaller and no longer resend obvious static context each wave.
- [ ] TDD no longer blocks unrelated ready work when it is not necessary.
- [ ] Remote push/PR flow does not duplicate the same sync work.
- [ ] Execution metadata is precise enough for downstream docs/reporting use.
- [ ] `pnpm test` passes.
- [ ] `pnpm typecheck` passes.

## Future Agent Summary

- Optimize behavior only after truthful outcomes are already in place.
- Prefer deterministic delta tracking over additional LLM reasoning.
- Keep semantic behavior stable while reducing cost and latency.
