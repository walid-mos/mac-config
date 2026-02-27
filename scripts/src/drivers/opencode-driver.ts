import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SessionId, SwarmEventEmitter } from '../types.js'
import type { Driver, AgentRequest, AgentResult, DriverAvailability } from './driver.js'
import { parseStructuredOutput } from './output-parser.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_RE = /^[a-zA-Z0-9._\/-]{1,64}$/
const AGENT_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/
const MIN_TIMEOUT = 10_000
const MAX_TIMEOUT = 3_600_000
const DEFAULT_TIMEOUT = 600_000
const MAX_RAW_OUTPUT = 1024 * 1024  // 1MB
const MAX_STDERR = 64 * 1024        // 64KB
const KILL_GRACE_MS = 5_000
const AVAILABILITY_TIMEOUT = 10_000
const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

// Literal prefixes after "http://" that indicate an allowed hostname.
// Used to reject encoded/octal/hex IP representations that Node.js normalizes.
// Each prefix covers the hostname followed by common delimiters (port, path, end).
const ALLOWED_HOST_PREFIXES = [
  'localhost:', 'localhost/',  'localhost',
  '127.0.0.1:', '127.0.0.1/', '127.0.0.1',
  '[::1]:', '[::1]/', '[::1]',
]

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

  return null
}

// ---------------------------------------------------------------------------
// DS-2: Context file containment validation
// ---------------------------------------------------------------------------

