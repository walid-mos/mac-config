# Test Agent Schemas

> Input/output contracts for the Test Agent.
> This file is loaded by: Test Agent only.
> For shared types (TestingStrategy, TestingBrief), see `shared.md`.

---

## TestAgentInput (Lead → Test Agent)

```typescript
interface TestAgentInput {
  testingBrief: TestingBrief        // From shared.md — passed through from Planification
  specSections: Array<{
    taskId: string
    specContent: string             // Raw spec content (markdown)
    source: 'user-spec' | 'inferred'
  }>
  sessionName: string
  iterationNumber: number           // 1-based
  mode: TestAgentMode
  priorTestRun: PriorTestRun | null
}

type TestAgentMode =
  | 'initial'                       // Write tdd-strict tests, tdd-flexible outlines, note post-code
  | 'complete-flexible'             // After Code Agents: complete tdd-flexible placeholders
  | 'write-post-code'              // After Code Agents: write tests for post-code items
  | 'validate'                      // Re-run all tests, report status
  | 'red-green-cycle'               // Iterate on failing tests with Code Agent

interface PriorTestRun {
  testFiles: Array<{
    path: string
    taskId: string
    strategy: TestingStrategy
    status: 'written' | 'outline' | 'pending'
    testCount: number
    passingCount: number
    failingCount: number
  }>
  changedSourceFiles: string[]
  failingTests: Array<{
    testFile: string
    testName: string
    error: string
    expected: string | null
    received: string | null
  }>
  cycleCount: number                // Max 3
}
```

---

## TestAgentOutput (Test Agent → Lead)

```typescript
interface TestAgentOutput {
  taskResults: TestTaskResult[]
  summary: TestSummary
  specFeedback: SpecFeedbackItem[]
  couplingWarnings: CouplingWarning[]
  tddViolations: TddViolation[]
  codeAgentContext: CodeAgentTestContext[]
}

interface TestTaskResult {
  taskId: string
  strategy: TestingStrategy
  status: TestTaskStatus
  testFiles: Array<{
    path: string
    isNew: boolean
    testCount: number
    passingCount: number
    failingCount: number
    todoCount: number
    behaviors: string[]             // Top-level describe() names
  }>
  edgeCasesAdded: string[]
  blockedItems: Array<{
    testName: string
    reason: string
    specFeedbackRef: string | null  // References SpecFeedbackItem.id
  }>
}

type TestTaskStatus =
  | 'tests-written'                 // tdd-strict: all failing (red)
  | 'tests-written-partial'         // tdd-strict: some failing (red), some pre-covered (kept for unique coverage)
  | 'outlines-written'              // tdd-flexible: skeletons with TODOs
  | 'tests-complete'                // All passing (green)
  | 'noted'                         // post-code: noted, no files yet
  | 'blocked'                       // Spec ambiguity
  | 'validated'                     // Re-run: all pass

interface TestSummary {
  totalTasks: number
  byStatus: Record<TestTaskStatus, number>
  totalTests: number
  passing: number
  failing: number
  skipped: number
  todo: number
  qualityGates: {
    allBehaviorsCovered: boolean
    allErrorPathsCovered: boolean
    edgeCasesCovered: boolean
    noFlakyPatterns: boolean
    noOverMocking: boolean
    allAsyncCleanedUp: boolean
    fileOrganization: boolean
  }
  noTestsNeeded: boolean
  noTestsReason: string | null
}

interface SpecFeedbackItem {
  id: string                        // e.g., "SF-001"
  taskId: string
  issueType: 'missing-edge-case' | 'ambiguous-behavior' | 'contradictory-requirement' | 'unspecified-boundary'
  details: string
  suggestion: string
  impact: string[]                  // Blocked it.todo() test names
}

interface CouplingWarning {
  testFile: string
  mockCount: number
  mockedModules: string[]
  suggestion: string
}

interface TddViolation {
  testFile: string
  modifiedBy: string
  changes: string
}

interface CodeAgentTestContext {
  taskId: string
  testFiles: string[]
  strategy: TestingStrategy
  keyAssertions: string[]           // Plain-English critical assertions
  mustNotModifyTests: boolean       // true for tdd-strict
}
```
