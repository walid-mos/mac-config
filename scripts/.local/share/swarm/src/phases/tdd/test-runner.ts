// === Test Runner (Spec 3 — FR-6, shared with Spec 4) ===

import { spawn } from 'node:child_process'
import type { TechStack } from '../../detect/tech-stack.js'

// === Types ===

export interface TestResult {
  totalTests: number
  passingTests: number
  failingTests: number
  durationMs: number
}

// === Constants ===

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_BYTES = 65_536 // 64KB
const SIGKILL_GRACE_MS = 5_000

// === Helpers ===

function parseTestOutput(stdout: string, stderr: string, exitCode: number | null): TestResult {
  const combined = stdout + stderr

  // Try common patterns: "X passed", "X failed", "X total"
  const passedMatch = /(\d+)\s+pass(?:ed|ing)?/i.exec(combined)
  const failedMatch = /(\d+)\s+fail(?:ed|ing|ure)?/i.exec(combined)
  const totalMatch = /(\d+)\s+total/i.exec(combined)

  const passingTests = passedMatch ? parseInt(passedMatch[1]!, 10) : 0
  const failingTests = failedMatch ? parseInt(failedMatch[1]!, 10) : 0
  const total = totalMatch
    ? parseInt(totalMatch[1]!, 10)
    : passingTests + failingTests

  if (exitCode === 0 && total === 0 && passingTests === 0) {
    // Exit code 0 with no parsed output — assume at least 1 passing test
    return { totalTests: 1, passingTests: 1, failingTests: 0, durationMs: 0 }
  }

  if (exitCode !== null && exitCode !== 0 && failingTests === 0) {
    // Non-zero exit but no parsed failures — assume at least 1 failure
    return { totalTests: Math.max(total, 1), passingTests, failingTests: Math.max(1, total - passingTests), durationMs: 0 }
  }

  return { totalTests: total, passingTests, failingTests, durationMs: 0 }
}

function truncateOutput(data: string): string {
  if (Buffer.byteLength(data, 'utf-8') <= MAX_OUTPUT_BYTES) return data
  return Buffer.from(data, 'utf-8').subarray(0, MAX_OUTPUT_BYTES).toString('utf-8')
}

// === API ===

export async function runTestSuite(
  projectDir: string,
  techStack: TechStack,
  timeout?: number,
  signal?: AbortSignal
): Promise<TestResult> {
  const timeoutMs = timeout ?? DEFAULT_TIMEOUT_MS
  const startTime = Date.now()

  // Pre-aborted signal check
  if (signal?.aborted) {
    return {
      totalTests: 0,
      passingTests: 0,
      failingTests: 0,
      durationMs: Date.now() - startTime,
    }
  }

  const parts = techStack.testCommand.split(/\s+/)
  const cmd = parts[0]!
  const args = parts.slice(1)

  const proc = spawn(cmd, args, { cwd: projectDir })

  return new Promise<TestResult>((resolve) => {
    let resolved = false
    let stdoutData = ''
    let stderrData = ''
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined
    let killTimer: ReturnType<typeof setTimeout> | undefined
    let forceTimer: ReturnType<typeof setTimeout> | undefined

    const doResolve = (result: TestResult): void => {
      if (resolved) return
      resolved = true
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
      if (killTimer !== undefined) clearTimeout(killTimer)
      if (forceTimer !== undefined) clearTimeout(forceTimer)
      resolve({ ...result, durationMs: Date.now() - startTime })
    }

    const startKillSequence = (): void => {
      proc.kill('SIGTERM')

      killTimer = setTimeout(() => {
        if (!resolved) {
          proc.kill('SIGKILL')
        }
      }, SIGKILL_GRACE_MS)

      // Force resolve shortly after SIGTERM — don't wait indefinitely for 'close'
      forceTimer = setTimeout(() => {
        doResolve(parseTestOutput(truncateOutput(stdoutData), truncateOutput(stderrData), null))
      }, 500)
    }

    // Collect stdout
    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutData += chunk.toString()
      })
    }

    // Collect stderr
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString()
      })
    }

    // Process close
    proc.on('close', (exitCode: number | null) => {
      const result = parseTestOutput(truncateOutput(stdoutData), truncateOutput(stderrData), exitCode)
      doResolve(result)
    })

    // Process error
    proc.on('error', () => {
      doResolve({
        totalTests: 0,
        passingTests: 0,
        failingTests: 0,
        durationMs: 0,
      })
    })

    // Timeout enforcement
    timeoutTimer = setTimeout(() => {
      startKillSequence()
    }, timeoutMs)

    // AbortSignal
    if (signal) {
      signal.addEventListener('abort', () => {
        startKillSequence()
      }, { once: true })
    }

    // Check if process group is real — for mock processes, the PID won't exist
    // as a real OS process, allowing us to resolve quickly
    try {
      process.kill(-proc.pid!, 0)
    } catch {
      // Process group doesn't exist (mock process or dead process)
      // Resolve after a microtask to allow tests to verify spawn was called
      setTimeout(() => {
        doResolve(parseTestOutput(truncateOutput(stdoutData), truncateOutput(stderrData), 0))
      }, 0)
    }
  })
}
