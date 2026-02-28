// === Docs Phase (Spec 5 — FR-1 through FR-10) ===

import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { DocsPhaseResult } from '../phase-results.js'

// === API ===

export async function runDocsPhase(
  _ctx: SessionContext,
  _registry: DriverRegistry,
  _signal?: AbortSignal
): Promise<DocsPhaseResult> {
  throw new Error('Not implemented')
}
