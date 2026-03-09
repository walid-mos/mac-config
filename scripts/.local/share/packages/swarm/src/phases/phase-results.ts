// === Phase Result Accessors (Spec 3 — FR-8, Spec 4, Spec 5) ===

import { z } from 'zod'
import type { SwarmState, SessionId, AgentRole, TokenUsage } from '../core/types.js'
import type { TechStack } from '../detect/tech-stack.js'
import type { PlannerTask, TaskTag } from './plan/task-parser.js'

// === Shared Result Types (formerly in test-runner.ts / build-runner.ts) ===

export interface TestResult {
  totalTests: number
  passingTests: number
  failingTests: number
  durationMs: number
}

export interface BuildResult {
  success: boolean
  error?: string | null
  output?: string
  durationMs?: number
}

// === Agent Output Types ===

export interface TddAgentOutput {
  testFiles: string[]
  testResult: TestResult
  isRed: boolean
}

export interface CodeAgentOutput {
  filesChanged: string[]
  testResult: TestResult
  buildResult: BuildResult | null
  summary: string
}

// === Spec 3 Types ===

export interface PlanPhaseResult {
  plannerOutput: string
  tasks: PlannerTask[]
  techStack: TechStack
  taskCount: number
  tags: Partial<Record<TaskTag, number>>
}

export interface TddPhaseResult {
  testFiles: string[]
  agentReport: TddAgentOutput
}

// === Spec 4 Types ===

export interface TaskWave {
  waveIndex: number
  tasks: PlannerTask[]
}

export type CodeAgentOutput =
  | {
      taskId: `TASK-${number}`
      status: 'completed'
      filesModified: string[]
      filesCreated: string[]
      sanityChecksPassed: true
    }
  | {
      taskId: `TASK-${number}`
      status: 'failed' | 'blocked'
      filesModified: string[]
      filesCreated: string[]
      sanityChecksPassed: false
      sanityErrors: [string, ...string[]]
    }

export type ReviewCategory = 'bug' | 'security' | 'quality' | 'performance' | 'dry-violation' | 'dead-code' | 'spec-compliance'

export interface ReviewFinding {
  file: string
  line?: number | null
  severity: 'critical' | 'important' | 'suggestion'
  category: ReviewCategory
  description: string
  suggestedFix?: string
}

export interface MergedReview {
  findings: ReviewFinding[]
  criticalCount: number
  importantCount: number
  suggestionCount: number
}

export type IterationOutcome =
  | { status: 'green'; testResult: TestResult; review: MergedReview }
  | { status: 'needs-iteration'; testResult: TestResult; review: MergedReview; reason: 'review-findings' }
  | { status: 'max-iterations'; testResult: TestResult; review?: MergedReview }
  | { status: 'timeout'; testResult?: TestResult; review?: MergedReview }

export interface IterationState {
  iteration: number
  outcome: IterationOutcome
  changedFiles: string[]
}

export interface CommitRecord {
  hash: string
  message: string
  specItem: string
  iteration: number
}

export interface GitState {
  branch: string
  worktreePath?: string
  prNumber?: number
  prUrl?: string
  commits: CommitRecord[]
}

export interface FileContainmentResult {
  violations: string[]
  ciSensitive: string[]
}

export interface StagingCheckResult {
  allowed: string[]
  blocked: string[]
}

export interface TaskCompletionRecord {
  taskId: string
  title: string
  status: 'green' | 'failed'
  attempts: number
  commitHash?: string
}

export interface CodePhaseResult {
  waves: TaskWave[]
  iterations: IterationState[]
  finalTestResult: TestResult
  finalReview?: MergedReview
  gitState: GitState
  changedFiles: string[]
  success: boolean
  codePhaseTimeoutMs?: number
  taskCompletions?: TaskCompletionRecord[]
}

// === Zod Schemas ===

const techStackSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  testRunner: z.string().nullable(),
  packageManager: z.string(),
  buildTool: z.string().nullable(),
  configFiles: z.array(z.string()),
  testCommand: z.string(),
  buildCommand: z.string().nullable(),
  typecheckCommand: z.string().nullable(),
  lintCommand: z.string().nullable(),
})

