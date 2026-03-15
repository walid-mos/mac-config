// === Code Agent Output Parser (Spec 4 — FR-4) ===

import { z } from 'zod'
import type { TaskCodeAgentOutput } from '../phase-results.js'

// === Schemas ===

const taskIdPattern = /^TASK-\d+$/

const completedSchema = z.object({
  taskId: z.string().regex(taskIdPattern),
  status: z.literal('completed'),
  filesModified: z.array(z.string()),
  filesCreated: z.array(z.string()),
  sanityChecksPassed: z.literal(true),
}).passthrough()

const failedBlockedSchema = z.object({
  taskId: z.string().regex(taskIdPattern),
  status: z.union([z.literal('failed'), z.literal('blocked')]),
  filesModified: z.array(z.string()),
  filesCreated: z.array(z.string()),
  sanityChecksPassed: z.literal(false),
  sanityErrors: z.array(z.string()).nonempty(),
}).passthrough()

const codeAgentOutputSchema = z.union([completedSchema, failedBlockedSchema])

// === API ===

export function parseCodeAgentOutput(raw: string): TaskCodeAgentOutput {
  if (!raw || raw.trim() === '') {
    throw new Error('Empty input')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Invalid JSON: ${(err as Error).message}`)
  }

  const result = codeAgentOutputSchema.parse(parsed)

  return result as TaskCodeAgentOutput
}
