import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { SessionId, SwarmState, SwarmStateManager, LoadResult } from './types.js'
import { SwarmStateSchema } from './validation.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ERRORS = 50

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

// ---------------------------------------------------------------------------
// createStateManager
// ---------------------------------------------------------------------------

export function createStateManager(
  sessionId: SessionId,
  options?: { tmpDir?: string }
): SwarmStateManager {
  const tmpDir = options?.tmpDir ?? os.tmpdir()
  const stateFile = path.join(tmpDir, `swarm-${sessionId}-state.json`)
  const lockFile = path.join(tmpDir, `swarm-${sessionId}-lock`)

  function save(state: SwarmState): void {
    // Cap errors at MAX_ERRORS (keep most recent)
    const cappedState: SwarmState = {
      ...state,
      errors: state.errors.length > MAX_ERRORS
        ? state.errors.slice(-MAX_ERRORS)
        : state.errors,
    }

    const json = JSON.stringify(cappedState, null, 2)
    const tmpPath = stateFile + '.tmp'

    // Atomic write: create .tmp with correct permissions first, then write data
    // Two-phase write ensures permissions are set before data lands on disk
    fs.writeFileSync(tmpPath, '', { mode: 0o600 })
    fs.writeFileSync(tmpPath, json, { mode: 0o600 })

    // Read back and parse to verify integrity
    try {
      const readBack = fs.readFileSync(tmpPath, 'utf-8')
      JSON.parse(readBack)
    } catch (err) {
      // Parse-back failed — delete .tmp, do NOT overwrite existing state
      try {
        fs.unlinkSync(tmpPath)
      } catch (cleanupError) {
        process.stderr.write(
          `Warning: failed to remove temporary state file "${tmpPath}": ${formatError(cleanupError)}\n`
        )
      }
      throw new Error(
        `State write-back verification failed: ${formatError(err)}`
      )
    }

    // Rename .tmp to final path (atomic on POSIX)
    fs.renameSync(tmpPath, stateFile)

    // Ensure correct permissions on the final file
    fs.chmodSync(stateFile, 0o600)
  }

  function load(): LoadResult {
    // Check if file exists
    if (!fs.existsSync(stateFile)) {
      return { found: false, reason: 'missing' }
    }

    let raw: string
    try {
      raw = fs.readFileSync(stateFile, 'utf-8')
    } catch (error) {
      process.stderr.write(`Warning: failed to read state file "${stateFile}": ${formatError(error)}\n`)
      return { found: false, reason: 'inaccessible' }
    }

    // Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      return {
        found: true,
        valid: false,
        error: `Invalid JSON: ${(err as Error).message}`,
      }
    }

    // Validate via Zod schema
    const result = SwarmStateSchema.safeParse(parsed)
    if (!result.success) {
      return {
        found: true,
        valid: false,
        error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      }
    }

    return {
      found: true,
      valid: true,
      state: result.data as SwarmState,
    }
  }

  function acquireLock(): void {
    // Try atomic exclusive create
    try {
      const fd = fs.openSync(lockFile, 'wx', 0o600)
      const lockData = JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        hostname: os.hostname(),
      })
      fs.writeSync(fd, lockData)
      fs.closeSync(fd)
      return
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err
      }
    }

    // Lock file exists — check PID liveness
    const lockContent = fs.readFileSync(lockFile, 'utf-8')
    let lockData: { pid: number; startedAt: string; hostname: string }
    try {
      lockData = JSON.parse(lockContent)
    } catch (error) {
      process.stderr.write(`Warning: replacing corrupt lock file "${lockFile}": ${formatError(error)}\n`)
      // Corrupt lock file — overwrite it
      writeLockFile()
      return
    }

    // Check if the process is alive
    if (isPidAlive(lockData.pid)) {
      throw new Error(
        `Session is already running (PID ${lockData.pid}, started at ${lockData.startedAt})`
      )
    }

    // Stale lock — warn and overwrite
    process.stderr.write(
      `Warning: overwriting stale lock file (PID ${lockData.pid} is dead)\n`
    )
    writeLockFile()
  }

  function writeLockFile(): void {
    const lockData = JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      hostname: os.hostname(),
    })
    fs.writeFileSync(lockFile, lockData, { mode: 0o600 })
  }

  function releaseLock(): void {
    try {
      fs.unlinkSync(lockFile)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
      // ENOENT is expected (idempotent release)
    }
  }

  return { load, save, acquireLock, releaseLock }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'EPERM' && err.code !== 'ESRCH') {
      process.stderr.write(`Warning: failed to probe PID ${pid}: ${formatError(error)}\n`)
    }

    if (err.code === 'EPERM') {
      return true
    }

    return false
  }
}
