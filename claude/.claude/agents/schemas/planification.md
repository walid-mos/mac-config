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

## HumanPrerequisite

```typescript
interface HumanPrerequisite {
  id: string                        // e.g., "PREREQ-001"
  description: string               // Actionable description of what the user must do
  blocksTaskIds: string[]           // PLAN-* IDs that cannot proceed without this
  category: 'secret' | 'external-service' | 'infrastructure' | 'access' | 'manual'
  urgency: 'before-impl' | 'before-deploy'
  verificationHint: string          // How the swarm can verify completion (e.g., "env var X is set")
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
  humanPrerequisites: HumanPrerequisite[]  // Empty array if none detected
  specUpdates: string | null
  warnings: string[]
  troubleshootingApplied: string[]
}
```
