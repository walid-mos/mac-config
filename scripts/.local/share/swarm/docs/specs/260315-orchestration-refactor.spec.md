# Orchestration Refactor - Spec

## Overview

Reduce structural complexity and DRY violations after runtime semantics, lifecycle, observability, and reporting are stable. This spec exists to remove duplicated orchestration code and split oversized modules without changing the behavior defined by earlier specs.

## Context

The audit found broad duplication across phase retry logic, prompt builders, process wrappers, large drivers, `cli.ts`, `dag-executor.ts`, and duplicate result/type definitions. Those issues make change expensive, but they should only be addressed after the behavior layer is corrected.

Validation during planning also found current typecheck debt in `src/detect/tech-stack.ts`, `src/drivers/output-parser.ts`, `src/phases/code/code-agent-prompt.ts`, `src/phases/code/iteration-logger.ts`, and `src/phases/phase-results.ts`. The duplicate `CodeAgentOutput` definition is already part of the audit; the remaining issues should be cleared as part of the final consolidation pass so the package ends with a clean `pnpm typecheck` run.

## Quick Resolution Summary

Extract shared orchestration primitives, split large files by responsibility, consolidate duplicate prompt and type logic, and leave semantics unchanged except where earlier specs already required semantic changes.

## Functional Requirements

- **FR-1**: Extract shared phase runner and retry helpers so plan, TDD, review, code, and docs phases stop re-implementing the same control flow.
- **FR-2**: Extract shared process and command execution helpers so git, docs, review, and CLI paths stop duplicating spawn wrappers.
- **FR-3**: Consolidate duplicated prompt fragments across review, security, consistency, TDD, and code prompts into reusable builders.
- **FR-4**: Split `cli.ts` into a thin command entrypoint and separate session runner or lifecycle services.
- **FR-5**: Split `dag-executor.ts` into smaller modules with focused responsibilities such as wave selection, review cycle, and commit handling.
- **FR-6**: Split driver implementations so backend-specific parsing is isolated from shared process lifecycle code.
- **FR-7**: Remove duplicate type definitions and establish one authoritative source for result and schema models.

## Data Model

```ts
interface PhaseRunnerHooks<T> {
  phase: string
  run: () => Promise<T>
  onSuccess?: (result: T) => Promise<void> | void
  onError?: (error: Error) => Promise<void> | void
}

interface ProcessCommandOptions {
  cmd: string
  args: string[]
  cwd: string
  timeoutMs?: number
  stdin?: string
}
```

## Implementation Tasks

- [ ] Extract shared phase invocation and retry helpers.
- [ ] Replace duplicated spawn helpers with one shared process utility layer.
- [ ] Consolidate repeated prompt sections into reusable builders.
- [ ] Split `src/cli.ts` into a thin CLI plus session lifecycle services.
- [ ] Split `src/phases/code/dag-executor.ts` into smaller domain modules.
- [ ] Extract shared driver runtime code from Claude and OpenCode drivers.
- [ ] Remove duplicate `CodeAgentOutput` definitions and related schema drift.
- [ ] Clear the current typecheck debt in files surfaced by `pnpm typecheck` and keep the package clean as modules move.
- [ ] Update tests to target the new module boundaries without changing validated behavior.

## File Targets

- `src/cli.ts`
- `src/phases/code/dag-executor.ts`
- `src/phases/code/review-prompt.ts`
- `src/phases/code/security-prompt.ts`
- `src/phases/code/consistency-prompt.ts`
- `src/phases/code/code-agent-prompt.ts`
- `src/phases/tdd/test-prompt.ts`
- `src/drivers/claude-driver.ts`
- `src/drivers/opencode-driver.ts`
- `src/phases/phase-results.ts`
- `tests/phases/**`
- `tests/drivers/**`
- `tests/cli.test.ts`

## Edge Cases

- Refactors must preserve the semantics established by earlier specs.
- Extraction must not introduce circular dependencies.
- Shared utilities must remain narrow and avoid creating a new god module.

## Dependencies

### Internal

- `260315-session-lifecycle.spec.md`
- `260315-incremental-execution.spec.md`
- `260315-observability-events.spec.md`
- `260315-machine-first-reports.spec.md`

### External

- None

## Out of Scope

- New product features
- Semantics that were not already approved in earlier remediation specs
- Additional review heuristics or agent-role expansion

## Acceptance Criteria

- [ ] Shared orchestration and retry logic is centralized.
- [ ] Process spawning logic is centralized.
- [ ] Prompt duplication is materially reduced.
- [ ] `cli.ts`, `dag-executor.ts`, and driver files are split into smaller focused modules.
- [ ] Result and schema types have one authoritative definition.
- [ ] Behavior validated by earlier specs remains unchanged.
- [ ] `pnpm test` passes.
- [ ] `pnpm typecheck` passes.

## Future Agent Summary

- Refactor last, not first.
- Treat this spec as structural cleanup after behavior is proven correct.
- If a refactor changes semantics, that change belongs in an earlier spec instead.
