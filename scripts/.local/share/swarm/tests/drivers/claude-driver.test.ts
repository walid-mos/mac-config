import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import { createClaudeDriver } from '../../src/drivers/claude-driver.js'
import type { Driver, AgentRequest } from '../../src/drivers/driver.js'
import type { ModelId, SwarmEventEmitter } from '../../src/core/types.js'
import {
  createAgentRequest,
  createMockChildProcess,
  createMockEmitter,
  type MockChildProcess,
} from '../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Test-wide helpers
// ---------------------------------------------------------------------------

let emitter: ReturnType<typeof createMockEmitter>
let driver: Driver
let mockProc: MockChildProcess

function setupSpawn(proc?: MockChildProcess): MockChildProcess {
  const p = proc ?? createMockChildProcess()
  vi.spyOn(childProcess, 'spawn').mockReturnValue(p as unknown as childProcess.ChildProcess)
  return p
}

function setupProjectDir(dir = '/tmp/project'): void {
  vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats)
}

function setupLogFile(): void {
  vi.spyOn(fs, 'openSync').mockReturnValue(99)
  vi.spyOn(fs, 'writeSync').mockReturnValue(0)
  vi.spyOn(fs, 'closeSync').mockReturnValue(undefined)
}

/** Build NDJSON string from stream events */
function ndjson(...events: Record<string, unknown>[]): string {
  return events.map(e => JSON.stringify(e)).join('\n') + '\n'
}

/** Standard stream-json output with a result */
function streamResult(result: string): string {
  return ndjson(
    { type: 'system', subtype: 'init' },
    { type: 'result', subtype: 'success', result },
  )
}

beforeEach(() => {
  emitter = createMockEmitter()
  driver = createClaudeDriver(emitter)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createClaudeDriver', () => {
  it('returns a Driver with name="claude"', () => {
    expect(driver.name).toBe('claude')
  })

  it('returns an object with invoke and checkAvailability methods', () => {
    expect(typeof driver.invoke).toBe('function')
    expect(typeof driver.checkAvailability).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// invoke — command building
// ---------------------------------------------------------------------------

describe('invoke() — command building', () => {
  it('spawns claude with stream-json output format', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    expect(childProcess.spawn).toHaveBeenCalledOnce()
    const [cmd, args] = vi.mocked(childProcess.spawn).mock.calls[0]!
    expect(cmd).toBe('claude')
    expect(args).toContain('-p')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--verbose')
    expect(args).toContain('--permission-mode')
    expect(args).toContain('bypassPermissions')
    expect(args).toContain('--no-session-persistence')
    expect(args).toContain('--model')
    expect(args).toContain('opus')
  })

  it('sets cwd in spawn options to projectDir', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ projectDir: '/tmp/project' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const spawnOpts = vi.mocked(childProcess.spawn).mock.calls[0]![2]!
    expect(spawnOpts).toHaveProperty('cwd', '/tmp/project')
  })

  it('adds --agent when agent is specified', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ agent: 'planification-agent' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--agent')
    expect(args).toContain('planification-agent')
  })

  it('adds --json-schema when schema is provided', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const schema = JSON.stringify({ type: 'object', properties: { result: { type: 'string' } } })
    const request = createAgentRequest({ schema })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('{"result":"ok"}')
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--json-schema')
  })

  it('pipes prompt via stdin', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const writeSpy = vi.spyOn(mockProc.stdin, 'write')
    const endSpy = vi.spyOn(mockProc.stdin, 'end')
    const request = createAgentRequest({ prompt: 'Hello world prompt' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    expect(writeSpy).toHaveBeenCalled()
    expect(endSpy).toHaveBeenCalled()
  })

  it('spawns with detached: true for process group management', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const spawnOpts = vi.mocked(childProcess.spawn).mock.calls[0]![2]!
    expect(spawnOpts).toHaveProperty('detached', true)
  })
})

// ---------------------------------------------------------------------------
// invoke — environment sanitization
// ---------------------------------------------------------------------------

