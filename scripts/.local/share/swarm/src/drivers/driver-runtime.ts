import * as fs from 'node:fs'
import type { AgentRequest } from './driver.js'

const MODEL_RE = /^[a-zA-Z0-9._\/-]{1,64}$/
const AGENT_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const JSON_DIRECTIVE = '\n\nIMPORTANT: Output ONLY raw JSON matching the provided schema. No markdown fences, no narrative text, no commentary.'

export const safeKill = (pid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(-pid, signal)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw err
    }
  }
}

export const truncate = (value: string, max: number): string => {
  if (value.length <= max) {
    return value
  }

  return value.slice(0, max)
}

interface ValidateAgentRequestOptions {
  requireSessionPersistence?: boolean
}

export const validateAgentRequest = (
  request: AgentRequest,
  { requireSessionPersistence = false }: ValidateAgentRequestOptions = {},
): string | null => {
  if (!MODEL_RE.test(request.model)) {
    return `Invalid model: "${request.model}"`
  }

  if (request.agent !== undefined && !AGENT_NAME_RE.test(request.agent)) {
    return `Invalid agent name: "${request.agent}"`
  }

  if (request.schema !== undefined) {
    try {
      JSON.parse(request.schema)
    } catch {
      return 'Invalid schema: not valid JSON'
    }
  }

  try {
    const stat = fs.statSync(request.projectDir)
    if (!stat.isDirectory()) {
      return `projectDir is not a directory: "${request.projectDir}"`
    }
  } catch {
    return `projectDir is not accessible: "${request.projectDir}"`
  }

  if (request.timeout !== undefined) {
    if (request.timeout < 10_000 || request.timeout > 3_600_000) {
      return `Timeout must be between 10000ms and 3600000ms, got ${request.timeout}ms`
    }
  }

  if (!requireSessionPersistence) {
    return null
  }

  if (request.sessionId !== undefined && request.resume !== undefined) {
    return 'sessionId and resume are mutually exclusive - set one or neither'
  }

  if (request.sessionId !== undefined && !UUID_RE.test(request.sessionId)) {
    return `Invalid sessionId: must be a UUID, got "${request.sessionId}"`
  }

  if (request.resume !== undefined && !UUID_RE.test(request.resume)) {
    return `Invalid resume: must be a UUID, got "${request.resume}"`
  }

  return null
}
