# Shared Agent Schemas

> Cross-boundary types used by multiple agents.
> This file is loaded by: Planification Agent, Test Agent.

---

## Base Types

```typescript
type TestingStrategy = 'tdd-strict' | 'tdd-flexible' | 'post-code'
type AssetType = 'component' | 'hook' | 'utility' | 'service' | 'type' | 'config' | 'style' | 'test-utility'
```

---

## TaskItem

Produced by Planification Agent, consumed by Lead → Code Agents.
The canonical structure is defined inline in `planification-agent.md`. Summary for cross-reference:

```typescript
interface TaskItem {
  id: string                    // "PLAN-001" — universal join key across all schemas
  title: string
  specItems: string[]
  files: { reuses: string[], extends: string[], creates: string[] }
  dependencies: string[]
  specialist: string
  testingStrategy: TestingStrategy
  testingRationale: string
  acceptanceCriteria: string[]
  antiPatterns: string[]
  sharedContext: string[]
  complexity: 'low' | 'medium' | 'high'
  notes: string
}
```

---

## TestingBrief

Produced by Planification Agent, passed through Lead, consumed by Test Agent.

```typescript
interface TestingBriefItem {
  taskId: string                    // References TaskItem.id
  title: string                     // From TaskItem.title
  strategy: TestingStrategy
  strategyRationale: string         // From TaskItem.testingRationale
  acceptanceCriteria: string[]      // From TaskItem — the "what to test"
  edgeCases: string[]               // Specific edge cases the Test Agent MUST cover
  errorPaths: string[]              // Expected error conditions and their behavior
  importsToMock: string[]           // External boundaries needing mocks (network, fs, etc.)
  importsToKeepReal: string[]       // Internal modules that must NOT be mocked
  antiPatterns: string[]            // "DO NOT" directives affecting test design
  targetFiles: {
    creates: string[]               // New source files tests target
    extends: string[]               // Existing files being modified
  }
  existingTestFiles: string[]       // Existing test files near targets (for pattern reference)
  existingTestUtilities: string[]   // Paths to __test-utils__/, factories, shared mocks
  testNotes: string                 // Free-form notes pre-answering Test Agent questions
  sharedContext: string[]           // Types/interfaces needed from other tasks
  dependsOnTasks: string[]          // Task IDs whose types must exist before tests
}

interface TestingBrief {
  items: TestingBriefItem[]
  globalContext: {
    techStack: string[]             // e.g., ["vitest", "react-testing-library", "msw"]
    testFramework: string           // e.g., "vitest"
    testConfigPath: string | null
    existingPatterns: string[]      // Codebase-wide test patterns discovered
  }
  summary: {
    totalTasks: number
    byStrategy: { tddStrict: number, tddFlexible: number, postCode: number }
  }
}
```