describe('invoke() — environment sanitization', () => {
  it('removes CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, and CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS from env', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const spawnOpts = vi.mocked(childProcess.spawn).mock.calls[0]![2]! as childProcess.SpawnOptions
    const env = spawnOpts.env as Record<string, string | undefined>
    expect(env).toBeDefined()
    expect(env['CLAUDECODE']).toBeUndefined()
    expect(env['CLAUDE_CODE_ENTRYPOINT']).toBeUndefined()
    expect(env['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// invoke — schema-enforced prompt
// ---------------------------------------------------------------------------

describe('invoke() — schema-enforced prompt', () => {
  it('appends JSON output directive to prompt when schema is provided', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const writeSpy = vi.spyOn(mockProc.stdin, 'write')
    const schema = JSON.stringify({ type: 'object' })
    const request = createAgentRequest({ prompt: 'Generate output', schema })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('{}')
    await resultPromise

    const writtenData = writeSpy.mock.calls.map(c => String(c[0])).join('')
    expect(writtenData).toContain('Generate output')
    expect(writtenData.toLowerCase()).toMatch(/json/i)
  })
})

// ---------------------------------------------------------------------------
// invoke — input validation
// ---------------------------------------------------------------------------

describe('invoke() — input validation', () => {
  it('rejects invalid model (does not match regex)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ model: 'invalid model!@#' as ModelId })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
    expect(childProcess.spawn).not.toHaveBeenCalled()
  })

  it('rejects invalid agent name (does not match regex)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ agent: 'agent with spaces!!' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects invalid schema (not valid JSON)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ schema: 'not json {{{' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects projectDir that is not a directory', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false } as fs.Stats)
    const request = createAgentRequest({ projectDir: '/tmp/not-a-directory' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects timeout below 10_000ms', async () => {
    setupProjectDir()
    const request = createAgentRequest({ timeout: 5_000 })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects timeout above 3_600_000ms', async () => {
    setupProjectDir()
    const request = createAgentRequest({ timeout: 5_000_000 })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('accepts timeout within valid range', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ timeout: 60_000 })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// invoke — pre-aborted AbortSignal
// ---------------------------------------------------------------------------

describe('invoke() — abort handling', () => {
  it('returns errorCode "aborted" immediately for pre-aborted signal', async () => {
    setupProjectDir()
    const controller = new AbortController()
    controller.abort()
    const request = createAgentRequest({ signal: controller.signal })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('aborted')
    }
    expect(childProcess.spawn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// invoke — idle timeout handling
// ---------------------------------------------------------------------------

describe('invoke() — idle timeout handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('kills process after API wait timeout with no assistant response', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)

    // Only system init — no assistant event, so we're in API wait phase (600s)
    mockProc.simulateStreamLine({ type: 'system', subtype: 'init' })

    // Advance past API wait timeout (600s)
    vi.advanceTimersByTime(601_000)
    mockProc.simulateExit(137)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('timeout')
    }

    killSpy.mockRestore()
  })

  it('kills process after idle timeout once agent is working', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Emit assistant event — enters phase 2 (idle timeout = 10s)
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'text', text: 'working' } })

    // Advance past idle timeout
    vi.advanceTimersByTime(11_000)
    mockProc.simulateExit(137)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('timeout')
    }

    killSpy.mockRestore()
  })

  it('resets idle timer when stdout data arrives', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // First assistant event — enters phase 2 (idle = 10s)
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'text', text: 'start' } })

    // Advance 8 seconds — still within timeout
    vi.advanceTimersByTime(8_000)
    expect(killSpy).not.toHaveBeenCalled()

    // Another stream line — resets the idle timer
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'text', text: 'thinking...' } })

    // Advance another 8 seconds from the reset point — still within 10s from last activity
    vi.advanceTimersByTime(8_000)
    expect(killSpy).not.toHaveBeenCalled()

    // Advance past the idle timeout from last activity
    vi.advanceTimersByTime(3_000)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGTERM')

    mockProc.simulateExit(137)
    await resultPromise

    killSpy.mockRestore()
  })

  it('resets idle timer when stderr data arrives', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Enter phase 2
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'text', text: 'start' } })

    // Advance 8 seconds
    vi.advanceTimersByTime(8_000)
    expect(killSpy).not.toHaveBeenCalled()

    // Stderr activity resets timer
    mockProc.simulateStderr('debug info\n')

    // Advance 8 more seconds — within timeout from stderr activity
    vi.advanceTimersByTime(8_000)
    expect(killSpy).not.toHaveBeenCalled()

    // Now timeout from last stderr activity
    vi.advanceTimersByTime(3_000)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGTERM')

    mockProc.simulateExit(137)
    await resultPromise

    killSpy.mockRestore()
  })

  it('uses model inference timeout (10 min) after tool_result while awaiting model response', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Agent starts working (assistant event) — enters idle timeout phase
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'tool_use', name: 'Read' } })
    // Tool result arrives — model is now generating next response (inference phase)
    mockProc.simulateStreamLine({ type: 'user', message: { content: [{ type: 'tool_result', content: 'file contents' }] } })

    // Advance 9 minutes — still within 10 min model inference timeout
    vi.advanceTimersByTime(9 * 60 * 1000)
    expect(killSpy).not.toHaveBeenCalled()

    // Advance past 10 min — should trigger timeout
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGTERM')

    mockProc.simulateExit(137)
    await resultPromise

    killSpy.mockRestore()
  })

  it('reverts to idle timeout after model responds following inference phase', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Agent working → tool_result → model inference phase
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'tool_use', name: 'Read' } })
    mockProc.simulateStreamLine({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } })

    // Model responds — back to idle timeout (10s custom)
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'tool_use', name: 'Write' } })

    // Advance past custom idle timeout (10s)
    vi.advanceTimersByTime(11_000)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGTERM')

    mockProc.simulateExit(137)
    await resultPromise

    killSpy.mockRestore()
  })

  it('sends SIGTERM first, then SIGKILL after 5 seconds', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Enter phase 2
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'text', text: 'start' } })

    // Fire the idle timeout
    vi.advanceTimersByTime(10_001)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGTERM')

    // Advance 5 more seconds for SIGKILL
    vi.advanceTimersByTime(5_001)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGKILL')

    mockProc.simulateExit(137)
    await resultPromise

    killSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// invoke — kill-guard flag
