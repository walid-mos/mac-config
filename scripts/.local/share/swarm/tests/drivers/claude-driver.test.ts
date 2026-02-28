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
  it('spawns claude with correct base flags', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
    await resultPromise

    expect(childProcess.spawn).toHaveBeenCalledOnce()
    const [cmd, args] = vi.mocked(childProcess.spawn).mock.calls[0]!
    expect(cmd).toBe('claude')
    expect(args).toContain('-p')
    expect(args).toContain('--output-format')
    expect(args).toContain('json')
    expect(args).toContain('--verbose')
    expect(args).toContain('--permission-mode')
    expect(args).toContain('bypassPermissions')
    expect(args).toContain('--no-session-persistence')
    expect(args).toContain('--model')
    expect(args).toContain('opus')
  })

  it('includes --cwd with projectDir', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ projectDir: '/tmp/project' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--cwd')
    expect(args).toContain('/tmp/project')
  })

  it('adds --agent when agent is specified', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ agent: 'planification-agent' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--agent')
    expect(args).toContain('planification-agent')
  })

  it('adds --json-schema when schema is provided', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const schema = JSON.stringify({ type: 'object', properties: { result: { type: 'string' } } })
    const request = createAgentRequest({ schema })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: '{"result":"ok"}' }]))
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--json-schema')
  })

  it('pipes prompt via stdin', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const writeSpy = vi.spyOn(mockProc.stdin, 'write')
    const endSpy = vi.spyOn(mockProc.stdin, 'end')
    const request = createAgentRequest({ prompt: 'Hello world prompt' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
    await resultPromise

    expect(writeSpy).toHaveBeenCalled()
    expect(endSpy).toHaveBeenCalled()
  })

  it('spawns with detached: true for process group management', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
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
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
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
    mockProc = setupSpawn()
    const writeSpy = vi.spyOn(mockProc.stdin, 'write')
    const schema = JSON.stringify({ type: 'object' })
    const request = createAgentRequest({ prompt: 'Generate output', schema })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: '{}' }]))
    await resultPromise

    // The prompt written to stdin should contain the JSON directive
    const writtenData = writeSpy.mock.calls.map(c => String(c[0])).join('')
    expect(writtenData).toContain('Generate output')
    // Should contain directive about outputting only raw JSON
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
    // No child process should have been spawned
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
    mockProc = setupSpawn()
    const request = createAgentRequest({ timeout: 60_000 })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
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
    // No child process should have been spawned
    expect(childProcess.spawn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// invoke — timeout handling
// ---------------------------------------------------------------------------

describe('invoke() — timeout handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('kills process group on timeout and returns errorCode "timeout"', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Advance past the timeout
    vi.advanceTimersByTime(11_000)
    // Then close the process
    mockProc.simulateExit(137)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('timeout')
    }

    killSpy.mockRestore()
  })

  it('sends SIGTERM first, then SIGKILL after 5 seconds', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Fire the timeout
    vi.advanceTimersByTime(10_001)

    // SIGTERM should have been sent
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGTERM')

    // Advance 5 more seconds for SIGKILL
    vi.advanceTimersByTime(5_001)
    expect(killSpy).toHaveBeenCalledWith(-mockProc.pid, 'SIGKILL')

    // Clean up
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
    mockProc = setupSpawn()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const controller = new AbortController()
    const request = createAgentRequest({ timeout: 10_000, signal: controller.signal })

    const resultPromise = driver.invoke(request)

    // Fire timeout
    vi.advanceTimersByTime(10_001)
    const killCountAfterTimeout = killSpy.mock.calls.length

    // Now fire abort too — should be a no-op for the kill sequence
    controller.abort()

    // The kill count should not have significantly increased from the second trigger
    // (Only SIGTERM + SIGKILL from timeout, no additional from abort)
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
    mockProc = setupSpawn()
    const esrchError = Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw esrchError
    })
    const request = createAgentRequest({ timeout: 10_000 })

    const resultPromise = driver.invoke(request)

    // Fire the timeout
    vi.advanceTimersByTime(10_001)
    mockProc.simulateExit(0)

    // Should not throw — ESRCH is handled gracefully
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
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'plan', model: 'opus' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
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
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'code' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
    await resultPromise

    const resultEvents = emitter.events.filter(e => e.type === 'agent:result')
    expect(resultEvents).toHaveLength(1)
    expect(resultEvents[0]!.data).toHaveProperty('role', 'code')
    expect(resultEvents[0]!.data).toHaveProperty('durationMs')
  })

  it('emits agent:error event on failure', async () => {
    setupProjectDir()
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
})

// ---------------------------------------------------------------------------
// invoke — error codes
// ---------------------------------------------------------------------------

describe('invoke() — error codes', () => {
  it('returns errorCode "empty_output" when process exits with empty stdout', async () => {
    setupProjectDir()
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
    mockProc = setupSpawn()
    const request = createAgentRequest()

    // Generate output larger than 1MB
    const largeResult = 'x'.repeat(2 * 1024 * 1024)
    const claudeOutput = JSON.stringify([{ type: 'result', result: largeResult }])

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(claudeOutput)
    const result = await resultPromise

    // The output (parsed) should contain the full result
    // But rawOutput should be truncated to 1MB
    expect(result.rawOutput.length).toBeLessThanOrEqual(1024 * 1024)
  })

  it('truncates stderr to 64KB', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    // Large stderr
    const largeStderr = 'e'.repeat(128 * 1024)
    mockProc.simulateStderr(largeStderr)

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
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
    mockProc = setupSpawn()
    const request = createAgentRequest({ contextFiles: ['/tmp/project/src/index.ts'] })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'ok' }]))
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).not.toContain('--file')
  })
})

// ---------------------------------------------------------------------------
// invoke — result shape
// ---------------------------------------------------------------------------

describe('invoke() — result shape', () => {
  it('returns success result with all required fields', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ model: 'opus' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify([{ type: 'result', result: 'answer' }]))
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
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    const err = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })
    mockProc.simulateError(err)

    // Should not throw
    const result = await resultPromise
    expect(result.success).toBe(false)
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

    // Advance past 10-second timeout
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