function validateContextFiles(files: string[], projectDir: string): string | null {
  for (const filePath of files) {
    let canonical: string
    try {
      canonical = fs.realpathSync(filePath)
    } catch {
      return `Context file not accessible: "${filePath}"`
    }

    // Normalize projectDir for comparison
    const normalizedProjectDir = projectDir.endsWith(path.sep)
      ? projectDir
      : projectDir + path.sep

    if (!canonical.startsWith(normalizedProjectDir) && canonical !== projectDir) {
      return `Context file "${filePath}" resolves outside projectDir`
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// DS-3: Attach URL validation
// ---------------------------------------------------------------------------

function validateAttachUrl(urlStr: string): string | null {
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    return `Invalid URL: "${urlStr}"`
  }

  if (url.protocol !== 'http:') {
    return `Only http: protocol is allowed for attachUrl, got "${url.protocol}"`
  }

  if (url.username || url.password) {
    return `Credentials are not allowed in attachUrl`
  }

  // DS-3: Strict hostname check. Node.js URL parser normalizes hex/octal
  // IP representations (e.g., 0x7f000001 → 127.0.0.1). We must reject
  // these by verifying the ORIGINAL hostname in the URL string matches
  // one of the allowed hostnames exactly.
  if (!ALLOWED_HOSTNAMES.has(url.hostname)) {
    return `Hostname must be localhost, 127.0.0.1, or [::1], got "${url.hostname}"`
  }

  // Detect encoded/octal/hex IP representations that Node.js normalizes.
  // e.g., http://0x7f000001:8080 normalizes to hostname 127.0.0.1.
  // We verify the original URL string contains the literal allowed hostname
  // after the "http://" prefix.
  const afterProtocol = urlStr.slice('http://'.length)
  const hasLiteralHost = ALLOWED_HOST_PREFIXES.some(prefix => afterProtocol.startsWith(prefix))
  if (!hasLiteralHost) {
    return `Hostname uses an encoded representation not allowed by DS-3: "${urlStr}"`
  }

  return null
}

// ---------------------------------------------------------------------------
// createOpenCodeDriver
// ---------------------------------------------------------------------------

export function createOpenCodeDriver(emitter: SwarmEventEmitter): Driver {
  const name = 'opencode' as const

  async function invoke(request: AgentRequest): Promise<AgentResult> {
    const startTime = Date.now()
    const backend = name
    const model = request.model

    // Pre-aborted signal check
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

    // DS-2: Context file containment
    if (request.contextFiles && request.contextFiles.length > 0) {
      const contextError = validateContextFiles(request.contextFiles, request.projectDir)
      if (contextError) {
        return {
          success: false,
          errorCode: 'spawn_error',
          error: contextError,
          rawOutput: '',
          stderr: '',
          model,
          backend,
          durationMs: Date.now() - startTime,
        }
      }
    }

    // DS-3: Attach URL validation
    if (request.attachUrl) {
      const urlError = validateAttachUrl(request.attachUrl)
      if (urlError) {
        return {
          success: false,
          errorCode: 'spawn_error',
          error: urlError,
          rawOutput: '',
          stderr: '',
          model,
          backend,
          durationMs: Date.now() - startTime,
        }
      }
    }

    // Build command args
    const args: string[] = [
      'run',
      '--format', 'json',
      '--model', String(request.model),
    ]

    // Context files
    if (request.contextFiles) {
      for (const filePath of request.contextFiles) {
        const canonical = fs.realpathSync(filePath)
        args.push('--file', canonical)
      }
    }

    // Attach URL
    if (request.attachUrl) {
      args.push('--attach', request.attachUrl)
    }

    // Emit agent:invoke event
    emitter.emit({
      type: 'agent:invoke',
      timestamp: new Date().toISOString(),
      sessionId: 'driver' as SessionId,
      data: { role: request.role, backend, model: String(model) },
    })

    return new Promise<AgentResult>((resolve) => {
      let proc: childProcess.ChildProcess
      try {
        proc = childProcess.spawn('opencode', args, {
          detached: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (err) {
        const durationMs = Date.now() - startTime
        emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: 'driver' as SessionId,
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

      // Pipe prompt via stdin
      const promptContent = request.schema
        ? request.prompt + JSON_DIRECTIVE
        : request.prompt
      proc.stdin!.write(promptContent)
      proc.stdin!.end()

      // Collect stdout/stderr
      let stdoutBuf = ''
      let stderrBuf = ''
      let killStarted = false
      let errorCode: 'timeout' | 'aborted' | 'crash' = 'crash'
      let killTimer: ReturnType<typeof setTimeout> | undefined
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined
      let resolved = false

      const doResolve = (result: AgentResult): void => {
        if (resolved) return
        resolved = true
        if (timeoutTimer) clearTimeout(timeoutTimer)
        if (killTimer) clearTimeout(killTimer)
        if (request.signal) {
          try {
            request.signal.removeEventListener('abort', onAbort)
          } catch {
            // Ignore if already removed
          }
        }
        resolve(result)
      }

      const startKillSequence = (code: 'timeout' | 'aborted'): void => {
        if (killStarted) return
        killStarted = true
        errorCode = code

        if (proc.pid !== undefined) {
          try { proc.stdin!.destroy() } catch { /* already closed */ }

          safeKill(proc.pid, 'SIGTERM')

          killTimer = setTimeout(() => {
            if (proc.pid !== undefined) {
              safeKill(proc.pid, 'SIGKILL')
            }
          }, KILL_GRACE_MS)
        }
      }

      // Timeout handling
      const timeout = request.timeout ?? DEFAULT_TIMEOUT
      timeoutTimer = setTimeout(() => {
        startKillSequence('timeout')
      }, timeout)

      // AbortSignal handling
      const onAbort = (): void => {
        startKillSequence('aborted')
      }

      if (request.signal) {
        request.signal.addEventListener('abort', onAbort, { once: true })
      }

      proc.stdout!.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString()
      })

      proc.stderr!.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString()
      })

      proc.on('error', (err: Error) => {
        const durationMs = Date.now() - startTime
        emitter.emit({
          type: 'agent:error',
          timestamp: new Date().toISOString(),
          sessionId: 'driver' as SessionId,
          data: { role: request.role, reason: err.message },
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
        })
      })

      proc.on('close', (exitCode: number | null) => {
        const durationMs = Date.now() - startTime

        if (killStarted) {
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: 'driver' as SessionId,
            data: { role: request.role, reason: `Process ${errorCode}` },
          })
          doResolve({
            success: false,
            errorCode,
            error: `Process ${errorCode} after ${durationMs}ms`,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
          })
          return
        }

        if (exitCode !== 0 && exitCode !== null) {
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: 'driver' as SessionId,
            data: { role: request.role, reason: `Process exited with code ${exitCode}` },
          })
          doResolve({
            success: false,
            errorCode: 'crash',
            error: `Process exited with code ${exitCode}`,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
          })
          return
        }

        if (stdoutBuf.trim() === '') {
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: 'driver' as SessionId,
            data: { role: request.role, reason: 'Empty output from backend' },
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
          })
          return
        }

        const parsed = parseStructuredOutput(stdoutBuf)

        if (parsed.ok) {
          emitter.emit({
            type: 'agent:result',
            timestamp: new Date().toISOString(),
            sessionId: 'driver' as SessionId,
            data: { role: request.role, durationMs },
          })
          doResolve({
            success: true,
            output: parsed.output,
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
          })
        } else {
          emitter.emit({
            type: 'agent:error',
            timestamp: new Date().toISOString(),
            sessionId: 'driver' as SessionId,
            data: { role: request.role, reason: 'Failed to parse output' },
          })
          doResolve({
            success: false,
            errorCode: 'invalid_json',
            error: 'Failed to parse structured output from backend',
            rawOutput: truncate(stdoutBuf, MAX_RAW_OUTPUT),
            stderr: truncate(stderrBuf, MAX_STDERR),
            model,
            backend,
            durationMs,
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

      const proc = childProcess.spawn('opencode', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      timeoutTimer = setTimeout(() => {
        try { proc.kill('SIGTERM') } catch { /* ignore */ }
        doResolve({ available: false, error: 'opencode --version timed out' })
      }, AVAILABILITY_TIMEOUT)

      proc.stdout!.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString()
      })

      proc.on('error', (err: Error) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          doResolve({ available: false, error: 'opencode not found in PATH' })
        } else {
          doResolve({ available: false, error: err.message })
        }
      })

      proc.on('close', () => {
        const version = stdoutBuf.trim()
        if (version.length > 0) {
          doResolve({ available: true, version })
        } else {
          doResolve({ available: false, error: 'opencode --version produced no output' })
        }
      })
    })
  }

  return { name, invoke, checkAvailability }
}
