// === Code Phase (Spec 4 — FR-2, FR-5, FR-8, FR-13, FR-15, FR-16, FR-18) ===

import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { TechStack } from '../../detect/tech-stack.js'
import type {
  PlanPhaseResult,
  TddPhaseResult,
  CodePhaseResult,
  TaskBatch,
  IterationOutcome,
  ReviewFinding,
} from '../phase-results.js'

// === API ===

export async function runCodePhase(
  _ctx: SessionContext,
  _registry: DriverRegistry,
  _plan: PlanPhaseResult,
  _tdd: TddPhaseResult,
  _signal?: AbortSignal
): Promise<CodePhaseResult> {
  throw new Error('Not implemented')
}

export async function runIteration(
  _ctx: SessionContext,
  _registry: DriverRegistry,
  _batches: TaskBatch[],
  _techStack: TechStack,
  _specItemContext: string,
  _previousFindings?: ReviewFinding[],
  _signal?: AbortSignal
): Promise<IterationOutcome> {
  throw new Error('Not implemented')
}
