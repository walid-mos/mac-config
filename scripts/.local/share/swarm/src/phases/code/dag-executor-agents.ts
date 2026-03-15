import type { SessionContext } from '../../core/types.js'
import type { DriverRegistry } from '../../drivers/driver.js'
import type { TechStack } from '../../detect/tech-stack.js'
import { invokeAgentWithRetry, isImmediateFailErrorCode, isRetryableErrorCode } from '../retryable-agent.js'
import { buildCodeAgentPrompt, buildFindingFixPrompt } from './code-agent-prompt.js'
import { extractCodeAgentOutput } from './code-phase.js'
import type { TaskNode } from './dag-executor-state.js'

const appendFilesChanged = (node: TaskNode, filesChanged: string[]): void => {
  for (const file of filesChanged) {
    if (!node.handle.filesChanged.includes(file)) {
      node.handle.filesChanged.push(file)
    }
  }
}

const extractAndTrackOutput = (node: TaskNode, output: string) => {
  const parsed = extractCodeAgentOutput(output)
  if (parsed) {
    appendFilesChanged(node, parsed.filesChanged)
  }
  return parsed
}

export const spawnFreshAgent = async (
  node: TaskNode,
  ctx: SessionContext,
  registry: DriverRegistry,
  techStack: TechStack,
  testFiles: string[],
  decisionLog: string,
  signal?: AbortSignal,
) => {
  const prompt = buildCodeAgentPrompt(node.task, testFiles, techStack, undefined, decisionLog)
  const result = await invokeAgentWithRetry({
    ctx,
    registry,
    role: 'code',
    tag: node.task.tag,
    prompt,
    signal,
    buildRequest: (request) => ({ ...request, sessionId: node.handle.sessionId }),
    onRetryableError: (retryResult) => {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'code', reason: `${retryResult.errorCode}: ${retryResult.error}` },
      })
    },
  })

  return extractAndTrackOutput(node, result.output)
}

export const resumeAgentWithFindings = async (
  node: TaskNode,
  ctx: SessionContext,
  registry: DriverRegistry,
  techStack: TechStack,
  testFiles: string[],
  decisionLog: string,
  signal?: AbortSignal,
) => {
  const { driver, model, agent } = registry.getDriver('code', node.task.tag)
  const findings = node.lastFindings ?? []
  const prompt = buildFindingFixPrompt(findings, decisionLog)

  if (signal?.aborted) {
    throw new Error('DAG execution aborted')
  }

  const resumeResult = await driver.invoke({
    prompt,
    role: 'code',
    agent,
    model,
    projectDir: ctx.projectDir,
    signal,
    resume: node.handle.sessionId,
  })

  if (resumeResult.success) {
    return extractAndTrackOutput(node, resumeResult.output)
  }

  if (isImmediateFailErrorCode(resumeResult.errorCode)) {
    throw new Error(`Code agent failed: ${resumeResult.errorCode}: ${resumeResult.error}`)
  }

  if (isRetryableErrorCode(resumeResult.errorCode)) {
    ctx.emitter.emit({
      type: 'agent:error',
      timestamp: new Date().toISOString(),
      sessionId: ctx.sessionId,
      data: { role: 'code', reason: `Resume failed (${resumeResult.errorCode}), falling back to fresh invocation` },
    })
  }

  const fallbackPrompt = buildCodeAgentPrompt(node.task, testFiles, techStack, findings, decisionLog)
  const result = await invokeAgentWithRetry({
    ctx,
    registry,
    role: 'code',
    prompt: fallbackPrompt,
    signal,
    onRetryableError: (retryResult) => {
      ctx.emitter.emit({
        type: 'agent:error',
        timestamp: new Date().toISOString(),
        sessionId: ctx.sessionId,
        data: { role: 'code', reason: `${retryResult.errorCode}: ${retryResult.error}` },
      })
    },
  })

  return extractAndTrackOutput(node, result.output)
}
