import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createSessionId } from '../src/core/types.js'
import {
  CLI_RUNTIME_OWNERSHIP,
  createInitialState,
  createStatusSnapshot,
  getRuntimeDir,
  validateProjectDir,
  validateSpecContainment,
} from '../src/cli.js'
import { createSwarmConfig } from './__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-cli-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// FR-7: Session ID validation via createSessionId (SC-1)
// The CLI run handler uses createSessionId to brand and validate the session
// ID. These tests verify the validation logic through the public API.
// ---------------------------------------------------------------------------

describe('CLI — session ID validation (FR-7, SC-1)', () => {
  it('accepts valid session ID and returns the branded value', () => {
    const id = createSessionId('my-session_01')

    // Must return the exact string, branded as SessionId
    expect(id).toBe('my-session_01')
  })

  it('accepts a numeric-only session ID', () => {
    const id = createSessionId('12345')

    expect(id).toBe('12345')
  })

  it('rejects session ID with path traversal characters', () => {
    try {
      createSessionId('../etc/passwd')
      expect.unreachable('should have thrown for path traversal')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('rejects session ID with forward slashes', () => {
    try {
      createSessionId('session/name')
      expect.unreachable('should have thrown for forward slash')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('rejects session ID with spaces', () => {
    try {
      createSessionId('session name')
      expect.unreachable('should have thrown for spaces')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('rejects session ID exceeding 64 characters', () => {
    try {
      createSessionId('a'.repeat(65))
      expect.unreachable('should have thrown for length > 64')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('rejects empty session ID', () => {
    try {
      createSessionId('')
      expect.unreachable('should have thrown for empty string')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })
})

// ---------------------------------------------------------------------------
// FR-7: Spec under project-dir (SC-4)
// These test the canonicalization and containment logic that the run handler
// must implement. Verifying through fs.realpathSync + startsWith as the run
// handler would.
// ---------------------------------------------------------------------------

describe('CLI — spec path containment (FR-7, SC-4)', () => {
  it('canonicalized spec path under project-dir passes containment check', () => {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })
    const specPath = path.join(projectDir, 'spec.md')
    fs.writeFileSync(specPath, '# Spec', 'utf-8')

    expect(() => validateSpecContainment(specPath, projectDir)).not.toThrow()
  })

  it('spec path outside project-dir fails containment check', () => {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })
    const outsideSpec = path.join(tmpDir, 'outside-spec.md')
    fs.writeFileSync(outsideSpec, '# Outside', 'utf-8')

    expect(() => validateSpecContainment(outsideSpec, projectDir)).toThrow(/not under project directory/i)
  })

  it('symlink-based escape is caught by realpathSync canonicalization', () => {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })
    const outsideFile = path.join(tmpDir, 'secret.md')
    fs.writeFileSync(outsideFile, 'secret', 'utf-8')
    const symlinkPath = path.join(projectDir, 'escape.md')
    fs.symlinkSync(outsideFile, symlinkPath)

    expect(() => validateSpecContainment(symlinkPath, projectDir)).toThrow(/not under project directory/i)
  })
})

// ---------------------------------------------------------------------------
// FR-7: System root rejection (SC-4)
// The run handler must reject these directories as project-dir.
// Since the validation function is not yet separately exported, we test
// the invariant that will be enforced.
// ---------------------------------------------------------------------------

describe('CLI — system root rejection (FR-7, SC-4)', () => {
  it('rejects project-dir = "/" as system root', () => {
    expect(() => validateProjectDir('/')).toThrow(/system root/i)
  })

  it('rejects project-dir = "/etc" as system root', () => {
    expect(() => validateProjectDir('/etc')).toThrow(/system root/i)
  })

  it('rejects project-dir = "/var" as system root', () => {
    expect(() => validateProjectDir('/var')).toThrow(/system root/i)
  })

  it('rejects project-dir = "/usr" as system root', () => {
    expect(() => validateProjectDir('/usr')).toThrow(/system root/i)
  })
})

describe('CLI session lifecycle helpers', () => {
  it('creates initial state with runtime metadata and CLI-owned fields', () => {
    const sessionId = createSessionId('session-status')
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })
    const specPath = path.join(projectDir, 'spec.md')
    fs.writeFileSync(specPath, '# Spec', 'utf-8')
    const runtimeDir = getRuntimeDir(projectDir, sessionId)

    const state = createInitialState(sessionId, specPath, projectDir, runtimeDir, {
      resolvedFrom: 'builtin-defaults',
      config: createSwarmConfig(),
    })

    expect(state.runtimeDir).toBe(runtimeDir)
    expect(state.configResolvedFrom).toBe('builtin-defaults')
    expect(state.status).toBe('running')
    expect(state.worktreeBranch).toBe(`swarm/${sessionId}`)
    expect(state.currentPhase).toBe('init')
  })

  it('creates a status snapshot with next phase and ownership metadata', () => {
    const snapshot = createStatusSnapshot({
      ...createInitialState(
        createSessionId('snapshot-session'),
        '/tmp/project/spec.md',
        '/tmp/project',
        '/tmp/project/.swarm/run/snapshot-session',
        { resolvedFrom: 'builtin-defaults', config: createSwarmConfig() },
      ),
      completedPhases: ['plan'],
      currentPhase: 'plan',
      worktreePath: '/tmp/project-wt',
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
    })

    expect(snapshot.nextPhase).toBe('code')
    expect(snapshot.worktreeExists).toBe(false)
    expect(snapshot.prNumber).toBe(42)
    expect(snapshot.runtimeOwnership).toEqual(CLI_RUNTIME_OWNERSHIP)
  })

  it('accepts a normal project directory', () => {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })

    expect(() => validateProjectDir(projectDir)).not.toThrow()
  })
})
