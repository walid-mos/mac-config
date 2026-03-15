import * as childProcess from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { EventCorrelation, SessionId, SwarmEventEmitter, TokenUsage } from '../core/types.js'
import type { Driver, AgentRequest, AgentResult, DriverAvailability } from './driver.js'
import { extractStreamResult } from './output-parser.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_RE = /^[a-zA-Z0-9._\/-]{1,64}$/
const AGENT_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_TIMEOUT = 10_000
const MAX_TIMEOUT = 3_600_000
const DEFAULT_IDLE_TIMEOUT = 300_000   // 5 min without output once working = frozen
const MODEL_INFERENCE_TIMEOUT = 600_000 // 10 min while waiting for model response (no streaming during generation)
const API_WAIT_TIMEOUT = 600_000       // 10 min to get first assistant response from API
const MAX_RAW_OUTPUT = 1024 * 1024  // 1MB
const MAX_STDERR = 64 * 1024        // 64KB
const KILL_GRACE_MS = 5_000
const AVAILABILITY_TIMEOUT = 10_000

const SANITIZED_ENV_KEYS = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
] as const

const JSON_DIRECTIVE = '\n\nIMPORTANT: Output ONLY raw JSON matching the provided schema. No markdown fences, no narrative text, no commentary.'

// ---------------------------------------------------------------------------
// Process group kill with ESRCH handling
// ---------------------------------------------------------------------------

function safeKill(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err
  }
}

// ---------------------------------------------------------------------------
// Truncation helpers
// ---------------------------------------------------------------------------

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max)
}

function buildCorrelation(
  request: AgentRequest,
  invocationId: string,
  backendSessionId?: string
): EventCorrelation | undefined {
  if (!request.correlation && !backendSessionId) {
    return undefined
  }

  return {
    ...request.correlation,
    invocationId,
    backendSessionId: backendSessionId ?? request.correlation?.backendSessionId,
  }
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateCommonInputs(
  request: AgentRequest
): string | null {
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
      return `Invalid schema: not valid JSON`
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
    if (request.timeout < MIN_TIMEOUT || request.timeout > MAX_TIMEOUT) {
      return `Timeout must be between ${MIN_TIMEOUT}ms and ${MAX_TIMEOUT}ms, got ${request.timeout}ms`
    }
  }

  if (request.sessionId !== undefined && request.resume !== undefined) {
    return 'sessionId and resume are mutually exclusive — set one or neither'
  }

  if (request.sessionId !== undefined && !UUID_RE.test(request.sessionId)) {
    return `Invalid sessionId: must be a UUID, got "${request.sessionId}"`
  }

  if (request.resume !== undefined && !UUID_RE.test(request.resume)) {
    return `Invalid resume: must be a UUID, got "${request.resume}"`
  }

  return null
}

// ---------------------------------------------------------------------------
// createClaudeDriver
// ---------------------------------------------------------------------------

