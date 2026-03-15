# Observability Events - Spec

## Overview

Make swarm observable in real time with durable, correlated, machine-readable telemetry. The current event model is promising but incomplete: drivers emit a fake session ID, some declared events are never produced, and too many important warnings go straight to stderr instead of structured events.

## Context

The audit found that event typing exists, but correlation and durability are weak. `file:changed` and `build:*` are declared but unused, successful runs delete raw agent logs, and runtime warnings are fragmented across many `process.stderr.write` calls.

## Quick Resolution Summary

Thread real session metadata through every runtime event, emit a durable session event log, add missing file/build/warning events, and make operator-visible telemetry queryable instead of relying on raw stderr text.

## Functional Requirements

- **FR-1**: Driver-emitted `agent:*` events must use the real swarm session ID instead of a hard-coded driver session.
- **FR-2**: `agent:*` events must include stable correlation metadata: invocation ID, task ID when available, iteration, attempt, and backend session or resume identifier when available.
- **FR-3**: Swarm must emit durable session-level NDJSON event logs inside the project session directory instead of relying only on stdout.
- **FR-4**: Swarm must emit the declared `file:changed`, `build:success`, and `build:fail` events whenever those runtime facts are known.
- **FR-5**: Operational warnings and non-fatal failures that currently go only to stderr must also be emitted as structured events.
- **FR-6**: Successful runs must retain enough raw and structured log data for post-run debugging, with explicit retention behavior instead of unconditional deletion.
- **FR-7**: Status/reporting consumers must be able to reconstruct agent activity without correlating only by role name.

## Data Model

```ts
interface AgentCorrelationData {
  invocationId: string
  taskId?: string
  iteration?: number
  attempt?: number
  backendSessionId?: string
  resumedFrom?: string
}

interface WarningEvent {
  type: 'warning'
  timestamp: string
  sessionId: string
  data: {
    source: string
    reason: string
    details?: string
  }
}
```

## Implementation Tasks

- [ ] Thread the real session ID and correlation metadata through driver invocation APIs.
- [ ] Extend event types and schemas for structured warning/error events where needed.
- [ ] Persist a session event ledger such as `.swarm/run/<session>/events.ndjson`.
- [ ] Emit `file:changed` events from the code execution path.
- [ ] Emit `build:*` events whenever build or typecheck execution produces a result.
- [ ] Replace stderr-only warnings with mirrored structured events.
- [ ] Define retention behavior for raw agent logs and session event logs.
- [ ] Add tests for event correlation, persistence, and warning emission.

## File Targets

- `src/core/types.ts`
- `src/core/event-emitter.ts`
- `src/drivers/claude-driver.ts`
- `src/drivers/opencode-driver.ts`
- `src/phases/code/dag-executor.ts`
- `src/phases/docs/docs-phase.ts`
- `src/cli.ts`
- `tests/core/event-emitter.test.ts`
- `tests/drivers/claude-driver.test.ts`
- `tests/drivers/opencode-driver.test.ts`
- `tests/phases/docs/iteration-log-builder.test.ts`

## Edge Cases

- Some events occur outside a task context; task ID must remain optional without losing correlation usefulness.
- Log persistence must not make stdout NDJSON unusable for current operators.
- Event payload growth must stay within emitter size limits.

## Dependencies

### Internal

- `260315-execution-truthfulness.spec.md`
- `260315-session-lifecycle.spec.md`

### External

- None

## Out of Scope

- Machine-first JSON report rendering
- DAG runtime performance optimization
- Large structural refactor of driver modules

## Acceptance Criteria

- [ ] Agent events use the real session ID.
- [ ] Agent events carry correlation metadata rich enough to distinguish concurrent same-role work.
- [ ] A durable per-session event log is written.
- [ ] `file:changed` and `build:*` events are emitted in real execution paths.
- [ ] Non-fatal runtime warnings are queryable as structured events.
- [ ] Successful runs retain defined log artifacts.
- [ ] `pnpm test` passes.
- [ ] `pnpm typecheck` passes.

## Future Agent Summary

- Focus on telemetry production, not reporting presentation.
- Keep the event model stable and additive.
- Favor structured events over more stderr strings.
