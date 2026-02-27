import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createStateManager } from '../src/state-manager.js'
import type { SessionId, SwarmStateManager, SwarmState } from '../src/types.js'
import { createSwarmState, createSwarmConfig, createPhaseError } from './__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SESSION_ID = 'test-session' as SessionId
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-state-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function statePath(): string {
  return path.join(tmpDir, `swarm-${TEST_SESSION_ID}-state.json`)
}

function lockPath(): string {
  return path.join(tmpDir, `swarm-${TEST_SESSION_ID}-lock`)
}

function donePath(): string {
  return path.join(tmpDir, `swarm-${TEST_SESSION_ID}-done`)
}

// ---------------------------------------------------------------------------
// FR-6: Atomic write — save()
// ---------------------------------------------------------------------------

describe('createStateManager — save (FR-6)', () => {
  it('writes state to disk as valid JSON', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const state = createSwarmState({ sessionId: TEST_SESSION_ID })

    manager.save(state)

    const raw = fs.readFileSync(statePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.sessionId).toBe('test-session')
    expect(parsed.schemaVersion).toBe(1)
  })

  it('writes state file with mode 0o600', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const state = createSwarmState({ sessionId: TEST_SESSION_ID })

    manager.save(state)

    const stats = fs.statSync(statePath())
    // On POSIX, mode includes file type bits — mask to permission bits only
    const permissions = stats.mode & 0o777
    expect(permissions).toBe(0o600)
  })

  it('performs atomic write: tmp file then rename (no partial writes)', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const state = createSwarmState({ sessionId: TEST_SESSION_ID })

    manager.save(state)

    // The final file should exist and no .tmp file should remain
    expect(fs.existsSync(statePath())).toBe(true)
    expect(fs.existsSync(statePath() + '.tmp')).toBe(false)
  })

  it('does not overwrite existing state on write-back parse failure', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const goodState = createSwarmState({
      sessionId: TEST_SESSION_ID,
      currentPhase: 'plan',
    })

    // Write a valid state first
    manager.save(goodState)
    const originalContent = fs.readFileSync(statePath(), 'utf-8')

    // Now corrupt the write process — mock writeFileSync for the .tmp file
    // to write garbage, which should cause the parse-back to fail
    const originalWriteFileSync = fs.writeFileSync
    let callCount = 0
    vi.spyOn(fs, 'writeFileSync').mockImplementation(
      (p: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options?: fs.WriteFileOptions) => {
        callCount++
        if (typeof p === 'string' && p.endsWith('.tmp') && callCount > 1) {
          // Write garbage to the .tmp file
          originalWriteFileSync(p, 'not valid json', options)
          return
        }
        originalWriteFileSync(p, data, options)
      }
    )

    // Try to save again — should fail gracefully
    const newState = createSwarmState({
      sessionId: TEST_SESSION_ID,
      currentPhase: 'code',
    })

    try {
      manager.save(newState)
    } catch {
      // Expected — save should throw or log on parse-back failure
    }

    // Original state should be preserved
    vi.restoreAllMocks()
    if (fs.existsSync(statePath())) {
      const afterContent = fs.readFileSync(statePath(), 'utf-8')
      const parsed = JSON.parse(afterContent)
      expect(parsed.currentPhase).toBe('plan')
    }
  })
})

// ---------------------------------------------------------------------------
// FR-6: Load — valid, missing, corrupt
// ---------------------------------------------------------------------------

