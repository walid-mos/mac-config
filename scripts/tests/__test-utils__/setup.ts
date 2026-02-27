// Enable spying on native ESM module exports (node:fs, node:path, etc.)
// Without this, vi.spyOn(fs, 'writeFileSync') fails with:
// "Cannot spy on export. Module namespace is not configurable in ESM."
//
// NOTE: vi.mock({ spy: true }) wraps exports once at module load time.
// If a test calls vi.spyOn() on a mock-spied export and then
// vi.restoreAllMocks() runs, the wrapper is permanently removed.
// The afterEach below re-applies spy wrappers so that subsequent
// tests can still use expect(fn).not.toHaveBeenCalled() without
// explicitly calling vi.spyOn() first.
import { vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as childProcess from 'node:child_process'

vi.mock('node:fs', { spy: true })
vi.mock('node:child_process', { spy: true })

afterEach(() => {
  // Re-wrap exports that vi.restoreAllMocks() may have un-spied.
  // vi.spyOn on an already-spied function is a no-op in Vitest 3,
  // so this is safe to call unconditionally.
  if (!vi.isMockFunction(fs.statSync)) {
    vi.spyOn(fs, 'statSync')
  }
  if (!vi.isMockFunction(childProcess.spawn)) {
    vi.spyOn(childProcess, 'spawn')
  }
})
