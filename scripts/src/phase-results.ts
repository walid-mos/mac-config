// === Phase Result Accessors (Spec 3 — FR-8) ===

import { z } from 'zod'
import type { SwarmState } from './types.js'
import type { TechStack } from './tech-stack.js'
import type { PlannerTask, TaskTag } from './task-parser.js'
import type { RedVerification } from './red-verification.js'

// === Types ===

export interface PlanPhaseResult {
  plannerOutput: string
  tasks: PlannerTask[]
  techStack: TechStack
  taskCount: number
  tags: Partial<Record<TaskTag, number>>
}

export interface TddPhaseResult {
  testFiles: string[]
  redVerification: RedVerification
}

// === Zod Schemas ===

const techStackSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  testRunner: z.union([z.literal('vitest'), z.literal('jest'), z.literal('playwright'), z.null()]),
  packageManager: z.union([z.literal('pnpm'), z.literal('npm'), z.literal('yarn'), z.literal('bun')]),
  buildTool: z.union([z.literal('vite'), z.literal('webpack'), z.literal('turbopack'), z.null()]),
  configFiles: z.array(z.string()),
  testCommand: z.string(),
})

const plannerTaskSchema = z.object({
  id: z.string().regex(/^TASK-\d+$/),
  title: z.string(),
  description: z.string(),
  tag: z.union([z.literal('backend'), z.literal('frontend'), z.literal('fullstack')]),
  files: z.array(z.string()),
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

const redVerificationSchema = z.object({
  totalTests: z.number(),
  passingTests: z.number(),
  failingTests: z.number(),
  durationMs: z.number(),
  syntaxErrors: z.array(z.string()),
  testFiles: z.array(z.string()),
  isRed: z.boolean(),
})

const tddPhaseResultSchema = z.object({
  testFiles: z.array(z.string()),
  redVerification: redVerificationSchema,
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
