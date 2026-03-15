import type { AgentRequest, AgentResult, DriverRegistry } from '../drivers/driver.js'
import type { AgentRole, SessionContext } from '../core/types.js'

export const MAX_AGENT_RETRIES = 2

export const isRetryableErrorCode = (code: string): boolean => (
  code === 'timeout' || code === 'crash' || code === 'empty_output' || code === 'invalid_json'
)

export const isImmediateFailErrorCode = (code: string): boolean => (
  code === 'aborted' || code === 'spawn_error'
)

interface RetryAgentInvocationOptions {
  ctx: SessionContext
  registry: DriverRegistry
  role: AgentRole
  tag?: string
  prompt: string
  signal?: AbortSignal
  buildRequest?: (request: AgentRequest, attempt: number) => AgentRequest
  onRetryableError?: (result: Extract<AgentResult, { success: false }>, attempt: number) => void
  onImmediateFailure?: (result: Extract<AgentResult, { success: false }>) => never
  onExhausted?: (result: Extract<AgentResult, { success: false }>, attempt: number) => never
}

export const invokeAgentWithRetry = async ({
  ctx,
  registry,
  role,
  tag,
  prompt,
  signal,
  buildRequest,
  onRetryableError,
  onImmediateFailure,
  onExhausted,
}: RetryAgentInvocationOptions): Promise<Extract<AgentResult, { success: true }>> => {
  const resolution = tag === undefined
    ? registry.getDriver(role)
    : registry.getDriver(role, tag)
  const { driver, model, agent } = resolution
  const baseRequest: AgentRequest = {
    prompt,
    role,
    agent,
    model,
    projectDir: ctx.projectDir,
    signal,
  }

  for (let attempt = 0; attempt <= MAX_AGENT_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error(`${role} aborted`)
    }

    const request = buildRequest ? buildRequest(baseRequest, attempt) : baseRequest
    const result = await driver.invoke(request)
    if (result.success) {
      return result
    }

    if (isImmediateFailErrorCode(result.errorCode)) {
      if (onImmediateFailure) {
        onImmediateFailure(result)
      }
      throw new Error(`${role} failed: ${result.errorCode}: ${result.error}`)
    }

    if (isRetryableErrorCode(result.errorCode) && attempt < MAX_AGENT_RETRIES) {
      if (onRetryableError) {
        onRetryableError(result, attempt)
      }
      continue
    }

    if (onExhausted) {
      onExhausted(result, attempt)
    }
    throw new Error(`${role} failed after ${attempt + 1} attempts: ${result.errorCode}`)
  }

  throw new Error(`${role} failed: all retries exhausted`)
}