const plannerTaskSchema = z.object({
  id: z.string().regex(/^TASK-\d+$/),
  title: z.string(),
  description: z.string(),
  tag: z.union([z.literal('backend'), z.literal('frontend'), z.literal('fullstack')]),
  dependencies: z.array(z.string().regex(/^TASK-\d+$/)),
  testHints: z.array(z.string()),
})

const planPhaseResultSchema = z.object({
  plannerOutput: z.string(),
  tasks: z.array(plannerTaskSchema),
  techStack: techStackSchema,
  taskCount: z.number(),
  tags: z.record(z.number()),
})

const tddAgentOutputSchema = z.object({
  testFiles: z.array(z.string()),
  testResult: z.object({
    totalTests: z.number(),
    passingTests: z.number(),
    failingTests: z.number(),
    durationMs: z.number().optional().default(0),
  }),
  isRed: z.boolean(),
})

const tddPhaseResultSchema = z.object({
  testFiles: z.array(z.string()),
  agentReport: tddAgentOutputSchema,
})

// Spec 4 Zod Schemas

const testResultSchema = z.object({
  totalTests: z.number(),
  passingTests: z.number(),
  failingTests: z.number(),
  durationMs: z.number().optional().default(0),
})

const reviewFindingSchema = z.object({
  file: z.string(),
  line: z.number().nullish(),
  severity: z.union([z.literal('critical'), z.literal('important'), z.literal('suggestion')]),
  category: z.union([
    z.literal('bug'), z.literal('security'), z.literal('quality'),
    z.literal('performance'), z.literal('dry-violation'), z.literal('dead-code'),
    z.literal('spec-compliance'),
  ]),
  description: z.string(),
  suggestedFix: z.string().optional(),
})

const mergedReviewSchema = z.object({
  findings: z.array(reviewFindingSchema),
  criticalCount: z.number(),
  importantCount: z.number(),
  suggestionCount: z.number(),
})

const iterationOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('green'), testResult: testResultSchema, review: mergedReviewSchema }),
  z.object({ status: z.literal('needs-iteration'), testResult: testResultSchema, review: mergedReviewSchema, reason: z.literal('review-findings') }),
  z.object({ status: z.literal('max-iterations'), testResult: testResultSchema, review: mergedReviewSchema.optional() }),
  z.object({ status: z.literal('timeout'), testResult: testResultSchema.optional(), review: mergedReviewSchema.optional() }),
])

const iterationStateSchema = z.object({
  iteration: z.number(),
  outcome: iterationOutcomeSchema,
  changedFiles: z.array(z.string()),
})

const taskWaveSchema = z.object({
  waveIndex: z.number(),
  tasks: z.array(plannerTaskSchema),
})

const commitRecordSchema = z.object({
  hash: z.string(),
  message: z.string(),
  specItem: z.string(),
  iteration: z.number(),
})

const gitStateSchema = z.object({
  branch: z.string(),
  worktreePath: z.string().optional(),
  prNumber: z.number().optional(),
  prUrl: z.string().optional(),
  commits: z.array(commitRecordSchema),
})

const taskCompletionRecordSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  status: z.union([z.literal('green'), z.literal('failed')]),
  attempts: z.number(),
  commitHash: z.string().optional(),
})

const codePhaseResultSchema = z.object({
  waves: z.array(taskWaveSchema),
  iterations: z.array(iterationStateSchema),
  finalTestResult: testResultSchema,
  finalReview: mergedReviewSchema.optional(),
  gitState: gitStateSchema,
  changedFiles: z.array(z.string()),
  success: z.boolean(),
  codePhaseTimeoutMs: z.number().optional(),
  taskCompletions: z.array(taskCompletionRecordSchema).optional(),
})

// === API ===

export function readPlanPhaseResult(state: SwarmState): PlanPhaseResult | null {
  const raw = state.phaseResults.plan
  if (raw === undefined) return null

  const parsed = planPhaseResultSchema.parse(raw)
  return parsed as PlanPhaseResult
}

export function readTddPhaseResult(state: SwarmState): TddPhaseResult | null {
  const raw = state.phaseResults.tdd
  if (raw === undefined) return null

  const parsed = tddPhaseResultSchema.parse(raw)
  return parsed as TddPhaseResult
}

export function readCodePhaseResult(state: SwarmState): CodePhaseResult | null {
  const raw = state.phaseResults.code
  if (raw === undefined) return null

  const parsed = codePhaseResultSchema.parse(raw)
  return parsed as CodePhaseResult
}

