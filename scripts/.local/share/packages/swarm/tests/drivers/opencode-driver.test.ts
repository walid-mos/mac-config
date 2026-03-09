import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import { createOpenCodeDriver } from '../../src/drivers/opencode-driver.js'
import type { Driver } from '../../src/drivers/driver.js'
import type { ModelId } from '../../src/core/types.js'
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
  driver = createOpenCodeDriver(emitter)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createOpenCodeDriver', () => {
  it('returns a Driver with name="opencode"', () => {
    expect(driver.name).toBe('opencode')
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
  it('spawns opencode with correct base flags', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ model: 'openai/gpt-5.3-codex' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    await resultPromise

    expect(childProcess.spawn).toHaveBeenCalledOnce()
    const [cmd, args] = vi.mocked(childProcess.spawn).mock.calls[0]!
    expect(cmd).toBe('opencode')
    expect(args).toContain('run')
    expect(args).toContain('--format')
    expect(args).toContain('json')
    expect(args).toContain('--model')
    expect(args).toContain('openai/gpt-5.3-codex')
  })

  it('adds --file for each contextFile', async () => {
    setupProjectDir()
    // Mock realpathSync to return the path as-is (under projectDir)
    vi.spyOn(fs, 'realpathSync').mockImplementation((p) => String(p))
    mockProc = setupSpawn()
    const request = createAgentRequest({
      contextFiles: ['/tmp/project/src/main.ts', '/tmp/project/src/utils.ts'],
    })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    // Should have --file for each context file
    const fileFlags = args!.filter((a, i) => a === '--file')
    expect(fileFlags.length).toBe(2)
  })

  it('adds --attach for attachUrl', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ attachUrl: 'http://localhost:8080' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    await resultPromise

    const args = vi.mocked(childProcess.spawn).mock.calls[0]![1]!
    expect(args).toContain('--attach')
    expect(args).toContain('http://localhost:8080')
  })

  it('spawns with detached: true for process group management', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    await resultPromise

    const spawnOpts = vi.mocked(childProcess.spawn).mock.calls[0]![2]!
    expect(spawnOpts).toHaveProperty('detached', true)
  })
})

// ---------------------------------------------------------------------------
// invoke — contextFiles validation (DS-2)
// ---------------------------------------------------------------------------

describe('invoke() — contextFiles path validation (DS-2)', () => {
  it('rejects contextFiles outside projectDir (path traversal)', async () => {
    setupProjectDir()
    vi.spyOn(fs, 'realpathSync').mockImplementation((p) => String(p))
    const request = createAgentRequest({
      contextFiles: ['/etc/passwd'],
    })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
    expect(childProcess.spawn).not.toHaveBeenCalled()
  })

  it('rejects symlink that resolves outside projectDir', async () => {
    setupProjectDir()
    vi.spyOn(fs, 'realpathSync').mockImplementation(() => '/outside/project/secret.txt')
    const request = createAgentRequest({
      contextFiles: ['/tmp/project/sneaky-link'],
    })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('accepts contextFiles canonicalized under projectDir', async () => {
    setupProjectDir()
    vi.spyOn(fs, 'realpathSync').mockImplementation((p) => String(p))
    mockProc = setupSpawn()
    const request = createAgentRequest({
      contextFiles: ['/tmp/project/src/index.ts'],
    })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    const result = await resultPromise

    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// invoke — attachUrl validation (DS-3)
// ---------------------------------------------------------------------------

describe('invoke() — attachUrl validation (DS-3)', () => {
  it('accepts http://localhost:<port>', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ attachUrl: 'http://localhost:3000' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    const result = await resultPromise

    expect(result.success).toBe(true)
  })

  it('accepts http://127.0.0.1:<port>', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ attachUrl: 'http://127.0.0.1:8080' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    const result = await resultPromise

    expect(result.success).toBe(true)
  })

  it('accepts http://[::1]:<port>', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ attachUrl: 'http://[::1]:8080' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    const result = await resultPromise

    expect(result.success).toBe(true)
  })

  it('rejects https:// URLs (only http: allowed)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ attachUrl: 'https://localhost:3000' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects external hostname (SSRF prevention)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ attachUrl: 'http://evil.com:8080' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects URL with credentials (credential smuggling)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ attachUrl: 'http://user:pass@localhost:8080' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects URL with only username (no password)', async () => {
    setupProjectDir()
    const request = createAgentRequest({ attachUrl: 'http://user@localhost:8080' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects encoded/octal/hex IP representations', async () => {
    setupProjectDir()
    // 0x7f000001 = 127.0.0.1 in hex
    const request = createAgentRequest({ attachUrl: 'http://0x7f000001:8080' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects invalid URL', async () => {
    setupProjectDir()
    const request = createAgentRequest({ attachUrl: 'not-a-url' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })
})

// ---------------------------------------------------------------------------
// invoke — input validation (shared with Claude)
// ---------------------------------------------------------------------------

describe('invoke() — input validation', () => {
  it('rejects invalid model', async () => {
    setupProjectDir()
    const request = createAgentRequest({ model: 'bad model!!' as ModelId })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects invalid agent name', async () => {
    setupProjectDir()
    const request = createAgentRequest({ agent: 'agent with spaces' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects invalid schema', async () => {
    setupProjectDir()
    const request = createAgentRequest({ schema: '{invalid json' })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects timeout below 10_000ms', async () => {
    setupProjectDir()
    const request = createAgentRequest({ timeout: 1_000 })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects timeout above 3_600_000ms', async () => {
    setupProjectDir()
    const request = createAgentRequest({ timeout: 10_000_000 })

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })

  it('rejects projectDir that is not a directory', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false } as fs.Stats)
    const request = createAgentRequest()

    const result = await driver.invoke(request)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })
})

// ---------------------------------------------------------------------------
// invoke — abort handling
// ---------------------------------------------------------------------------

describe('invoke() — abort handling', () => {
  it('returns errorCode "aborted" for pre-aborted signal', async () => {
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

    vi.advanceTimersByTime(11_000)
    mockProc.simulateExit(137)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('timeout')
    }

    killSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// invoke — event emission
// ---------------------------------------------------------------------------

describe('invoke() — event emission', () => {
  it('emits agent:invoke event when invocation starts', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'code', model: 'openai/gpt-5.3-codex' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    await resultPromise

    const invokeEvents = emitter.events.filter(e => e.type === 'agent:invoke')
    expect(invokeEvents).toHaveLength(1)
    expect(invokeEvents[0]!.data).toMatchObject({
      role: 'code',
      backend: 'opencode',
    })
  })

  it('emits agent:result event on success', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'docs' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'documentation' }))
    await resultPromise

    const resultEvents = emitter.events.filter(e => e.type === 'agent:result')
    expect(resultEvents).toHaveLength(1)
    expect(resultEvents[0]!.data).toHaveProperty('role', 'docs')
  })

  it('emits agent:error event on failure', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ role: 'security' })

    const resultPromise = driver.invoke(request)
    mockProc.simulateExit(1)
    await resultPromise

    const errorEvents = emitter.events.filter(e => e.type === 'agent:error')
    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0]!.data).toHaveProperty('role', 'security')
  })
})