// ---------------------------------------------------------------------------

describe('invoke() — kill-guard flag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('only executes kill sequence once when timeout and abort race', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const controller = new AbortController()
    const request = createAgentRequest({ timeout: 10_000, signal: controller.signal })

    const resultPromise = driver.invoke(request)

    // Fire timeout
    vi.advanceTimersByTime(10_001)

    // Now fire abort too — should be a no-op for the kill sequence
    controller.abort()

    vi.advanceTimersByTime(6_000)
    mockProc.simulateExit(137)

    await resultPromise
    killSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// invoke — ESRCH handling
// ---------------------------------------------------------------------------

describe('invoke() — ESRCH handling on kill', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('handles ESRCH gracefully when process already exited', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const esrchError = Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw esrchError
    })
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    vi.advanceTimersByTime(10_001)
    mockProc.simulateExit(0)

    const result = await resultPromise
    expect(result).toBeDefined()

    vi.mocked(process.kill).mockRestore()
  })
})

// ---------------------------------------------------------------------------
// invoke — event emission
// ---------------------------------------------------------------------------

describe('invoke() — event emission', () => {
  it('emits agent:invoke event when invocation starts', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'plan', model: 'opus' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const invokeEvents = emitter.events.filter(e => e.type === 'agent:invoke')
    expect(invokeEvents).toHaveLength(1)
    expect(invokeEvents[0]!.data).toMatchObject({
      role: 'plan',
      backend: 'claude',
    })
  })

  it('emits agent:result event on success', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'code' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const resultEvents = emitter.events.filter(e => e.type === 'agent:result')
    expect(resultEvents).toHaveLength(1)
    expect(resultEvents[0]!.data).toHaveProperty('role', 'code')
    expect(resultEvents[0]!.data).toHaveProperty('durationMs')
  })

  it('emits agent:error event on failure', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'test' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateExit(1)
    await resultPromise

    const errorEvents = emitter.events.filter(e => e.type === 'agent:error')
    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0]!.data).toHaveProperty('role', 'test')
    expect(errorEvents[0]!.data).toHaveProperty('reason')
  })

  it('emits agent:activity event for tool_use messages', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'code' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'tool_use', name: 'Read' } })
    mockProc.simulateStreamLine({ type: 'assistant', message: { type: 'tool_use', name: 'Edit' } })
    mockProc.simulateStreamOutput('done')
    await resultPromise

    const activityEvents = emitter.events.filter(e => e.type === 'agent:activity')
    expect(activityEvents).toHaveLength(2)
    expect(activityEvents[0]!.data).toMatchObject({ role: 'code', tool: 'Read' })
    expect(activityEvents[1]!.data).toMatchObject({ role: 'code', tool: 'Edit' })
  })
})