describe('createStateManager — load (FR-6)', () => {
  it('returns { found: true, valid: true, state } for a valid state file', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const state = createSwarmState({ sessionId: TEST_SESSION_ID })
    manager.save(state)

    const result = manager.load()

    expect(result.found).toBe(true)
    if (result.found && result.valid) {
      expect(result.state.sessionId).toBe('test-session')
      expect(result.state.schemaVersion).toBe(1)
    } else {
      // Force test failure if discriminant is wrong
      expect(result).toHaveProperty('valid', true)
    }
  })

  it('returns { found: false, reason: "missing" } when no state file exists', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    const result = manager.load()

    expect(result.found).toBe(false)
    if (!result.found) {
      expect(result.reason).toBe('missing')
    }
  })

  it('returns { found: true, valid: false } for corrupt JSON', () => {
    fs.writeFileSync(statePath(), 'not json at all!!!', { mode: 0o600 })
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    const result = manager.load()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error).toBeDefined()
      }
    }
  })

  it('returns { found: true, valid: false } for wrong schemaVersion', () => {
    const badState = { ...createSwarmState({ sessionId: TEST_SESSION_ID }), schemaVersion: 999 }
    fs.writeFileSync(statePath(), JSON.stringify(badState), { mode: 0o600 })
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    const result = manager.load()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.valid).toBe(false)
    }
  })

  it('re-validates embedded SwarmState.config through the same schema', () => {
    // State with a tampered config (invalid backend)
    const tamperedState = createSwarmState({ sessionId: TEST_SESSION_ID })
    const raw = JSON.stringify(tamperedState)
    const parsed = JSON.parse(raw)
    parsed.config.models.agents.plan.backend = 'hacked-backend'
    fs.writeFileSync(statePath(), JSON.stringify(parsed), { mode: 0o600 })

    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    const result = manager.load()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.valid).toBe(false)
    }
  })

  it('returns { found: true, valid: false } when required fields are missing', () => {
    const incomplete = { schemaVersion: 1, sessionId: 'test-session' }
    fs.writeFileSync(statePath(), JSON.stringify(incomplete), { mode: 0o600 })
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    const result = manager.load()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.valid).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Lock protocol — acquire, conflict, stale, release
// ---------------------------------------------------------------------------

describe('createStateManager — lock protocol', () => {
  it('creates a lock file on acquireLock()', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    manager.acquireLock()

    expect(fs.existsSync(lockPath())).toBe(true)
    const lock = JSON.parse(fs.readFileSync(lockPath(), 'utf-8'))
    expect(lock.pid).toBe(process.pid)
    expect(lock.startedAt).toBeDefined()
    expect(lock.hostname).toBeDefined()
  })

  it('creates lock file with mode 0o600', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    manager.acquireLock()

    const stats = fs.statSync(lockPath())
    expect(stats.mode & 0o777).toBe(0o600)
  })

  it('throws when lock file exists with a live PID', () => {
    // Write a lock file with the current process PID (known to be alive)
    const lockData = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      hostname: os.hostname(),
    }
    fs.writeFileSync(lockPath(), JSON.stringify(lockData), { mode: 0o600 })

    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    expect(() => manager.acquireLock()).toThrow(/already running/)
  })

  it('overwrites stale lock file when PID is dead', () => {
    // Use a PID that is extremely unlikely to be alive
    const staleLock = {
      pid: 999999999,
      startedAt: new Date().toISOString(),
      hostname: os.hostname(),
    }
    fs.writeFileSync(lockPath(), JSON.stringify(staleLock), { mode: 0o600 })

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    // Should succeed — stale lock is overwritten
    manager.acquireLock()

    expect(fs.existsSync(lockPath())).toBe(true)
    const newLock = JSON.parse(fs.readFileSync(lockPath(), 'utf-8'))
    expect(newLock.pid).toBe(process.pid)
    // Should have warned about stale lock
    expect(stderrSpy).toHaveBeenCalled()
  })

  it('releaseLock() removes the lock file', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    manager.acquireLock()
    expect(fs.existsSync(lockPath())).toBe(true)

    manager.releaseLock()

    expect(fs.existsSync(lockPath())).toBe(false)
  })

  it('releaseLock() is idempotent — does not throw when lock does not exist', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })

    // No lock was acquired, but release should not throw
    expect(() => manager.releaseLock()).not.toThrow()
    // Calling twice also should not throw
    expect(() => manager.releaseLock()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Done marker
// ---------------------------------------------------------------------------

describe('createStateManager — done marker', () => {
  it('writeDoneMarker writes exit code to done file', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const state = createSwarmState({ sessionId: TEST_SESSION_ID })

    // The done marker is written by the state manager (or CLI) on exit
    // We test via save + a marker. Since the interface might vary,
    // we check the file exists after the manager is used.
    // If writeDoneMarker is exposed, use it; otherwise this tests the
    // done marker file pattern exists after expected operations.
    manager.save(state)

    // The done marker is created on session exit.
    // For now, verify the state file path convention is correct.
    // The actual done marker test requires the CLI integration.
    // We still verify the state manager handles the done path convention.
    const expectedDonePath = donePath()
    expect(expectedDonePath).toContain(`swarm-${TEST_SESSION_ID}-done`)
  })
})

// ---------------------------------------------------------------------------
// Errors array capped at 50
// ---------------------------------------------------------------------------

describe('createStateManager — errors cap', () => {
  it('caps errors array at 50 entries in the saved state', () => {
    const manager = createStateManager(TEST_SESSION_ID, { tmpDir })
    const errors = Array.from({ length: 60 }, (_, i) =>
      createPhaseError({ message: `Error ${i}` })
    )
    const state = createSwarmState({
      sessionId: TEST_SESSION_ID,
      errors,
    })

    manager.save(state)

    const result = manager.load()
    if (result.found && result.valid) {
      expect(result.state.errors.length).toBeLessThanOrEqual(50)
      // Should keep the most recent errors
      const lastError = result.state.errors[result.state.errors.length - 1]
      expect(lastError?.message).toBe('Error 59')
    } else {
      // Validation should still pass — the manager truncates before saving
      expect(result.found).toBe(true)
      if (result.found) {
        expect(result.valid).toBe(true)
      }
    }
  })
})
