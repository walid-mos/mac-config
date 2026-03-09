import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spawn } from 'node:child_process'
import {
  createWorktree,
  removeWorktree,
  openDraftPr,
  commitSpecItem,
  markPrReady,
  getChangedFiles,
} from '../../src/git/git-operations.js'
import type { SessionId } from '../../src/core/types.js'
import { createMockChildProcess } from '../__test-utils__/factories.js'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
  }
})

vi.mock('../../src/phases/code/file-verification.js', () => ({
  checkStagingBlocklist: vi.fn().mockReturnValue({ allowed: [], blocked: [] }),
}))

const mockSpawn = vi.mocked(spawn)

// ---------------------------------------------------------------------------
// createWorktree
// ---------------------------------------------------------------------------

describe('createWorktree', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates worktree via bin/wt and returns branch + path', async () => {
    const sessionId = 'my-session' as SessionId
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('Path: /home/user/development/worktrees/project-swarm-my-session', 0), 0)

    const result = await createWorktree(sessionId, '/tmp/project')

    expect(result.branch).toBe('swarm/my-session')
    expect(result.worktreePath).toBe('/home/user/development/worktrees/project-swarm-my-session')
    expect(mockSpawn).toHaveBeenCalledWith('zsh', expect.arrayContaining(['new', 'swarm/my-session', '-y']), { cwd: '/tmp/project' })
  })

  it('validates sessionId format (DL-SC-10)', async () => {
    const invalidSessionId = 'invalid session; rm -rf /' as SessionId

    await expect(
      createWorktree(invalidSessionId, '/tmp/project')
    ).rejects.toThrow('Invalid session ID')
  })

  it('throws if worktree path cannot be parsed from output', async () => {
    const sessionId = 'test-session' as SessionId
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('some unexpected output', 0), 0)

    await expect(
      createWorktree(sessionId, '/tmp/project')
    ).rejects.toThrow('Failed to parse worktree path')
  })
})

// ---------------------------------------------------------------------------
// removeWorktree
// ---------------------------------------------------------------------------

describe('removeWorktree', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('removes worktree via bin/wt clean', async () => {
    const sessionId = 'my-session' as SessionId
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('', 0), 0)

    await removeWorktree(sessionId, '/tmp/project')

    expect(mockSpawn).toHaveBeenCalledWith('zsh', expect.arrayContaining(['clean', 'swarm/my-session', '-y']), { cwd: '/tmp/project' })
  })

  it('validates sessionId format', async () => {
    const invalidSessionId = 'invalid session; rm -rf /' as SessionId

    await expect(
      removeWorktree(invalidSessionId, '/tmp/project')
    ).rejects.toThrow('Invalid session ID')
  })
})

// ---------------------------------------------------------------------------
// openDraftPr
// ---------------------------------------------------------------------------

describe('openDraftPr', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('pushes branch and creates draft PR', async () => {
    const sessionId = 'test-session' as SessionId
    const pushProc = createMockChildProcess()
    const ghProc = createMockChildProcess()
    mockSpawn
      .mockReturnValueOnce(pushProc as never)
      .mockReturnValueOnce(ghProc as never)
    setTimeout(() => pushProc.simulateOutput('', 0), 0)
    setTimeout(() => ghProc.simulateOutput('https://github.com/org/repo/pull/42', 0), 5)

    const result = await openDraftPr('swarm/test-session', sessionId, '/tmp/project')

    expect(result.prNumber).toBe(42)
    expect(result.prUrl).toBe('https://github.com/org/repo/pull/42')
  })

  it('returns prNumber and prUrl', async () => {
    const sessionId = 'test-session' as SessionId
    const pushProc = createMockChildProcess()
    const ghProc = createMockChildProcess()
    mockSpawn
      .mockReturnValueOnce(pushProc as never)
      .mockReturnValueOnce(ghProc as never)
    setTimeout(() => pushProc.simulateOutput('', 0), 0)
    setTimeout(() => ghProc.simulateOutput('https://github.com/org/repo/pull/99', 0), 5)

    const result = await openDraftPr('swarm/test-session', sessionId, '/tmp/project')

    expect(result).toEqual({ prNumber: 99, prUrl: 'https://github.com/org/repo/pull/99' })
  })
})

// ---------------------------------------------------------------------------
// commitSpecItem
// ---------------------------------------------------------------------------