export function createClaudeDriver(emitter: SwarmEventEmitter): Driver {
  const name = 'claude' as const

  async function invoke(request: AgentRequest): Promise<AgentResult> {
    const startTime = Date.now()
    const backend = name
    const model = request.model
    const swarmSessionId = request.swarmSessionId ?? ('driver' as SessionId)

    // Pre-aborted signal check (before any other validation)
    if (request.signal?.aborted) {
      return {
        success: false,
        errorCode: 'aborted',
        error: 'Aborted before invocation',
        rawOutput: '',
        stderr: '',
        model,
        backend,
        durationMs: Date.now() - startTime,
      }
    }

    // Input validation
    const validationError = validateCommonInputs(request)
    if (validationError) {
      return {
        success: false,
        errorCode: 'spawn_error',
        error: validationError,
        rawOutput: '',
        stderr: '',
        model,
        backend,
        durationMs: Date.now() - startTime,
      }
    }

    // Build command args
    const args: string[] = [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
      '--disable-slash-commands',
      '--model', String(request.model),
    ]

    // Session persistence: --resume and --session-id require session to be saved,
    // so they skip --no-session-persistence. Default (no session fields) disables persistence.
    if (request.resume) {
      args.push('--resume', request.resume)
    } else if (request.sessionId) {
      args.push('--session-id', request.sessionId)
    } else {
      args.push('--no-session-persistence')
    }

    if (request.agent) {
      args.push('--agent', request.agent)
    }

    if (request.schema) {
      args.push('--json-schema', request.schema)
    }

    // Build sanitized environment
    const env = { ...process.env }
    for (const key of SANITIZED_ENV_KEYS) {
      delete env[key]
    }

    // Emit agent:invoke event
    const initialBackendSessionId = request.sessionId ?? request.resume
    const invokeCorrelation = buildCorrelation(request, randomUUID(), initialBackendSessionId)
    emitter.emit({
      type: 'agent:invoke',
      timestamp: new Date().toISOString(),
      sessionId: swarmSessionId,
      correlation: invokeCorrelation,
      data: { role: request.role, backend, model: String(model) },
    })

    return new Promise<AgentResult>((resolve) => {
      let totalInput = 0
      let totalOutput = 0
      let totalCacheCreation = 0
      let totalCacheRead = 0

      const buildTokenUsage = (): TokenUsage => ({
        input: totalInput,
        output: totalOutput,
        cacheCreation: totalCacheCreation,
        cacheRead: totalCacheRead,
      })

      let proc: childProcess.ChildProcess
      try {
        proc = childProcess.spawn('claude', args, {
          cwd: request.projectDir,
          detached: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
        })
      } catch (err) {
        const durationMs = Date.now() - startTime
        emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: swarmSessionId,
          correlation: invokeCorrelation,
          data: { role: request.role, reason: (err as Error).message },
        })
        resolve({
          success: false,
          errorCode: 'spawn_error',
          error: (err as Error).message,
          rawOutput: '',
          stderr: '',
          model,
          backend,
          durationMs,
        })
        return
      }

      // Open log file for raw NDJSON stream
      const logDir = process.env.SWARM_DEBUG_DIR ?? os.tmpdir()
      const logPath = path.join(logDir, `swarm-agent-${request.role}-${proc.pid}.ndjson`)
      let logFd: number | undefined
      try {
        logFd = fs.openSync(logPath, 'w', 0o600)
      } catch {
        // Non-critical — proceed without logging
      }

      // Pipe prompt via stdin
      const promptContent = request.schema
        ? request.prompt + JSON_DIRECTIVE
        : request.prompt
      proc.stdin!.write(promptContent)
      proc.stdin!.end()

      // Collect stdout/stderr
      let stdoutBuf = ''
      let stderrBuf = ''
      let lineBuf = ''
      let resultText: string | undefined
      let killStarted = false
      let errorCode: 'timeout' | 'aborted' | 'crash' = 'crash'
      let killTimer: ReturnType<typeof setTimeout> | undefined
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      let resolved = false

      const doResolve = (result: AgentResult): void => {
        if (resolved) return
        resolved = true
        if (idleTimer) clearTimeout(idleTimer)
        if (killTimer) clearTimeout(killTimer)
        if (request.signal) {
          try {
            request.signal.removeEventListener('abort', onAbort)
          } catch {
            // Ignore if already removed
          }
        }
        // Close log file
        if (logFd !== undefined) {
          try { fs.closeSync(logFd) } catch { /* best-effort */ }
        }
        resolve(result)
      }

      const startKillSequence = (code: 'timeout' | 'aborted'): void => {
        if (killStarted) return
        killStarted = true
        errorCode = code

        if (proc.pid !== undefined) {
          // Close stdin to signal the process to stop
          try { proc.stdin!.destroy() } catch { /* already closed */ }

          safeKill(proc.pid, 'SIGTERM')

          // After grace period, SIGKILL
          killTimer = setTimeout(() => {
            if (proc.pid !== undefined) {
              safeKill(proc.pid, 'SIGKILL')
            }
          }, KILL_GRACE_MS)
        }
      }

      // Three-phase timeout:
      // Phase 1 (API wait): waiting for first assistant response from API
      // Phase 2 (model inference): waiting for model to generate next response (no stdout during generation)
      // Phase 3 (idle): tool is executing or agent is between turns
      const idleTimeout = request.timeout ?? DEFAULT_IDLE_TIMEOUT
      let agentWorking = false  // flips true on first assistant event
      let awaitingModelResponse = false // true after tool_result, false after assistant event

      const resetIdleTimer = (): void => {
        if (killStarted) return
        if (idleTimer) clearTimeout(idleTimer)
        let timeout: number
        if (!agentWorking) {
          timeout = API_WAIT_TIMEOUT
        } else if (awaitingModelResponse) {
          timeout = MODEL_INFERENCE_TIMEOUT
        } else {
          timeout = idleTimeout
        }
        idleTimer = setTimeout(() => {
          startKillSequence('timeout')
        }, timeout)
      }

      resetIdleTimer()

      // AbortSignal handling
      const onAbort = (): void => {
        startKillSequence('aborted')
      }

      if (request.signal) {
        request.signal.addEventListener('abort', onAbort, { once: true })
      }

      // Process NDJSON lines from stdout
      const processLine = (line: string): void => {
        // Write to log file
        if (logFd !== undefined) {
          try { fs.writeSync(logFd, line + '\n') } catch { /* best-effort */ }
        }

        try {
          const event = JSON.parse(line)

          // Flip to working state once agent starts producing work
          if (!agentWorking && (event.type === 'assistant' || event.type === 'result')) {
            agentWorking = true
          }

          // Track model inference state:
          // After a tool_result (user event), the model is generating its next response — use generous timeout
          // After an assistant event, a tool is executing or we're between turns — use idle timeout
          if (event.type === 'user') {
            awaitingModelResponse = true
          } else if (event.type === 'assistant' || event.type === 'result') {
            awaitingModelResponse = false
          }

          // Accumulate token usage from assistant events
          if (event.type === 'assistant' && event.message?.usage) {
            const usage = event.message.usage
            totalInput += usage.input_tokens ?? 0
            totalOutput += usage.output_tokens ?? 0
            totalCacheCreation += usage.cache_creation_input_tokens ?? 0
            totalCacheRead += usage.cache_read_input_tokens ?? 0
          }

          // Extract final result
          if (event.type === 'result' && event.result !== undefined) {
            resultText = typeof event.result === 'string'
              ? event.result
              : JSON.stringify(event.result)
          }

          // Emit activity for tool_use (real-time agent observability)
          if (event.type === 'assistant' && event.message?.type === 'tool_use') {
            emitter.emit({
              type: 'agent:activity',
              timestamp: new Date().toISOString(),
              sessionId: swarmSessionId,
              correlation: invokeCorrelation,
              data: { role: request.role, tool: event.message.name ?? 'unknown' },
            })
          }
        } catch {
          // Not valid JSON — skip
        }
      }

      proc.stdout!.on('data', (chunk: Buffer) => {
        const data = chunk.toString()
        stdoutBuf += data
        lineBuf += data

        // Process complete NDJSON lines
        let newlineIdx: number
        while ((newlineIdx = lineBuf.indexOf('\n')) !== -1) {
          const line = lineBuf.slice(0, newlineIdx).trim()
          lineBuf = lineBuf.slice(newlineIdx + 1)
          if (!line) continue
          processLine(line)
          resetIdleTimer()
        }
      })

      proc.stderr!.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString()
        // stderr activity also counts as heartbeat
        resetIdleTimer()
      })

      proc.on('error', (err: Error) => {
        const durationMs = Date.now() - startTime
        const tokenUsage = buildTokenUsage()
        emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: swarmSessionId,
          correlation: invokeCorrelation,
          data: { role: request.role, reason: err.message, tokenUsage },
        })
        doResolve({
          success: false,
          errorCode: 'spawn_error',
          error: err.message,
          rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
          stderr: truncate(stderrBuf, MAX_STDERR),
          model,
          backend,
          durationMs,
          tokenUsage,
        })
      })

      proc.on('close', (exitCode: number | null) => {
        const durationMs = Date.now() - startTime

        // Process any remaining buffered line
        const remaining = lineBuf.trim()
        if (remaining) {
          processLine(remaining)
        }

        // If kill was started, use the kill error code
        if (killStarted) {
          const stderrSnippet = stderrBuf.trim().slice(0, 500)
          const reason = stderrSnippet
            ? `Process ${errorCode} after ${durationMs}ms — stderr: ${stderrSnippet}`
            : `Process ${errorCode} after ${durationMs}ms`
          const tokenUsage = buildTokenUsage()
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: swarmSessionId,
            correlation: invokeCorrelation,
            data: { role: request.role, reason, tokenUsage },
          })
          doResolve({
            success: false,
            errorCode,
            error: reason,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage,
          })
          return
        }

        // Non-zero exit without kill = crash
        if (exitCode !== 0 && exitCode !== null) {
          const stderrSnippet = stderrBuf.trim().slice(0, 500)
          const reason = stderrSnippet
            ? `Process exited with code ${exitCode}: ${stderrSnippet}`
            : `Process exited with code ${exitCode}`
          const tokenUsage = buildTokenUsage()
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: swarmSessionId,
            correlation: invokeCorrelation,
            data: { role: request.role, reason, tokenUsage },
          })
          doResolve({
            success: false,
            errorCode: 'crash',
            error: reason,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage,
          })
          return
        }

        // Empty output
        if (stdoutBuf.trim() === '') {
          const tokenUsage = buildTokenUsage()
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: swarmSessionId,
            correlation: invokeCorrelation,
            data: { role: request.role, reason: 'Empty output from backend', tokenUsage },
          })
          doResolve({
            success: false,
            errorCode: 'empty_output',
            error: 'Backend produced empty output',
            rawOutput: '',
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage,
          })
          return
        }

        // Use result extracted from stream, or fallback to scanning the raw NDJSON
        if (!resultText) {
          const fallback = extractStreamResult(stdoutBuf)
          if (fallback.ok) {
            resultText = fallback.output
          }
        }

        const tokenUsage = buildTokenUsage()
        if (resultText !== undefined && resultText.trim() !== '') {
          const echoSessionId = request.sessionId ?? request.resume
          const resultCorrelation = buildCorrelation(request, invokeCorrelation?.invocationId ?? randomUUID(), echoSessionId)
          emitter.emit({
            type: 'agent:result',
            timestamp: new Date().toISOString(),
            sessionId: swarmSessionId,
            correlation: resultCorrelation,
            data: { role: request.role, durationMs, tokenUsage },
          })
          const successResult: AgentResult = {
            success: true,
            output: resultText,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage,
          }
          if (echoSessionId) {
            successResult.sessionId = echoSessionId
          }
          doResolve(successResult)
        } else {
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: swarmSessionId,
            correlation: invokeCorrelation,
            data: { role: request.role, reason: 'No result event in stream output', tokenUsage },
          })
          doResolve({
            success: false,
            errorCode: 'invalid_json',
            error: 'No result event found in stream-json output',
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
            tokenUsage,
          })
        }
      })
    })
  }

  async function checkAvailability(): Promise<DriverAvailability> {
    return new Promise<DriverAvailability>((resolve) => {
      let resolved = false
      let stdoutBuf = ''
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined

      const doResolve = (result: DriverAvailability): void => {
        if (resolved) return
        resolved = true
        if (timeoutTimer) clearTimeout(timeoutTimer)
        resolve(result)
      }

      const proc = childProcess.spawn('claude', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      timeoutTimer = setTimeout(() => {
        try { proc.kill('SIGTERM') } catch { /* ignore */ }
        doResolve({ available: false, error: 'claude --version timed out' })
      }, AVAILABILITY_TIMEOUT)

      proc.stdout!.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString()
      })

      proc.on('error', (err: Error) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          doResolve({ available: false, error: 'claude not found in PATH' })
        } else {
          doResolve({ available: false, error: err.message })
        }
      })

      proc.on('close', () => {
        const version = stdoutBuf.trim()
        if (version.length > 0) {
          doResolve({ available: true, version })
        } else {
          doResolve({ available: false, error: 'claude --version produced no output' })
        }
      })
    })
  }

  return { name, invoke, checkAvailability }
}
