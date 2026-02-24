# Lead Agent Schemas

> Input/output contracts and internal state for the Lead Agent and Iteration Runner.
> This file is loaded by: Lead Agent, Iteration Runner.
> For shared types (TaskItem, TestingBrief, TestingStrategy), see `shared.md`.
> For Planification output types (PlanificationOutput, ExecutionPlan, ReuseMap, HumanPrerequisite), see `planification.md`.
> For Test Agent types (TestAgentInput, TestAgentOutput), see `test-agent.md`.

---

## LeadAgentInput (from /swarm skill)

```typescript
interface LeadAgentInput {
  taskDescription: string               // Original free-form task description
  sessionName: string                   // Date-prefixed kebab-case name (e.g., "260216-add-user-auth")
  normalizedSpec: NormalizedSpec
  techStack: TechStack
  swarmConfig: SwarmConfig
  existingDocs: ExistingDocs
}

type NormalizedSpec =
  | { type: 'full-spec'; content: string; path: string }
  | { type: 'partial-spec'; content: string; path: string; gaps: string[] }
  | { type: 'no-spec'; description: string }

interface TechStack {
  languages: string[]                   // e.g., ["typescript", "css"]
  frameworks: string[]                  // e.g., ["astro", "react"]
  testRunner: string | null             // e.g., "vitest"
  packageManager: string                // e.g., "pnpm"
  buildTool: string | null              // e.g., "vite"
  configs: string[]                     // Detected config file paths
}

interface SwarmConfig {
  specialists: string[]                 // e.g., ["typescript", "react", "astro"] — or auto-detect
  defaultTestStrategy: 'tdd-strict' | 'tdd-flexible' | 'post-code'
  autoCommit: boolean                   // Default: true
  prOnComplete: boolean                 // Default: true
  confirmExit: 'auto' | 'always' | 'never'  // Default: "auto"
}

interface ExistingDocs {
  troubleshooting: string | null        // Contents of docs/troubleshooting.md
  iterations: string | null             // Contents of docs/swarm/<session>/iterations.md (if resuming)
}
```

---

## GlobalState (internal — carried across iterations)

```typescript
interface GlobalState {
  sessionName: string
  specItems: SpecItem[]
  currentIteration: number              // Starts at 1
  completedItems: string[]              // Spec item IDs done
  pendingItems: string[]                // Spec item IDs remaining
  blockedItems: BlockedItem[]           // Spec item IDs blocked with reason
  accumulatedChanges: AccumulatedChanges
  iterationHistory: IterationSummary[]  // Compressed summaries of past iterations
  recurringIssues: RecurringIssue[]     // Issue pattern tracking
  sharedAssets: SharedAsset[]           // Types/interfaces produced by previous iterations
  plannedBatches: PlannedBatch[]       // LOCKED batch plan from Step 4 — never merge, only split
  humanPrerequisites: HumanPrerequisite[] // From PlanificationOutput — before-deploy items for delivery report
  retryCounters: Record<number, {     // Keyed by iteration number
    buildRetries: number
    testRetries: number
  }>
}

interface PlannedBatch {
  iteration: number                     // 1-indexed iteration number
  specItemIds: string[]                 // Spec item IDs in this batch
  status: 'pending' | 'in-progress' | 'completed'
}

interface SpecItem {
  id: string                            // Original ID from spec (e.g., "FR-5", "US-3")
  title: string
  content: string                       // Raw spec content for this item
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  complexity: 'low' | 'medium' | 'high'
  dependencies: string[]                // Other spec item IDs this depends on
  completedInIteration: number | null   // Which iteration completed this item
}

interface BlockedItem {
  specItemId: string
  reason: string
  since: number                         // Iteration number when blocked
}

interface AccumulatedChanges {
  filesChanged: string[]
  filesCreated: string[]
  testsWritten: number
  testsPassing: number
}

interface IterationSummary {
  iteration: number
  specItemIds: string[]                 // Which spec items were in this batch
  tasksCompleted: number
  testsPassing: number
  testsFailing: number
  reviewIssues: { quickFix: number; significant: number; security: number }
  lintPassed: boolean                   // Whether project-wide lint passed for this iteration
  buildPassed: boolean                  // Whether project build passed for this iteration
  status: 'complete' | 'partial'
  oneLineSummary: string                // e.g., "4 tasks done (auth-service, login-form), 12 tests pass, 0 issues"
}

interface RecurringIssue {
  pattern: string                       // Normalized description
  count: number                         // Occurrence count
  firstSeen: number                     // Iteration number
  lastSeen: number                      // Iteration number
  escalated: boolean                    // Whether user was asked
}

interface SharedAsset {
  path: string                          // File path of the produced asset
  type: 'type' | 'interface' | 'service' | 'hook' | 'component' | 'utility'
  exports: string[]                     // Named exports available
  producedInIteration: number
}
```

---

## IterationRunnerInput (Lead Agent → Iteration Runner)