// ---------------------------------------------------------------------------
// invoke — error codes
// ---------------------------------------------------------------------------

describe('invoke() — error codes', () => {
  it('returns errorCode "empty_output" for empty stdout', async () => {
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

  it('returns errorCode "crash" on non-zero exit', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    mockProc.simulateStderr('Error occurred')
    mockProc.simulateExit(1)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('crash')
    }
  })

  it('returns errorCode "spawn_error" on ENOENT', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    const err = Object.assign(new Error('spawn opencode ENOENT'), { code: 'ENOENT' })
    mockProc.simulateError(err)
    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('spawn_error')
    }
  })
})

// ---------------------------------------------------------------------------
// invoke — result shape
// ---------------------------------------------------------------------------

describe('invoke() — result shape', () => {
  it('returns success result with backend="opencode"', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest({ model: 'openai/gpt-5.3' as ModelId })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'answer' }))
    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.backend).toBe('opencode')
      expect(result.model).toBe('openai/gpt-5.3')
      expect(typeof result.durationMs).toBe('number')
    }
  })

  it('never rejects the promise', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const resultPromise = driver.invoke(request)
    const err = Object.assign(new Error('spawn opencode ENOENT'), { code: 'ENOENT' })
    mockProc.simulateError(err)

    const result = await resultPromise
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// invoke — output truncation
// ---------------------------------------------------------------------------

describe('invoke() — output truncation', () => {
  it('truncates rawOutput to 1MB', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    const largeResult = 'x'.repeat(2 * 1024 * 1024)
    const output = JSON.stringify({ result: largeResult })

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(output)
    const result = await resultPromise

    expect(result.rawOutput.length).toBeLessThanOrEqual(1024 * 1024)
  })

  it('truncates stderr to 64KB', async () => {
    setupProjectDir()
    mockProc = setupSpawn()
    const request = createAgentRequest()

    mockProc.simulateStderr('e'.repeat(128 * 1024))

    const resultPromise = driver.invoke(request)
    mockProc.simulateOutput(JSON.stringify({ result: 'ok' }))
    const result = await resultPromise

    expect(result.stderr.length).toBeLessThanOrEqual(64 * 1024)
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
    mockProc.simulateOutput('opencode v2.1.0\n')
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
    const err = Object.assign(new Error('spawn opencode ENOENT'), { code: 'ENOENT' })
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