// ---------------------------------------------------------------------------
// invoke — NDJSON stream parsing
// ---------------------------------------------------------------------------

describe('invoke() — stream-json parsing', () => {
  it('extracts result from NDJSON stream', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(ndjson(
      { type: 'system', subtype: 'init' },
      { type: 'assistant', message: { type: 'text', text: 'Working on it...' } },
      { type: 'result', subtype: 'success', result: 'The final answer' },
    ))
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output).toBe('The final answer')
    }
  })

  it('extracts JSON result from NDJSON stream', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(ndjson(
      { type: 'system', subtype: 'init' },
      { type: 'result', subtype: 'success', result: '{"tasks": [{"id": 1}]}' },
    ))
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output).toBe('{"tasks": [{"id": 1}]}')
    }
  })

  it('returns invalid_json when stream has no result event', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(ndjson(
      { type: 'system', subtype: 'init' },
      { type: 'assistant', message: { type: 'text', text: 'no result here' } },
    ))
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('invalid_json')
    }
  })

  it('handles non-string result (object) by stringifying', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(ndjson(
      { type: 'result', result: { key: 'value' } },
    ))
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(JSON.parse(result.output)).toEqual({ key: 'value' })
    }
  })
})

// ---------------------------------------------------------------------------
// invoke — error codes
// ---------------------------------------------------------------------------

describe('invoke() — error codes', () => {
  it('returns errorCode "empty_output" when process exits with empty stdout', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput('', 0)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('empty_output')
    }
  })

  it('returns errorCode "crash" on non-zero exit code', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStderr('Segfault')
    mockProc.simulateExit(139)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('crash')
      expect(result.stderr).toContain('Segfault')
    }
  })

  it('returns errorCode "spawn_error" on ENOENT (binary not found)', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    const err = Object.assign(new Error('spawn claude ENOENT'), {
      code: 'ENOENT',
      errno: -2,
      syscall: 'spawn claude',
    })
    mockProc.simulateError(err)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })
})

// ---------------------------------------------------------------------------
// invoke — output truncation
// ---------------------------------------------------------------------------

describe('invoke() — output truncation', () => {
  it('truncates rawOutput to 1MB AFTER parsing', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const largeResult = 'x'.repeat(2 * 1024 * 1024)
    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(ndjson(
      { type: 'result', result: largeResult },
    ))
    const result = await resultPromise

    expect(result.rawOutput.length).toBeLessThanOrEqual(1024 * 1024)
  })

  it('truncates stderr to 64KB', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const largeStderr = 'e'.repeat(128 * 1024)
    mockProc.simulateStderr(largeStderr)

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.stderr.length).toBeLessThanOrEqual(64 * 1024)
  })
})

// ---------------------------------------------------------------------------
// invoke — contextFiles ignored
// ---------------------------------------------------------------------------

describe('invoke() — contextFiles', () => {
  it('ignores contextFiles (Claude does not support --file)', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ contextFiles: ['/tmp/project/src/index.ts'] })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).not.toContain('--file')
  })
})

// ---------------------------------------------------------------------------
// invoke — session persistence flags
// ---------------------------------------------------------------------------