```typescript
interface IterationRunnerInput {
  sessionName: string
  iterationNumber: number
  specItemBatch: SpecItem[]           // Current batch from plannedBatches
  techStack: TechStack
  swarmConfig: SwarmConfig
  sharedAssets: SharedAsset[]         // From prior iterations
  troubleshootingContext: string | null // Accumulated troubleshooting + any retry context
  iterationHistory: string            // Compressed 1-line summaries of prior iterations
  referencedSkills: Record<string, string> | null  // Skill name → full content
  recurringIssues: RecurringIssue[]   // For 3-strike detection within the iteration
  humanPrerequisites: HumanPrerequisite[] // Accumulated from prior planification outputs
  isRetry: boolean                    // Whether this is a retry of a failed iteration
  retryContext: RetryContext | null    // Context from the failed attempt
}

interface RetryContext {
  reason: IterationFailedReason
  previousAttemptDetails: string      // What was tried and failed
  buildError: string | null           // Parsed build error output (for build-failure retries)
  filesOnDisk: string[]               // Files created before failure (may need cleanup or reuse)
}
```

---

## IterationRunnerOutput (Iteration Runner → Lead Agent)

```typescript
type IterationRunnerOutput = IterationSuccess | IterationFailed

interface IterationSuccess {
  status: 'completed'
  iterationNumber: number
  specItemIds: string[]
  completedItems: string[]            // Spec items completed
  blockedItems: BlockedItem[]         // Spec items blocked (if any)
  filesChanged: string[]
  filesCreated: string[]
  testResults: { total: number; passed: number; failed: number }
  reviewSummary: { totalIssues: number; quickFixes: number; significant: number; critical: number }
  securitySummary: { totalIssues: number; quickFixes: number; significant: number; critical: number }
  lintPassed: boolean
  buildPassed: boolean
  commitSha: string
  sharedAssets: SharedAsset[]
  escalations: string[]               // Significant/critical issue descriptions for Lead to track
  humanPrerequisites: HumanPrerequisite[] // New prerequisites discovered in this iteration
  innerRetries: InnerRetryLog[]
  oneLineSummary: string              // e.g., "3 tasks done (auth, login, types), 15 tests pass, 0 issues"
}

type IterationFailedReason =
  | 'build-failure'
  | 'test-failure-after-3-cycles'
  | 'critical-escalation'
  | 'lint-failure-after-2-attempts'
  | 'phase-a-failed'
  | 'human-prerequisite-blocking'

interface IterationFailed {
  status: 'failed'
  iterationNumber: number
  specItemIds: string[]
  reason: IterationFailedReason
  details: string                     // Parsed error details
  troubleshootingContext: string       // What was tried, what failed
  partialOutputs: {
    planOutput: string | null         // Compressed PlanificationOutput
    testOutput: string | null         // Compressed TestAgentOutput
    codeOutputs: string | null        // Compressed CodeAgentOutputs
    reviewOutput: string | null       // Compressed ReviewAgentOutput
    securityOutput: string | null     // Compressed SecurityAgentOutput
  }
  filesOnDisk: string[]               // Files created/modified before failure
  humanPrerequisites: HumanPrerequisite[] // before-impl items that block progress
  innerRetries: InnerRetryLog[]
}

interface InnerRetryLog {
  phase: 'D0-lint' | 'D1.5-gate' | 'C-fix' | 'B-test'
  attempt: number
  action: string
  result: 'resolved' | 'escalated'
}
```

---

## CodeAgentInput (Lead → Code Agent)

```typescript
interface CodeAgentInput {
  taskItem: TaskItem                    // From PlanificationOutput.taskList — see shared.md
  sessionName: string                   // Date-prefixed kebab-case name — for doc output paths (docs/swarm/<session>/fixes.md)
  testFiles: string[]                   // Paths from TestAgentOutput
  testingStrategy: TestingStrategy      // From shared.md
  techStack: TechStack
  specialistSkill: string               // Which skill to load (e.g., "typescript", "react")
  sharedTypes: SharedAsset[]            // From dependent tasks or previous iterations
  fixInstructions: FixInstruction[] | null  // For fix cycles only
}

interface FixInstruction {
  issueId: string                       // References ReviewIssue.id (REV-XXX) or SecurityIssue.id (SEC-XXX)
  file: string
  description: string
  suggestedFix: string
  severity: 'quick-fix' | 'significant'
}
```

---

## CodeAgentOutput (Code Agent → Lead)

```typescript
interface CodeAgentOutput {
  taskId: string
  status: 'completed' | 'failed' | 'blocked'
  filesChanged: string[]
  filesCreated: string[]
  testResults: {
    total: number
    passed: number
    failed: number
    skipped: number
    output: string                      // Raw test runner output (truncated)
  }
  acceptanceCriteriaMet: Array<{
    criterion: string
    met: boolean
    notes: string
  }>
  typeCheckResult: {
    ran: boolean                         // Whether type-check was executed
    tool: string | null                  // e.g., "astro check", "tsc --noEmit"
    passed: boolean
    errorCount: number
    errors: string[]                     // Truncated list of error messages (max 10)
  }
  lintResult: {
    ran: boolean                         // Whether lint was executed
    tool: string | null                  // e.g., "biome", "eslint", "package.json lint script"
    passed: boolean
    errorCount: number
    warningCount: number
    autoFixed: number                    // Count of issues auto-fixed via --fix/--write
  }
  bugsReported: number                  // Count of bugs written to docs/swarm/<session>/fixes.md
  concerns: string[]
  sharedOutput: {                       // Assets produced for dependent tasks
    exports: string[]
    filePaths: string[]
  }
}
```

