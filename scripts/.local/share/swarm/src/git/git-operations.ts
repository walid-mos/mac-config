// === Git Operations (Spec 4 — FR-9, FR-11, FR-12) ===

import type { SessionId } from '../core/types.js'
import { checkStagingBlocklist } from '../phases/code/file-verification.js'
import { spawnGit, spawnNamedCommand } from '../utils/process.js'

// === Constants ===

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g
const MAX_COMMIT_MSG_LEN = 500
const FILE_BATCH_SIZE = 100

// === API ===

export async function createWorktree(
  sessionId: SessionId,
  projectDir: string,
  branch?: string
): Promise<{ branch: string; worktreePath: string }> {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error(`Invalid session ID "${sessionId}": must match /^[a-zA-Z0-9_-]{1,64}$/`)
  }

  const resolvedBranch = branch ?? `swarm/${sessionId}`
  const binWt = new URL('../bin/wt', import.meta.url).pathname
  const { stdout } = await spawnNamedCommand('zsh', [binWt, 'new', resolvedBranch, '-y'], projectDir)

  const pathMatch = /Path:\s*(.+)/.exec(stdout)
  if (!pathMatch?.[1]) {
    throw new Error(`Failed to parse worktree path from wt output:\n${stdout}`)
  }

  const worktreePath = pathMatch[1].trim()

  // Verify the worktree was actually created on disk — the wt script can
  // print the path before `git worktree add` runs, so a non-zero exit may
  // be swallowed (e.g. by trailing function definitions resetting $?).
  const { statSync } = await import('node:fs')
  try {
    const stat = statSync(worktreePath)
    if (!stat.isDirectory()) {
      throw new Error(`Worktree path exists but is not a directory: "${worktreePath}"`)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Worktree creation failed: directory "${worktreePath}" does not exist after wt new.\n` +
        `wt output:\n${stdout}`
      )
    }
    throw err
  }

  return { branch: resolvedBranch, worktreePath }
}

export async function removeWorktree(
  branchOrSessionId: string,
  projectDir: string
): Promise<void> {
  // Accept either a full branch name (swarm/session/spec-slug) or a bare sessionId.
  const branch = branchOrSessionId.includes('/')
    ? branchOrSessionId
    : `swarm/${branchOrSessionId}`
  const binWt = new URL('../bin/wt', import.meta.url).pathname
  await spawnNamedCommand('zsh', [binWt, 'clean', branch, '-y'], projectDir)
}

export async function openDraftPr(
  branch: string,
  sessionId: SessionId,
  projectDir: string
): Promise<{ prNumber: number; prUrl: string }> {
  // Push branch to remote
  await spawnGit(['push', '-u', 'origin', branch], projectDir)

  // Create draft PR
  const { stdout } = await spawnNamedCommand(
    'gh',
    [
      'pr', 'create',
      '--draft',
      '--title', `swarm: ${sessionId}`,
      '--body', `Automated PR for swarm session \`${sessionId}\``,
    ],
    projectDir,
  )

  // gh pr create outputs the PR URL on stdout
  const prUrl = stdout.trim()
  const prNumberMatch = /\/(\d+)\s*$/.exec(prUrl)
  if (!prNumberMatch) {
    throw new Error(`Failed to parse PR number from gh output: ${prUrl}`)
  }

  return {
    prNumber: parseInt(prNumberMatch[1]!, 10),
    prUrl,
  }
}

export async function commitSpecItem(
  projectDir: string,
  changedFiles: string[],
  message: string
): Promise<string> {
  if (changedFiles.length === 0) {
    throw new Error('No files to commit')
  }

  // Check blocklist
  const { blocked } = checkStagingBlocklist(changedFiles)
  if (blocked.length > 0) {
    throw new Error(`Blocked files cannot be committed: ${blocked.join(', ')}`)
  }

  // Sanitize message
  let sanitized = message.replace(CONTROL_CHARS_RE, '')
  if (sanitized.length > MAX_COMMIT_MSG_LEN) {
    sanitized = sanitized.slice(0, MAX_COMMIT_MSG_LEN)
  }

  // Batch git add in chunks of FILE_BATCH_SIZE
  for (let i = 0; i < changedFiles.length; i += FILE_BATCH_SIZE) {
    const batch = changedFiles.slice(i, i + FILE_BATCH_SIZE)
    await spawnGit(['add', '--', ...batch], projectDir)
  }

  // Commit
  await spawnGit(['commit', '-m', sanitized], projectDir)

  // Get hash
  const { stdout } = await spawnGit(['rev-parse', 'HEAD'], projectDir)
  return stdout.trim()
}

export async function markPrReady(
  prNumber: number,
  projectDir: string
): Promise<void> {
  await spawnNamedCommand('gh', ['pr', 'ready', String(prNumber)], projectDir)
}

// Directories that should never be committed — caches, deps, VCS internals.
const IGNORED_PATH_PREFIXES = [
  'node_modules/',
  'node_modules',
  '.pnpm-store/',
  '.pnpm-store',
  '.git/',
  '.git',
  '.swarm/',
  '.swarm',
]

function isIgnoredPath(file: string): boolean {
  return IGNORED_PATH_PREFIXES.some(prefix => file === prefix || file.startsWith(prefix))
}

function parsePorcelainPath(line: string): string {
  return line.slice(3)
}

function parseStatusPorcelain(stdout: string): string[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map(parsePorcelainPath)
    .filter(file => !isIgnoredPath(file))
}

export async function getChangedFiles(projectDir: string): Promise<string[]> {
  // Use git status --porcelain to capture BOTH modified tracked files AND new untracked files.
  // git diff --name-only HEAD only shows tracked changes — new files created by code agents are invisible.
  const { stdout } = await spawnGit(['status', '--porcelain'], projectDir)
  return parseStatusPorcelain(stdout)
}

export async function getUntrackedFiles(
  projectDir: string,
  candidateFiles?: string[]
): Promise<string[]> {
  const { stdout } = await spawnGit(['status', '--porcelain'], projectDir)
  const candidates = candidateFiles ? new Set(candidateFiles) : null

  return stdout
    .split('\n')
    .filter(line => line.startsWith('?? '))
    .map(parsePorcelainPath)
    .filter(file => !isIgnoredPath(file))
    .filter(file => candidates?.has(file) ?? true)
}

export async function intentToAddFiles(projectDir: string, changedFiles: string[]): Promise<void> {
  if (changedFiles.length === 0) {
    return
  }

  const untrackedFiles = await getUntrackedFiles(projectDir, changedFiles)
  if (untrackedFiles.length === 0) {
    return
  }

  await spawnGit(['add', '-N', '--', ...untrackedFiles], projectDir)
}