describe('invoke() — session persistence flags', () => {
  it('uses --session-id and omits --no-session-persistence when sessionId is set', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ sessionId: '550e8400-e29b-41d4-a716-446655440000' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--session-id')
    expect(args).toContain('550e8400-e29b-41d4-a716-446655440000')
    expect(args).not.toContain('--no-session-persistence')
  })

  it('uses --resume and omits --no-session-persistence when resume is set', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ resume: '550e8400-e29b-41d4-a716-446655440000' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--resume')
    expect(args).toContain('550e8400-e29b-41d4-a716-446655440000')
    expect(args).not.toContain('--no-session-persistence')
    expect(args).not.toContain('--session-id')
  })

  it('uses --no-session-persistence when neither sessionId nor resume is set', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--no-session-persistence')
    expect(args).not.toContain('--session-id')
    expect(args).not.toContain('--resume')
  })

  it('rejects when both sessionId and resume are set (mutual exclusion)', async () => {
    setupProjectDir()
    const request = createAgentRequest({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      resume: '660e8400-e29b-41d4-a716-446655440001',
    })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
      expect(result.error).toContain('mutually exclusive')
    }
    expect(childProcess.spawn).not.toHaveBeenCalled()
  })

  it('rejects invalid sessionId (not UUID format)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ sessionId: 'not-a-uuid' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
      expect(result.error).toContain('Invalid sessionId')
    }
  })

  it('rejects invalid resume (not UUID format)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ resume: 'not-a-uuid' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
      expect(result.error).toContain('Invalid resume')
    }
  })

  it('echoes sessionId in success result when sessionId is set', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const request = createAgentRequest({ sessionId: uuid })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.sessionId).toBe(uuid)
    }
  })

  it('echoes sessionId in success result when resume is set', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const request = createAgentRequest({ resume: uuid })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.sessionId).toBe(uuid)
    }
  })

  it('does not include sessionId in success result when neither is set', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.sessionId).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// invoke — result shape
// ---------------------------------------------------------------------------

describe('invoke() — result shape', () => {
  it('returns success result with all required fields', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ model: 'opus' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('answer')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output).toBe('answer')
      expect(typeof result.rawOutput).toBe('string')
      expect(typeof result.stderr).toBe('string')
      expect(result.model).toBe('opus')
      expect(result.backend).toBe('claude')
      expect(typeof result.durationMs).toBe('number')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns error result with all required fields', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ model: 'opus' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateExit(1)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.errorCode).toBe('string')
      expect(typeof result.error).toBe('string')
      expect(typeof result.rawOutput).toBe('string')
      expect(typeof result.stderr).toBe('string')
      expect(result.model).toBe('opus')
      expect(result.backend).toBe('claude')
      expect(typeof result.durationMs).toBe('number')
    }
  })

  it('never rejects the promise — errors are encoded in result', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    const err = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })
    mockProc.simulateError(err)

    const result = await resultPromise
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// invoke — log file
// ---------------------------------------------------------------------------