// === Spec 5 Types ===

export interface DeliveryReportInput {
  sessionId: SessionId
  specPath: string
  specItems: SpecItemSummary[]
  totalDuration: number
  startedAt: string
  completedAt: string
}

export interface SpecItemSummary {
  title: string
  iterationCount: number
  success: boolean
  tasks: TaskSummary[]
  testResult: TestResult
  reviewFindings: ReviewFindingSummary[]
  commitHash?: string
}

export interface TaskSummary {
  id: `TASK-${number}`
  title: string
  tag: TaskTag
  filesModified: string[]
}

export type ReviewFindingSummary = Pick<ReviewFinding, 'severity' | 'category' | 'description'> & {
  resolved: boolean
  resolution?: string
}

export interface AgentInvocationRecord {
  role: AgentRole
  model: string
  durationMs: number
  tokenUsage?: TokenUsage
}

export interface IterationLogEntry {
  specItem: string
  iterationIndex: number
  agentsInvoked: AgentInvocationRecord[]
  testResult?: TestResult
  reviewFindingCount: number
  filesChanged: string[]
}

export interface DocsPhaseResult {
  deliveryReportPath: string
  iterationsLogPath: string
  commitHash?: string
  prUpdated: boolean
  prMarkedReady: boolean
  usedFallbackReport: boolean
  success: boolean
}

// Spec 5 Zod Schemas

const tokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheCreation: z.number(),
  cacheRead: z.number(),
})

const agentInvocationRecordSchema = z.object({
  role: z.union([
    z.literal('plan'), z.literal('test'), z.literal('code'),
    z.literal('review'), z.literal('security'), z.literal('consistency'),
    z.literal('merge'), z.literal('docs'),
  ]),
  model: z.string(),
  durationMs: z.number(),
  tokenUsage: tokenUsageSchema.optional(),
})

const reviewFindingSummarySchema = z.object({
  severity: z.union([z.literal('critical'), z.literal('important'), z.literal('suggestion')]),
  category: z.union([
    z.literal('bug'), z.literal('security'), z.literal('quality'),
    z.literal('performance'), z.literal('dry-violation'), z.literal('dead-code'),
    z.literal('spec-compliance'),
  ]),
  description: z.string(),
  resolved: z.boolean(),
  resolution: z.string().optional(),
})

const taskSummarySchema = z.object({
  id: z.string().regex(/^TASK-\d+$/),
  title: z.string(),
  tag: z.union([z.literal('backend'), z.literal('frontend'), z.literal('fullstack')]),
  filesModified: z.array(z.string()),
})

const specItemSummarySchema = z.object({
  title: z.string(),
  iterationCount: z.number(),
  success: z.boolean(),
  tasks: z.array(taskSummarySchema),
  testResult: testResultSchema,
  reviewFindings: z.array(reviewFindingSummarySchema),
  commitHash: z.string().optional(),
})

const deliveryReportInputSchema = z.object({
  sessionId: z.string(),
  specPath: z.string(),
  specItems: z.array(specItemSummarySchema),
  totalDuration: z.number(),
  startedAt: z.string(),
  completedAt: z.string(),
})

const iterationLogEntrySchema = z.object({
  specItem: z.string(),
  iterationIndex: z.number(),
  agentsInvoked: z.array(agentInvocationRecordSchema),
  testResult: testResultSchema.optional(),
  reviewFindingCount: z.number(),
  filesChanged: z.array(z.string()),
})

const docsPhaseResultSchema = z.object({
  deliveryReportPath: z.string(),
  iterationsLogPath: z.string(),
  commitHash: z.string().optional(),
  prUpdated: z.boolean(),
  prMarkedReady: z.boolean(),
  usedFallbackReport: z.boolean(),
  success: z.boolean(),
})

// Export schemas for external use
export {
  deliveryReportInputSchema,
  iterationLogEntrySchema,
  docsPhaseResultSchema,
  specItemSummarySchema,
  taskSummarySchema,
  reviewFindingSummarySchema,
  agentInvocationRecordSchema,
}

export function readDocsPhaseResult(state: SwarmState): DocsPhaseResult | null {
  const raw = state.phaseResults.docs
  if (raw === undefined) return null

  const parsed = docsPhaseResultSchema.parse(raw)
  return parsed as DocsPhaseResult
}
