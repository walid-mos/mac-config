# Swarm Remediation - Spec Manifest

> Generated from `docs/swarm-audit.md` on 2026-03-15.

## Project Overview

This plan turns the audit into a full remediation program for the `swarm` package. The goal is to make swarm truthful, bounded, observable, faster, cheaper in token usage, and easier to maintain without losing the current test depth and driver resilience.

The work is intentionally split into independent specs so future agents can implement high-leverage fixes in the right order while avoiding overlap on the hottest files.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Test Runner**: Vitest
- **Package Manager**: pnpm
- **Primary Surface**: CLI + LLM orchestration runtime

## Spec Files

| # | Spec | File | FRs | Depends On | Parallel Group |
|---|------|------|-----|------------|----------------|
| 1 | Execution Truthfulness | `260315-execution-truthfulness.spec.md` | 7 | - | A |
| 2 | Session Lifecycle | `260315-session-lifecycle.spec.md` | 6 | execution-truthfulness | B |
| 3 | Incremental Execution | `260315-incremental-execution.spec.md` | 7 | execution-truthfulness | C |
| 4 | Observability Events | `260315-observability-events.spec.md` | 7 | execution-truthfulness, session-lifecycle | C |
| 5 | Machine-First Reports | `260315-machine-first-reports.spec.md` | 7 | execution-truthfulness, incremental-execution, observability-events | D |
| 6 | Orchestration Refactor | `260315-orchestration-refactor.spec.md` | 7 | session-lifecycle, incremental-execution, observability-events, machine-first-reports | E |

## Execution Strategy

### Parallel Groups

- **Group A**: `execution-truthfulness` - foundation for truthful outcomes and bounded execution.
- **Group B**: `session-lifecycle` - depends on truthful outcomes because it persists and exposes them.
- **Group C**: `incremental-execution` and `observability-events` - can run in parallel once core outcome semantics are stable.
- **Group D**: `machine-first-reports` - should consume the stabilized runtime and event model.
- **Group E**: `orchestration-refactor` - last, to reorganize already-correct behavior instead of moving bugs around.

### Recommended Execution Order

1. `/swarm implement execution truthfulness per docs/specs/260315-execution-truthfulness.spec.md`
2. `/swarm implement session lifecycle per docs/specs/260315-session-lifecycle.spec.md`
3. `/swarm implement incremental execution per docs/specs/260315-incremental-execution.spec.md`
4. `/swarm implement observability events per docs/specs/260315-observability-events.spec.md`
5. `/swarm implement machine-first reports per docs/specs/260315-machine-first-reports.spec.md`
6. `/swarm implement orchestration refactor per docs/specs/260315-orchestration-refactor.spec.md`

### Shared Contracts

- **Execution outcome contract**: terminal task status, iteration outcome, convergence limits, and phase success are defined by `260315-execution-truthfulness.spec.md` and consumed everywhere else.
- **Session contract**: persisted state shape, CLI status views, and worktree lifecycle are owned by `260315-session-lifecycle.spec.md`.
- **Event contract**: correlation IDs, warning/error events, file/build events, and durable event logs are owned by `260315-observability-events.spec.md`.
- **Reporting contract**: JSON artifact schema, markdown rendering, and deterministic ordering are owned by `260315-machine-first-reports.spec.md`.
- **Refactor boundaries**: `260315-orchestration-refactor.spec.md` may reorganize modules but must not redefine semantics already established by earlier specs.

## Conflict Map

- `src/phases/code/dag-executor.ts` is shared by multiple specs. Only `execution-truthfulness` owns outcome semantics, `incremental-execution` owns review/delta performance changes, and `orchestration-refactor` owns extraction after behavior is stable.
- `src/cli.ts` is owned by `session-lifecycle` for behavior and by `orchestration-refactor` for final extraction only.
- `src/core/types.ts` and `src/phases/phase-results.ts` must keep one source of truth. Earlier specs define behavior; the refactor spec may only consolidate it.

## Agent Rules

- Land specs in manifest order.
- Do not mix semantic fixes with structural refactors in the same implementation pass.
- Keep tests green after every spec.
- Prefer direct imports; do not introduce barrel exports.

## Completion Definition

- All six specs are implemented.
- `pnpm test` passes.
- `pnpm typecheck` passes.
- Swarm status, outcomes, reports, and event logs reflect real execution state.