describe('invoke() — log file', () => {
  it('opens a log file for NDJSON stream', async () => {
    setupProjectDir()
    const openSpy = vi.spyOn(fs, 'openSync').mockReturnValue(99)
    vi.spyOn(fs, 'writeSync').mockReturnValue(0)
    vi.spyOn(fs, 'closeSync').mockReturnValue(undefined)
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'code' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    await resultPromise

    expect(openSpy).toHaveBeenCalledOnce()
    const logPath = openSpy.mock.calls[0]![0] as string
    expect(logPath).toMatch(/swarm-agent-code-\d+\.ndjson$/)
  })

  it('proceeds without logging if log file cannot be opened', async () => {
    setupProjectDir()
    vi.spyOn(fs, 'openSync').mockImplementation(() => { throw new Error('EACCES') })
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkAvailability
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// invoke — token usage accumulation
// ---------------------------------------------------------------------------

describe('invoke() — token usage accumulation', () => {
  it('accumulates token usage across multiple assistant events', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamLine({
      type: 'assistant',
      message: { type: 'text', text: 'thinking', usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200, cache_read_input_tokens: 1000 } },
    })
    mockProc.simulateStreamLine({
      type: 'assistant',
      message: { type: 'tool_use', name: 'Read', usage: { input_tokens: 150, output_tokens: 30, cache_creation_input_tokens: 0, cache_read_input_tokens: 500 } },
    })
    mockProc.simulateStreamOutput('done')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tokenUsage).toEqual({
        input: 250,
        output: 80,
        cacheCreation: 200,
        cacheRead: 1500,
      })
    }
  })

  it('includes tokenUsage on error results', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamLine({
      type: 'assistant',
      message: { type: 'text', text: 'working', usage: { input_tokens: 300, output_tokens: 100, cache_creation_input_tokens: 50, cache_read_input_tokens: 2000 } },
    })
    mockProc.simulateExit(1)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.tokenUsage).toEqual({
        input: 300,
        output: 100,
        cacheCreation: 50,
        cacheRead: 2000,
      })
    }
  })

  it('returns zero token counts when no usage data in stream', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamOutput('ok')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tokenUsage).toEqual({
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
      })
    }
  })

  it('emits tokenUsage in agent:result event', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'code' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamLine({
      type: 'assistant',
      message: { type: 'text', text: 'working', usage: { input_tokens: 500, output_tokens: 200, cache_creation_input_tokens: 100, cache_read_input_tokens: 3000 } },
    })
    mockProc.simulateStreamOutput('done')
    await resultPromise

    const resultEvents = emitter.events.filter(e => e.type === 'agent:result')
    expect(resultEvents).toHaveLength(1)
    expect(resultEvents[0]!.data).toHaveProperty('tokenUsage')
    expect((resultEvents[0]!.data as { tokenUsage: unknown }).tokenUsage).toEqual({
      input: 500,
      output: 200,
      cacheCreation: 100,
      cacheRead: 3000,
    })
  })

  it('emits tokenUsage in agent:error event', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'test' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamLine({
      type: 'assistant',
      message: { type: 'text', text: 'working', usage: { input_tokens: 100, output_tokens: 20 } },
    })
    mockProc.simulateExit(1)
    await resultPromise

    const errorEvents = emitter.events.filter(e => e.type === 'agent:error')
    expect(errorEvents).toHaveLength(1)
    expect((errorEvents[0]!.data as { tokenUsage: unknown }).tokenUsage).toEqual({
      input: 100,
      output: 20,
      cacheCreation: 0,
      cacheRead: 0,
    })
  })

  it('handles partial usage fields (missing cache fields)', async () => {
    setupProjectDir()
    setupLogFile()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStreamLine({
      type: 'assistant',
      message: { type: 'text', text: 'working', usage: { input_tokens: 400, output_tokens: 150 } },
    })
    mockProc.simulateStreamOutput('done')
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tokenUsage).toEqual({
        input: 400,
        output: 150,
        cacheCreation: 0,
        cacheRead: 0,
      })
    }
  })
})

// ---------------------------------------------------------------------------
// checkAvailability
// ---------------------------------------------------------------------------

describe('checkAvailability()', () => {
  it('returns available: true with version when binary is found', async () => {
    mockProc = createMockChildProcess()
    vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc as unknown as childProcess.ChildProcess)

    const availPromise = driver.checkAvailability()
    mockProc.simulateOutput('claude v1.0.42\n')
    const result = await availPromise

    expect(result.available).toBe(true)
    if (result.available) {
      expect(typeof result.version).toBe('string')
      expect(result.version.length).toBeGreaterThan(0)
    }
  })

  it('returns available: false when binary is not found', async () => {
    mockProc = createMockChildProcess()
    vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc as unknown as childProcess.ChildProcess)

    const availPromise = driver.checkAvailability()
    const err = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })
    mockProc.simulateError(err)
    const result = await availPromise

    expect(result.available).toBe(false)
    if (!result.available) {
      expect(result.error).toContain('not found')
    }
  })

  it('returns available: false with timeout message when version command exceeds 10s', async () => {
    vi.useFakeTimers()
    mockProc = createMockChildProcess()
    vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc as unknown as childProcess.ChildProcess)

    const availPromise = driver.checkAvailability()

    vi.advanceTimersByTime(11_000)
    mockProc.simulateExit(137)

    const result = await availPromise

    expect(result.available).toBe(false)
    if (!result.available) {
      expect(result.error).toContain('timed out')
    }

    vi.useRealTimers()
  })
})
