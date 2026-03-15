import { spawn } from 'node:child_process'

export interface CommandResult {
  stdout: string
  stderr: string
}

interface SpawnCommandOptions {
  cwd: string
  stdin?: string
  timeoutMs?: number
}

const finalizeOutput = (value: string): string => value.trimEnd()

export const spawnCommand = (
  command: string,
  args: string[],
  { cwd, stdin, timeoutMs }: SpawnCommandOptions,
): Promise<CommandResult> => new Promise((resolve, reject) => {
  const proc = spawn(command, args, { cwd })
  let stdout = ''
  let stderr = ''
  let timedOut = false

  const timeout = timeoutMs === undefined
    ? undefined
    : setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
      }, timeoutMs)

  if (stdin !== undefined && proc.stdin) {
    proc.stdin.write(stdin)
    proc.stdin.end()
  }

  proc.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  proc.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  proc.on('close', (code) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    if (timedOut) {
      reject(new Error(`${command} timed out after ${timeoutMs}ms`))
      return
    }

    if (code === 0) {
      resolve({ stdout: finalizeOutput(stdout), stderr: finalizeOutput(stderr) })
      return
    }

    reject(new Error(`${command} ${args[0] ?? ''} failed (exit ${code}): ${stderr || stdout}`.trim()))
  })

  proc.on('error', (err) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    reject(new Error(`${command} spawn error: ${err.message}`))
  })
})

export const spawnNamedCommand = (
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> => spawnCommand(command, args, { cwd })

export const spawnGit = (
  args: string[],
  cwd: string,
): Promise<CommandResult> => spawnNamedCommand('git', args, cwd)