---

## ReviewAgentInput (Lead → Code Review / Security Agent)

```typescript
interface ReviewAgentInput {
  changedFiles: string[]                // All files changed/created in this iteration
  sessionName: string
  iterationNumber: number
}
```

Both agents know their scope — the Code Review Agent loads the `clean-code` skill internally, and the Security Agent loads the OWASP checklist internally. No `reviewType` or `checklist` field needed.

---

## ReviewAgentOutput (Code Review Agent → Lead)

```typescript
interface ReviewAgentOutput {
  issues: ReviewIssue[]
  summary: {
    totalIssues: number
    quickFixes: number
    significant: number
    critical: number
  }
  cleanFiles: string[]                  // Files with no issues found
}

interface ReviewIssue {
  id: string                            // "REV-001", "REV-002", ...
  type: 'dry-violation' | 'dead-code' | 'bad-pattern' | 'code-quality'
  severity: 'quick-fix' | 'significant' | 'critical'
  file: string
  line: number | null
  description: string
  suggestedFix: string
}
```

---

## SecurityAgentOutput (Security Agent → Lead)

```typescript
interface SecurityAgentOutput {
  issues: SecurityIssue[]
  summary: {
    totalIssues: number
    quickFixes: number
    significant: number
    critical: number
    skippedLowValue: number             // Findings skipped via cost/benefit matrix
  }
  cleanFiles: string[]                  // Files with zero issues
  attackSurfaceSummary: string          // 2-3 sentence overview of the attack surface
}

interface SecurityIssue {
  id: string                            // "SEC-001", "SEC-002", ...
  type: 'injection' | 'broken-access-control' | 'cryptographic-failure'
       | 'security-misconfiguration' | 'authentication-failure'
       | 'insecure-design' | 'integrity-failure' | 'logging-failure'
  owaspCategory: string                 // e.g., "A01:2025 Broken Access Control"
  cwe: string | null                    // e.g., "CWE-89" (SQL Injection)
  severity: 'quick-fix' | 'significant' | 'critical'
  impact: 'critical' | 'high' | 'medium' | 'low'
  fixComplexity: 'trivial' | 'low' | 'medium' | 'high'
  file: string
  line: number | null
  description: string
  suggestedFix: string
  needsManualReview: boolean            // True if data flow tracing was incomplete
}
```

---

## Documentation Output Formats

### IterationLog (written to `docs/swarm/<session-name>/iterations.md`)

```markdown
### Iteration <N> — <ISO-8601 timestamp>
**Batch**: <spec item IDs>
**Tasks**: <count> (<specialist breakdown>)
**Tests**: <written>/<passing>/<failing>
**Review**: <quick-fixes applied>/<significant logged>/<security issues>
**Lint**: <passed | failed | skipped (no tool)>
**Build**: <passed | failed>
**Code changes**:
- <file path>: <one-line description>
**Bugs fixed**:
- <bug description> → <fix description>
**Status**: <complete | partial — reason>
```

### TroubleshootingEntry (appended to `docs/troubleshooting.md` — append-only via Edit, NEVER Write)

```markdown
### <Issue title> — <session-name> iter <N> — <ISO-8601 timestamp>
- **Type**: <bug | architecture | security | performance>
- **Location**: <file>:<line> (or general area)
- **Description**: <1-2 sentences>
- **Root cause**: <if known>
- **Status**: <open | workaround-applied>
- **Related spec items**: <IDs>
```

### DeliveryReport (written to `docs/swarm/<session-name>/delivery-report.md` at completion)

```markdown
## Session: <session-name> — <ISO-8601 timestamp>

### What Was Delivered
- <concrete deliverable 1 — what the user can now use/see>
- <concrete deliverable 2>
- ...

### Architecture Decisions
- <decision made> — <why this approach, what was considered>
- ...

### Per-Iteration Breakdown
| Iter | Spec Items | Tasks | Tests | Review Issues | Status |
|------|-----------|-------|-------|--------------|--------|
| 1    | FR-1, FR-2 | 3    | 15/15 | 0 quick, 0 sig | complete |
| 2    | FR-3, FR-4, FR-5 | 5 | 28/28 | 1 quick, 0 sig | complete |

### Manual Follow-Up Actions
- <action the user must perform before deployment — from humanPrerequisites with urgency "before-deploy">
- "none" if no human prerequisites were detected

### Known Limitations
- <limitation or trade-off — what was intentionally NOT done and why>
- "none" if clean delivery

### Issues Encountered
- <issue> → <resolution>
- "none" if clean run
```
