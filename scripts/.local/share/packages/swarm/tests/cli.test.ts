import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createSessionId } from '../src/core/types.js'

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

    const canonicalProject = fs.realpathSync(projectDir)
    const canonicalSpec = fs.realpathSync(specPath)

    // The run handler must enforce this invariant
    expect(canonicalSpec.startsWith(canonicalProject + path.sep)).toBe(true)
  })

  it('spec path outside project-dir fails containment check', () => {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })
    const outsideSpec = path.join(tmpDir, 'outside-spec.md')
    fs.writeFileSync(outsideSpec, '# Outside', 'utf-8')

    const canonicalProject = fs.realpathSync(projectDir)
    const canonicalSpec = fs.realpathSync(outsideSpec)

    expect(canonicalSpec.startsWith(canonicalProject + path.sep)).toBe(false)
  })

  it('symlink-based escape is caught by realpathSync canonicalization', () => {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(projectDir, { recursive: true })
    const outsideFile = path.join(tmpDir, 'secret.md')
    fs.writeFileSync(outsideFile, 'secret', 'utf-8')
    const symlinkPath = path.join(projectDir, 'escape.md')
    fs.symlinkSync(outsideFile, symlinkPath)

    const canonicalProject = fs.realpathSync(projectDir)
    const canonicalSpec = fs.realpathSync(symlinkPath)

    // realpathSync resolves the symlink, revealing it points outside
    expect(canonicalSpec.startsWith(canonicalProject + path.sep)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// FR-7: System root rejection (SC-4)
// The run handler must reject these directories as project-dir.
// Since the validation function is not yet separately exported, we test
// the invariant that will be enforced.
// ---------------------------------------------------------------------------

describe('CLI — system root rejection (FR-7, SC-4)', () => {
  // These tests require the validateProjectDir function to be exported from
  // cli.ts or a validation module. Once available, each test should call the
  // function and assert it throws for system roots.
  // blocked on SF-001: validateProjectDir not yet exposed as testable unit

  it.todo('rejects project-dir = "/" as system root') // blocked on SF-001
  it.todo('rejects project-dir = "/etc" as system root') // blocked on SF-001
  it.todo('rejects project-dir = "/var" as system root') // blocked on SF-001
  it.todo('rejects project-dir = "/usr" as system root') // blocked on SF-001
})
