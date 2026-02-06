# Planification Agent Schemas

> Output types exclusive to the Planification Agent.
> This file is loaded by: Planification Agent only.
> For shared types (TaskItem, TestingBrief), see `shared.md`.

---

## ExecutionPlan

```typescript
interface ExecutionPlan {
  parallel: string[][]          // Groups of task IDs that can run concurrently
  serial: string[][]            // Groups that must run in sequence
  reason: string                // Why this ordering was chosen
}
```

---

## ReuseMap

```typescript
interface ReuseAsset {
  path: string                      // Project-relative file path
  type: AssetType                   // From shared.md
  exports: string[]                 // Named exports relevant to this iteration
  description: string
  usedByTasks: string[]             // TaskItem.ids referencing this asset
}

interface ReuseMap {
  assets: ReuseAsset[]
  taskMapping: Record<string, {     // Keyed by TaskItem.id
    reuses: string[]
    extends: string[]
    creates: string[]
  }>
  fileConflicts: Array<{
    path: string
    taskIds: string[]
    resolution: 'serialize' | 'merge'
    note: string
  }>
}
```

---

## Planification Output (complete shape)

```typescript
interface PlanificationOutput {
  taskList: TaskItem[]
  executionPlan: ExecutionPlan
  testingBrief: TestingBrief        // Defined in shared.md
  reuseMap: ReuseMap
  specUpdates: string | null
  warnings: string[]
  troubleshootingApplied: string[]
}
```