describe('commitSpecItem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('stages only specified files (never git add -A)', async () => {
    const { checkStagingBlocklist } = await import('../../src/phases/code/file-verification.js')
    vi.mocked(checkStagingBlocklist).mockReturnValue({ allowed: ['src/a.ts', 'src/b.ts'], blocked: [] })

    const files = ['src/a.ts', 'src/b.ts']
    const addProc = createMockChildProcess()
    const commitProc = createMockChildProcess()
    const revProc = createMockChildProcess()
    mockSpawn
      .mockReturnValueOnce(addProc as never)
      .mockReturnValueOnce(commitProc as never)
      .mockReturnValueOnce(revProc as never)
    setTimeout(() => addProc.simulateOutput('', 0), 0)
    setTimeout(() => commitProc.simulateOutput('', 0), 5)
    setTimeout(() => revProc.simulateOutput('abc123def', 0), 10)

    await commitSpecItem('/tmp/project', files, 'feat: add feature')

    // Verify git add was called with specific files, not -A
    expect(mockSpawn).toHaveBeenCalledWith('git', ['add', '--', 'src/a.ts', 'src/b.ts'], { cwd: '/tmp/project' })
  })

  it('checks staging blocklist (DL-SC-3)', async () => {
    const { checkStagingBlocklist } = await import('../../src/phases/code/file-verification.js')
    vi.mocked(checkStagingBlocklist).mockReturnValue({ allowed: ['src/a.ts'], blocked: ['.env'] })

    const files = ['src/a.ts', '.env']

    await expect(
      commitSpecItem('/tmp/project', files, 'feat: add feature')
    ).rejects.toThrow('Blocked files')
  })

  it('sanitizes commit message: strips control chars and limits to 500 chars (DL-SC-4)', async () => {
    const { checkStagingBlocklist } = await import('../../src/phases/code/file-verification.js')
    vi.mocked(checkStagingBlocklist).mockReturnValue({ allowed: ['src/a.ts'], blocked: [] })

    const longMessage = 'a'.repeat(600)
    const addProc = createMockChildProcess()
    const commitProc = createMockChildProcess()
    const revProc = createMockChildProcess()
    mockSpawn
      .mockReturnValueOnce(addProc as never)
      .mockReturnValueOnce(commitProc as never)
      .mockReturnValueOnce(revProc as never)
    setTimeout(() => addProc.simulateOutput('', 0), 0)
    setTimeout(() => commitProc.simulateOutput('', 0), 5)
    setTimeout(() => revProc.simulateOutput('abc123', 0), 10)

    await commitSpecItem('/tmp/project', ['src/a.ts'], longMessage)

    // The commit message should be truncated to 500 chars
    const commitCall = mockSpawn.mock.calls.find(c => c[1]?.[0] === 'commit')
    expect(commitCall).toBeDefined()
    const msg = commitCall![1][2] as string
    expect(msg.length).toBeLessThanOrEqual(500)
  })

  it('gets hash via git rev-parse HEAD', async () => {
    const { checkStagingBlocklist } = await import('../../src/phases/code/file-verification.js')
    vi.mocked(checkStagingBlocklist).mockReturnValue({ allowed: ['src/a.ts'], blocked: [] })

    const addProc = createMockChildProcess()
    const commitProc = createMockChildProcess()
    const revProc = createMockChildProcess()
    mockSpawn
      .mockReturnValueOnce(addProc as never)
      .mockReturnValueOnce(commitProc as never)
      .mockReturnValueOnce(revProc as never)
    setTimeout(() => addProc.simulateOutput('', 0), 0)
    setTimeout(() => commitProc.simulateOutput('', 0), 5)
    setTimeout(() => revProc.simulateOutput('deadbeef1234', 0), 10)

    const hash = await commitSpecItem('/tmp/project', ['src/a.ts'], 'feat: commit')

    expect(hash).toBe('deadbeef1234')
    expect(mockSpawn).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], { cwd: '/tmp/project' })
  })

  it('batches files if >100 to avoid ARG_MAX', async () => {
    const { checkStagingBlocklist } = await import('../../src/phases/code/file-verification.js')
    const manyFiles = Array.from({ length: 150 }, (_, i) => `src/file-${i}.ts`)
    vi.mocked(checkStagingBlocklist).mockReturnValue({ allowed: manyFiles, blocked: [] })

    // Two add batches + commit + rev-parse = 4 spawn calls
    const procs = Array.from({ length: 4 }, () => createMockChildProcess())
    let procIdx = 0
    mockSpawn.mockImplementation(() => {
      const proc = procs[procIdx++]!
      setTimeout(() => proc.simulateOutput(procIdx === 4 ? 'hash123' : '', 0), 0)
      return proc as never
    })

    await commitSpecItem('/tmp/project', manyFiles, 'feat: batch commit')

    // Should have 2 git add calls (100 + 50)
    const addCalls = mockSpawn.mock.calls.filter(c => c[1]?.[0] === 'add')
    expect(addCalls.length).toBe(2)
    expect((addCalls[0]![1] as string[]).length).toBe(102) // ['add', '--', ...100 files]
    expect((addCalls[1]![1] as string[]).length).toBe(52)  // ['add', '--', ...50 files]
  })
})

// ---------------------------------------------------------------------------
// markPrReady
// ---------------------------------------------------------------------------

describe('markPrReady', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('marks the draft PR as ready', async () => {
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('', 0), 0)

    await markPrReady(42, '/tmp/project')

    expect(mockSpawn).toHaveBeenCalledWith('gh', ['pr', 'ready', '42'], { cwd: '/tmp/project' })
  })
})

// ---------------------------------------------------------------------------
// getChangedFiles
// ---------------------------------------------------------------------------

describe('getChangedFiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses git status --porcelain to detect tracked AND untracked files', async () => {
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput(' M src/app.ts\n?? src/new-file.ts\nA  src/added.ts', 0), 0)

    const files = await getChangedFiles('/tmp/project')

    expect(mockSpawn).toHaveBeenCalledWith('git', ['status', '--porcelain'], { cwd: '/tmp/project' })
    expect(files).toEqual(['src/app.ts', 'src/new-file.ts', 'src/added.ts'])
  })

  it('filters out node_modules/', async () => {
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('?? node_modules/\n?? src/app.ts', 0), 0)

    const files = await getChangedFiles('/tmp/project')

    expect(files).toEqual(['src/app.ts'])
  })

  it('filters out .pnpm-store/', async () => {
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('?? .pnpm-store/\n M src/app.ts', 0), 0)

    const files = await getChangedFiles('/tmp/project')

    expect(files).toEqual(['src/app.ts'])
  })

  it('returns empty array when no changes', async () => {
    const proc = createMockChildProcess()
    mockSpawn.mockReturnValue(proc as never)
    setTimeout(() => proc.simulateOutput('', 0), 0)

    const files = await getChangedFiles('/tmp/project')

    expect(files).toEqual([])
  })
})
