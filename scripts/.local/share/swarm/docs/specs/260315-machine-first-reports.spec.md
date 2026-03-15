# Machine-First Reports - Spec

## Overview

Convert the docs phase from markdown-first reporting into a deterministic, schema-validated reporting pipeline that produces canonical JSON artifacts and then renders human markdown from those JSON inputs.

## Context

The audit found that the docs phase is resilient but not deterministic enough for API consumers. The primary delivery report is unconstrained LLM markdown, task-level file ownership is inaccurate, output formatting is not locale-stable, and the report collapses the whole run into one synthetic spec item.

## Quick Resolution Summary

Generate validated JSON artifacts first, render markdown second, preserve task-accurate and iteration-accurate metadata, and make report outputs stable enough for downstream automation and APIs.

## Functional Requirements

- **FR-1**: The docs phase must emit canonical JSON artifacts for the delivery report and iteration log before producing markdown.
- **FR-2**: Markdown reports must be rendered from validated JSON artifacts rather than from unconstrained LLM output.
- **FR-3**: Task-level file attribution in reports must use task- or wave-scoped execution metadata instead of one global changed-file list.
- **FR-4**: Report schemas must include explicit versioning and must reject unknown fields where stability matters.
- **FR-5**: Iteration logs and delivery reports must use deterministic ordering and locale-independent formatting.
- **FR-6**: Report output paths must be session-scoped so repeated runs do not overwrite previous artifacts.
- **FR-7**: The CLI and docs phase result must expose the generated artifact paths for machine consumers.

## Data Model

```ts
interface DeliveryReportJson {
  schemaVersion: 1
  sessionId: string
  startedAt: string
  completedAt: string
  totalDurationMs: number
  specItems: SpecItemSummary[]
}

interface IterationLogJson {
  schemaVersion: 1
  sessionId: string
  iterations: IterationLogEntry[]
}

interface DocsArtifacts {
  deliveryReportJsonPath: string
  deliveryReportMarkdownPath: string
  iterationLogJsonPath: string
  iterationLogMarkdownPath: string
}
```

## Implementation Tasks

- [ ] Define strict JSON schemas and exported types for delivery and iteration artifacts.
- [ ] Refactor docs generation so JSON is the source of truth and markdown is a renderer.
- [ ] Replace global `changedFiles` task attribution with precise execution metadata.
- [ ] Remove locale-sensitive number formatting and enforce deterministic sorting.
- [ ] Write artifacts under a session-scoped directory instead of fixed root-level filenames.
- [ ] Update CLI/state/docs phase results to expose JSON and markdown artifact paths.
- [ ] Add golden-style tests for exact JSON and markdown output stability.

## File Targets

- `src/phases/docs/docs-phase.ts`
- `src/phases/docs/report-builder.ts`
- `src/phases/docs/iteration-log-builder.ts`
- `src/phases/docs/fallback-report.ts`
- `src/phases/phase-results.ts`
- `src/cli.ts`
- `tests/phases/docs/docs-phase.test.ts`
- `tests/phases/docs/report-builder.test.ts`
- `tests/phases/docs/iteration-log-builder.test.ts`
- `tests/phases/docs/fallback-report.test.ts`
- `tests/phases/phase-results.test.ts`

## Edge Cases

- If the optional docs writer agent is retained for polish, it must not become the authoritative source of artifact structure.
- Session artifact paths must remain inside the project root.
- Historical report artifacts must not break status or cleanup behavior.

## Dependencies

### Internal

- `260315-execution-truthfulness.spec.md`
- `260315-incremental-execution.spec.md`
- `260315-observability-events.spec.md`

### External

- None

## Out of Scope

- Session lifecycle command implementation
- Large runtime prompt optimization outside docs generation
- Structural driver refactor

## Acceptance Criteria

- [ ] Delivery report JSON and iteration log JSON are first-class artifacts.
- [ ] Markdown output is rendered from validated JSON.
- [ ] Task-level file attribution is accurate.
- [ ] Schemas are versioned and strict where stability matters.
- [ ] Reports are deterministic across locales and repeated runs.
- [ ] Artifact paths are session-scoped and exposed to machine consumers.
- [ ] `pnpm test` passes.
- [ ] `pnpm typecheck` passes.

## Future Agent Summary

- Make the artifact contract machine-first and deterministic.
- Do not let markdown generation redefine the underlying data model.
- Treat reporting as a pure consumer of execution and event truth.
