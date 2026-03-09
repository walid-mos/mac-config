# Remove File Lists from Task Model — Spec

## Overview

Remove the mandatory `files: string[]` field from `PlannerTask` and all downstream consumers. The planner should NOT dictate which files a code agent creates or modifies — that's the code agent's job. The planner provides task descriptions and dependency ordering; the code agent autonomously decides file structure.

## Context

Currently the planner outputs a `- **Files**: file1.ts, file2.ts` line per task. This file list flows through:

1. **Planner prompt** — asks the LLM to list files per task
2. **Task parser** — parses, validates paths, feeds `resolveFileOverlaps()`
3. **Code agent prompt** — shows a `# Files` section listing the files to create/modify
4. **Code agent constraint** — "ONLY modify files in the Files section" (containment)
5. **Phase results** — `PlannerTask.files` stored in state, Zod-validated
6. **Docs phase** — `TaskSummary.filesModified` derived from agent self-report

**Problems observed in production:**
- Code agents over-deliver: batch 0 (3 tasks) created 16 files, implementing the entire project. Batches 1-2 had nothing left to do — 0 changed files, no commits.
- The file list creates a false sense of containment. Agents ignore it when they "know better."
- The planner is a poor predictor of exact file paths — it's guessing structure before seeing the project.

## Functional Requirements

- **FR-1**: Remove `files: string[]` from `PlannerTask` interface. Replace with `fileHints?: string[]` (optional, non-binding).
- **FR-2**: Remove the `- **Files**: file1.ts, file2.ts` line from the planner prompt template entirely. The planner no longer outputs file lists.
- **FR-3**: Remove the `# Files` section from the code agent prompt. The code agent receives: Role, Task (id + title + description), Test Hints, Test Files, Tech Stack, Previous Findings, Constraints. No file guidance.
- **FR-4**: Replace the containment constraint ("ONLY modify files in the Files section") with a soft scope: "Focus on implementing the task described above. Other tasks are handled by other agents — avoid implementing functionality that belongs to a different task."
- **FR-5**: Remove `resolveFileOverlaps()` entirely from the task parser. Trust the planner's DAG to keep parallel tasks on separate domains. If two parallel tasks touch the same file, that's a planner quality issue, not a parser concern.
- **FR-6**: Remove `validateFilePath()` from the task parser — no file paths to validate.
- **FR-7**: Remove file-related parsing from `parseTaskBlock()` — no `extractField(bodyLines, 'Files')`.
- **FR-8**: Update `TaskSummary.filesModified` in the docs phase to be populated from `getChangedFiles()` (git diff) per batch, not from agent self-report.
- **FR-9**: Keep `CodeAgentOutput.filesModified` and `filesCreated` as metadata (informational for logs), but they are NOT used for commits, reviews, or docs. Git diff is the single source of truth.
- **FR-10**: Update all Zod schemas that reference `files` on `PlannerTask` — change to `fileHints: z.array(z.string()).optional()`.
- **FR-11**: Update all tests to reflect the removal of `files` and addition of optional `fileHints`.

## Data Model

### Before

```typescript
interface PlannerTask {
  id: `TASK-${number}`
  title: string
  description: string
  tag: TaskTag
  files: string[]              // <-- mandatory
  dependencies: `TASK-${number}`[]
  testHints: string[]
}
```

### After

```typescript
interface PlannerTask {
  id: `TASK-${number}`
  title: string
  description: string
  tag: TaskTag
  fileHints?: string[]         // <-- optional, non-binding
  dependencies: `TASK-${number}`[]
  testHints: string[]
}
```

### TaskSummary (docs phase)

No interface change — `filesModified: string[]` stays. But its data source changes from `CodeAgentOutput.filesModified` to `getChangedFiles()` per batch.

## Edge Cases

- **Planner returns a `Files` line despite prompt not asking for it**: Task parser should ignore unknown fields gracefully (already does — `extractField` returns `''` for missing fields).
- **fileHints is undefined vs empty array**: Both mean "no hints." Zod schema uses `.optional()`, TypeScript type uses `?`.
- **Parallel agents write same file**: No automatic serialization. The review phase may catch conflicts. If not, the code agent retry loop handles it on the next iteration.
- **Agent self-report lies about filesModified**: Doesn't matter — git diff is the source of truth for commits and docs.

## Dependencies

### Internal
- `src/phases/plan/task-parser.ts` — PlannerTask interface, parseTaskBlock, resolveFileOverlaps, validateFilePath
- `src/phases/plan/planner-prompt.ts` — planner prompt template
- `src/phases/code/code-agent-prompt.ts` — code agent prompt builder
- `src/phases/phase-results.ts` — Zod schemas for PlannerTask
- `src/phases/code/code-phase.ts` — iteration loop (TaskSummary population)
- `src/phases/docs/docs-phase.ts` — delivery report building
- All corresponding test files

## Out of Scope

- Per-agent worktree isolation (future enhancement)
- Changing the planner's DAG structure or dependency model
- Modifying `CodeAgentOutput.filesModified/filesCreated` fields (kept as metadata)
- Changing the review/security/merge agent prompts

## Acceptance Criteria

- [ ] `PlannerTask.files` no longer exists; `PlannerTask.fileHints` is optional
- [ ] Planner prompt does not ask for file lists
- [ ] Code agent prompt has no `# Files` section
- [ ] Code agent constraint says "focus on your task" not "only touch these files"
- [ ] `resolveFileOverlaps()` and `validateFilePath()` are deleted
- [ ] `TaskSummary.filesModified` comes from git diff, not agent self-report
- [ ] All Zod schemas updated
- [ ] All tests pass (`pnpm test && pnpm build`)
