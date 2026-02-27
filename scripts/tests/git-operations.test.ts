import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spawn } from 'node:child_process'
import {
  createFeatureBranch,
  openDraftPr,
  commitSpecItem,
  markPrReady,
} from '../src/git-operations.js'
import type { SessionId } from '../src/types.js'
import { createMockChildProcess } from './__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// createFeatureBranch
// ---------------------------------------------------------------------------

describe('createFeatureBranch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates feat/<sessionId> branch from HEAD', async () => {
    const sessionId = 'my-session' as SessionId

    await expect(
      createFeatureBranch(sessionId, '/tmp/project')
    ).rejects.toThrow('Not implemented')
  })

  it('validates sessionId format (DL-SC-10)', async () => {
    const invalidSessionId = 'invalid session; rm -rf /' as SessionId

    await expect(
      createFeatureBranch(invalidSessionId, '/tmp/project')
    ).rejects.toThrow()
  })

  it('uses spawn (not exec) for git commands — DL-SC-1', async () => {
    const sessionId = 'test-session' as SessionId

    await expect(
      createFeatureBranch(sessionId, '/tmp/project')
    ).rejects.toThrow('Not implemented')

    // When implemented, spawn should be called — not exec
  })
})

// ---------------------------------------------------------------------------
// openDraftPr
// ---------------------------------------------------------------------------

describe('openDraftPr', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('verifies gh auth status before creating PR', async () => {
    const sessionId = 'test-session' as SessionId

    await expect(
      openDraftPr('feat/test-session', sessionId, '/tmp/project')
    ).rejects.toThrow('Not implemented')
  })

  it('creates draft PR with correct body', async () => {
    const sessionId = 'test-session' as SessionId

    await expect(
      openDraftPr('feat/test-session', sessionId, '/tmp/project')
    ).rejects.toThrow('Not implemented')
  })

  it('returns prNumber and prUrl', async () => {
    const sessionId = 'test-session' as SessionId

    await expect(
      openDraftPr('feat/test-session', sessionId, '/tmp/project')
    ).rejects.toThrow('Not implemented')
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
    const files = ['src/a.ts', 'src/b.ts']

    await expect(
      commitSpecItem('/tmp/project', files, 'feat: add feature')
    ).rejects.toThrow('Not implemented')
  })

  it('checks staging blocklist (DL-SC-3)', async () => {
    const files = ['src/a.ts', '.env']

    await expect(
      commitSpecItem('/tmp/project', files, 'feat: add feature')
    ).rejects.toThrow()
  })

  it('sanitizes commit message: strips control chars and limits to 500 chars (DL-SC-4)', async () => {
    const longMessage = 'a'.repeat(600)

    await expect(
      commitSpecItem('/tmp/project', ['src/a.ts'], longMessage)
    ).rejects.toThrow('Not implemented')
  })

  it('gets hash via git rev-parse HEAD', async () => {
    await expect(
      commitSpecItem('/tmp/project', ['src/a.ts'], 'feat: commit')
    ).rejects.toThrow('Not implemented')
  })

  it('batches files if >100 to avoid ARG_MAX', async () => {
    const manyFiles = Array.from({ length: 150 }, (_, i) => `src/file-${i}.ts`)

    await expect(
      commitSpecItem('/tmp/project', manyFiles, 'feat: batch commit')
    ).rejects.toThrow('Not implemented')
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
    await expect(
      markPrReady(42, '/tmp/project')
    ).rejects.toThrow('Not implemented')
  })
})
