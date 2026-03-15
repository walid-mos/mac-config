import * as fs from 'node:fs'
import * as path from 'node:path'
import { emitWarningEvent } from './core/event-emitter.js'
import { readCodePhaseResult, readPlanPhaseResult } from './phases/phase-results.js'
import type {
  ResolvedConfig,
  SessionId,
  SessionContext,
  SessionStatus,
  SwarmState,
  SwarmStateManager,
  TopLevelPhase,
} from './core/types.js'

const SYSTEM_ROOTS = new Set(['/', '/etc', '/private/etc', '/var', '/private/var', '/usr'])

export const EVENT_LOG_RETENTION = {
  maxSessionLogs: 20,
  maxAgeDays: 14,
} as const

export const CLI_RUNTIME_OWNERSHIP = {
  worktree: 'cli',
  pullRequest: 'cli',
  push: 'cli',
  cleanup: 'cli',
  statePersistence: 'cli',
} as const

export interface CliStatusSnapshot {
  sessionId: string
  status: SessionStatus
  currentPhase: TopLevelPhase
  nextPhase: TopLevelPhase | null
  specPath: string
  projectDir: string
  runtimeDir: string
  worktreePath?: string
  worktreeBranch?: string
  worktreeExists: boolean
  prNumber?: number
  prUrl?: string
  completedPhases: TopLevelPhase[]
  configResolvedFrom: string
  startedAt: string
  updatedAt: string
  completedAt?: string
  failureReason?: string
  runtimeOwnership: typeof CLI_RUNTIME_OWNERSHIP
}

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const getRequiredString = (options: Record<string, unknown>, key: string): string => {
  const value = options[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required option: ${key}`)
  }

  return value
}

export const getRuntimeDir = (projectDir: string, sessionId: string): string => {
  return path.join(projectDir, '.swarm', 'run', sessionId)
}

export const pruneRuntimeSessionLogs = (runtimeRoot: string, currentSession: string): void => {
  if (!fs.existsSync(runtimeRoot)) {
    return
  }

  const now = Date.now()
  const maxAgeMs = EVENT_LOG_RETENTION.maxAgeDays * 24 * 60 * 60 * 1000
  const entries = fs.readdirSync(runtimeRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== currentSession)
    .map(entry => {
      const fullPath = path.join(runtimeRoot, entry.name)
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  for (const [index, entry] of entries.entries()) {
    const isExpired = now - entry.mtimeMs > maxAgeMs
    const exceedsCount = index >= EVENT_LOG_RETENTION.maxSessionLogs

    if (isExpired || exceedsCount) {
      fs.rmSync(entry.fullPath, { recursive: true, force: true })
    }
  }
}

const getWorktreeSpecPath = (worktreePath: string, projectDir: string, specPath: string): string => {
  return path.join(worktreePath, path.relative(projectDir, specPath))
}

const appendCompletedPhase = (
  completedPhases: TopLevelPhase[],
  phase: TopLevelPhase,
): TopLevelPhase[] => {
  if (completedPhases.includes(phase)) {
    return completedPhases
  }

  return [...completedPhases, phase]
}

const getNextPhase = (state: Pick<SwarmState, 'completedPhases'>): TopLevelPhase | null => {
  if (!state.completedPhases.includes('plan')) {
    return 'plan'
  }

  if (!state.completedPhases.includes('code')) {
    return 'code'
  }

  if (!state.completedPhases.includes('docs')) {
    return 'docs'
  }

  return null
}

const isAbortError = (signal: AbortSignal, error: unknown): boolean => {
  if (signal.aborted) {
    return true
  }

  return error instanceof Error && error.name === 'AbortError'
}

const maybeExtractPrState = (phase: TopLevelPhase, result: unknown): Pick<SwarmState, 'prNumber' | 'prUrl'> => {
  if (phase !== 'code' || typeof result !== 'object' || result === null) {
    return {}
  }

  const gitState = Reflect.get(result, 'gitState')
  if (typeof gitState !== 'object' || gitState === null) {
    return {}
  }

  const prNumber = Reflect.get(gitState, 'prNumber')
  const prUrl = Reflect.get(gitState, 'prUrl')

  return {
    ...(typeof prNumber === 'number' ? { prNumber } : {}),
    ...(typeof prUrl === 'string' ? { prUrl } : {}),
  }
}

const updateState = (
  stateManager: SwarmStateManager,
  updater: (state: SwarmState) => SwarmState,
): SwarmState => {
  const nextState = updater(readValidState(stateManager))
  stateManager.save(nextState)
  return nextState
}

const readValidState = (stateManager: SwarmStateManager): SwarmState => {
  const result = stateManager.load()
  if (!result.found) {
    throw new Error(`Session state is unavailable: ${result.reason}`)
  }

  if (!result.valid) {
    throw new Error(`Session state is invalid: ${result.error}`)
  }

  return result.state
}

export function validateProjectDir(dir: string): void {
  const canonical = fs.realpathSync(dir)
  if (SYSTEM_ROOTS.has(canonical)) {
    throw new Error(`Project directory must not be a system root: ${canonical}`)
  }

  const stat = fs.statSync(canonical)
  if (!stat.isDirectory()) {
    throw new Error(`Project directory is not a directory: ${canonical}`)
  }
}

export function validateSpecContainment(specPath: string, projectDir: string): void {
  const canonicalSpec = fs.realpathSync(specPath)
  const canonicalProject = fs.realpathSync(projectDir)
  if (!canonicalSpec.startsWith(canonicalProject + path.sep)) {
    throw new Error(
      `Spec file "${canonicalSpec}" is not under project directory "${canonicalProject}"`
    )
  }
}

export const createInitialState = (
  sessionId: SessionId,
  specPath: string,
  projectDir: string,
  runtimeDir: string,
  resolvedConfig: ResolvedConfig,
): SwarmState => {
  const now = new Date().toISOString()

  return {
    schemaVersion: 1,
    sessionId,
    specPath,
    projectDir,
    worktreeBranch: `swarm/${sessionId}`,
    runtimeDir,
    configResolvedFrom: resolvedConfig.resolvedFrom,
    status: 'running',
    config: resolvedConfig.config,
    currentPhase: 'init',
    currentIteration: 0,
    currentSpecItem: 0,
    totalSpecItems: 1,
    completedPhases: [],
    phaseResults: {},
    errors: [],
    startedAt: now,
    updatedAt: now,
  }
}

export const createStatusSnapshot = (state: SwarmState): CliStatusSnapshot => {
  const worktreePath = state.worktreePath

  return {
    sessionId: state.sessionId,
    status: state.status,
    currentPhase: state.currentPhase,
    nextPhase: getNextPhase(state),
    specPath: state.specPath,
    projectDir: state.projectDir,
    runtimeDir: state.runtimeDir,
    worktreePath,
    worktreeBranch: state.worktreeBranch,
    worktreeExists: typeof worktreePath === 'string' ? fs.existsSync(worktreePath) : false,
    prNumber: state.prNumber,
    prUrl: state.prUrl,
    completedPhases: [...state.completedPhases],
    configResolvedFrom: state.configResolvedFrom,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt,
    failureReason: state.failureReason,
    runtimeOwnership: CLI_RUNTIME_OWNERSHIP,
  }
}

export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

const savePhaseResult = (
  stateManager: SwarmStateManager,
  phase: TopLevelPhase,
  result: unknown,
): SwarmState => {
  return updateState(stateManager, (state) => ({
    ...state,
    currentPhase: phase,
    completedPhases: appendCompletedPhase(state.completedPhases, phase),
    phaseResults: { ...state.phaseResults, [phase]: result },
    updatedAt: new Date().toISOString(),
    ...maybeExtractPrState(phase, result),
  }))
}

const markSessionTerminal = (
  stateManager: SwarmStateManager,
  status: Extract<SessionStatus, 'completed' | 'failed' | 'paused'>,
  options?: { failureReason?: string; clearRuntimeRefs?: boolean },
): SwarmState => {
  return updateState(stateManager, (state) => ({
    ...state,
    status,
    completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : state.completedAt,
    failureReason: status === 'completed' ? undefined : options?.failureReason,
    worktreePath: options?.clearRuntimeRefs ? undefined : state.worktreePath,
    worktreeBranch: options?.clearRuntimeRefs ? undefined : state.worktreeBranch,
    updatedAt: new Date().toISOString(),
  }))
}

const cleanupRuntimeArtifacts = async (
  emitter: SessionContext['emitter'],
  sessionId: SessionId,
  stateManager: SwarmStateManager,
  baseProjectDir: string,
  runtimeDir: string,
  shouldCleanupWorktree: boolean,
): Promise<void> => {
  if (shouldCleanupWorktree) {
    try {
      const { worktreeBranch } = readValidState(stateManager)
      if (typeof worktreeBranch === 'string') {
        try {
          const { removeWorktree } = await import('./git/git-operations.js')
          await removeWorktree(worktreeBranch, baseProjectDir)
          updateState(stateManager, (state) => ({
            ...state,
            worktreePath: undefined,
            worktreeBranch: undefined,
            updatedAt: new Date().toISOString(),
          }))
        } catch (error) {
          const message = `WARNING: Worktree cleanup failed: ${formatError(error)}`
          process.stderr.write(`${message}\n`)
          emitWarningEvent(emitter, sessionId, 'cli.worktree-cleanup', message)
        }
      }
    } catch (error) {
      const message = `WARNING: Worktree cleanup skipped: ${formatError(error)}`
      process.stderr.write(`${message}\n`)
      emitWarningEvent(emitter, sessionId, 'cli.worktree-cleanup', message)
    }
  }

  try {
    fs.mkdirSync(runtimeDir, { recursive: true })
  } catch (error) {
    const message = `WARNING: runtime log retention check failed: ${formatError(error)}`
    process.stderr.write(`${message}\n`)
    emitWarningEvent(emitter, sessionId, 'cli.runtime-retention', message)
  }
}

const ensureWorktreeContext = async (
  sessionId: SessionId,
  stateManager: SwarmStateManager,
  baseProjectDir: string,
  specPath: string,
): Promise<{ projectDir: string; specPath: string; worktreeBranch: string }> => {
  const currentState = readValidState(stateManager)
  const worktreeBranch = currentState.worktreeBranch ?? `swarm/${sessionId}`
  const worktreePath = currentState.worktreePath

  if (typeof worktreePath === 'string' && fs.existsSync(worktreePath)) {
    return {
      projectDir: worktreePath,
      specPath: getWorktreeSpecPath(worktreePath, baseProjectDir, specPath),
      worktreeBranch,
    }
  }

  const { createWorktree } = await import('./git/git-operations.js')
  const created = await createWorktree(sessionId, baseProjectDir, worktreeBranch)

  updateState(stateManager, (state) => ({
    ...state,
    worktreePath: created.worktreePath,
    worktreeBranch: created.branch,
    updatedAt: new Date().toISOString(),
  }))

  return {
    projectDir: created.worktreePath,
    specPath: getWorktreeSpecPath(created.worktreePath, baseProjectDir, specPath),
    worktreeBranch: created.branch,
  }
}

const runSession = async (
  input: {
    sessionId: SessionId
    specPath: string
    projectDir: string
    resolvedConfig: ResolvedConfig
    runtimeDir: string
    dryRun: boolean
    existingState?: SwarmState
  },
): Promise<number> => {
  const runtimeRoot = path.dirname(input.runtimeDir)
  pruneRuntimeSessionLogs(runtimeRoot, input.sessionId)
  fs.mkdirSync(input.runtimeDir, { recursive: true })
  process.env.SWARM_DEBUG_DIR = input.runtimeDir

  const { createEventEmitter } = await import('./core/event-emitter.js')
  const { createStateManager } = await import('./core/state-manager.js')
  const { createDriverRegistry } = await import('./drivers/driver-registry.js')
  const { runPlanPhase } = await import('./phases/plan/plan-phase.js')
  const { runCodePhase } = await import('./phases/code/code-phase.js')
  const { runDocsPhase } = await import('./phases/docs/docs-phase.js')

  const eventLogPath = path.join(input.runtimeDir, 'events.ndjson')
  const emitter = createEventEmitter(input.sessionId, { logFilePath: eventLogPath })
  const stateManager = createStateManager(input.sessionId, { tmpDir: input.runtimeDir })
  const registry = createDriverRegistry(input.resolvedConfig.config, emitter)

  stateManager.acquireLock()

  if (input.existingState === undefined) {
    stateManager.save(createInitialState(
      input.sessionId,
      input.specPath,
      input.projectDir,
      input.runtimeDir,
      input.resolvedConfig,
    ))
  } else {
    stateManager.save({
      ...input.existingState,
      config: input.resolvedConfig.config,
      configResolvedFrom: input.resolvedConfig.resolvedFrom,
      runtimeDir: input.runtimeDir,
      status: 'running',
      completedAt: undefined,
      failureReason: undefined,
      updatedAt: new Date().toISOString(),
    })
  }

  const controller = new AbortController()
  const onSignal = () => {
    controller.abort()
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  let exitCode = 1
  let shouldCleanupWorktree = false

  try {
    const currentState = readValidState(stateManager)

    const ctx: SessionContext = {
      sessionId: input.sessionId,
      config: input.resolvedConfig,
      emitter,
      state: stateManager,
      specPath: input.specPath,
      projectDir: input.projectDir,
      dryRun: input.dryRun,
      worktreeBranch: currentState.worktreeBranch,
    }

    if (input.existingState === undefined) {
        emitter.emit({
          type: 'session:start',
          timestamp: new Date().toISOString(),
          sessionId: input.sessionId,
          data: {
            specPath: input.specPath,
            projectDir: input.projectDir,
            eventLogPath,
            retention: EVENT_LOG_RETENTION,
          },
        })
      }
    let planResult = readPlanPhaseResult(currentState)
    if (planResult === null) {
      const specContent = fs.readFileSync(input.specPath, 'utf-8')
      planResult = await runPlanPhase(ctx, registry, specContent, controller.signal)
      savePhaseResult(stateManager, 'plan', planResult)
    }

    if (input.dryRun) {
      printJson(planResult)
      markSessionTerminal(stateManager, 'completed')
      exitCode = 0
      return exitCode
    }

    const nextPhase = getNextPhase(readValidState(stateManager))

    if (nextPhase === 'code' || nextPhase === 'docs') {
      const worktreeContext = await ensureWorktreeContext(
        input.sessionId,
        stateManager,
        input.projectDir,
        input.specPath,
      )
      ctx.projectDir = worktreeContext.projectDir
      ctx.specPath = worktreeContext.specPath
      ctx.worktreeBranch = worktreeContext.worktreeBranch
    }

    let codeResult = readCodePhaseResult(readValidState(stateManager))
    if (codeResult === null) {
      if (typeof ctx.projectDir !== 'string' || ctx.projectDir === input.projectDir) {
        const worktreeContext = await ensureWorktreeContext(
          input.sessionId,
          stateManager,
          input.projectDir,
          input.specPath,
        )
        ctx.projectDir = worktreeContext.projectDir
        ctx.specPath = worktreeContext.specPath
        ctx.worktreeBranch = worktreeContext.worktreeBranch
      }

      codeResult = await runCodePhase(ctx, registry, planResult, controller.signal)
      savePhaseResult(stateManager, 'code', codeResult)
    } else if (typeof ctx.projectDir === 'string' && ctx.projectDir === input.projectDir) {
      const { worktreePath } = readValidState(stateManager)
      if (typeof worktreePath === 'string' && fs.existsSync(worktreePath)) {
        ctx.projectDir = worktreePath
        ctx.specPath = getWorktreeSpecPath(worktreePath, input.projectDir, input.specPath)
      }
    }

    const docsDone = readValidState(stateManager).completedPhases.includes('docs')
    if (!docsDone) {
      await runDocsPhase(ctx, registry, controller.signal)
    }

    emitter.emit({
      type: 'session:end',
      timestamp: new Date().toISOString(),
      sessionId: input.sessionId,
      data: {
        success: codeResult?.success ?? true,
        durationMs: Date.now() - Date.parse(currentState.startedAt),
      },
    })

    markSessionTerminal(stateManager, 'completed')
    shouldCleanupWorktree = true
    exitCode = codeResult?.success === false ? 1 : 0
    return exitCode
  } catch (error) {
    const status: Extract<SessionStatus, 'paused' | 'failed'> = isAbortError(controller.signal, error)
      ? 'paused'
      : 'failed'
    try {
      markSessionTerminal(stateManager, status, { failureReason: formatError(error) })
    } catch (stateError) {
      const message = `WARNING: failed to persist terminal session state: ${formatError(stateError)}`
      process.stderr.write(`${message}\n`)
      emitWarningEvent(emitter, input.sessionId, 'cli.state-terminal', message)
    }

    emitter.emit({
      type: 'session:error',
      timestamp: new Date().toISOString(),
      sessionId: input.sessionId,
      data: { reason: formatError(error) },
    })
    process.stderr.write(`Error: ${formatError(error)}\n`)
    shouldCleanupWorktree = status === 'failed'
    exitCode = 1
    return exitCode
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await cleanupRuntimeArtifacts(emitter, input.sessionId, stateManager, input.projectDir, input.runtimeDir, shouldCleanupWorktree)
    stateManager.releaseLock()
  }
}

export const loadSessionState = async (
  sessionId: SessionId,
  projectDir: string,
): Promise<SwarmState> => {
  const runtimeDir = getRuntimeDir(projectDir, sessionId)
  const { createStateManager } = await import('./core/state-manager.js')
  const stateManager = createStateManager(sessionId, { tmpDir: runtimeDir })
  const result = stateManager.load()

  if (!result.found) {
    throw new Error(`No state found for session "${sessionId}" in "${runtimeDir}"`)
  }

  if (!result.valid) {
    throw new Error(`Invalid state for session "${sessionId}": ${result.error}`)
  }

  return result.state
}

export const runCommand = async (options: Record<string, unknown>): Promise<number> => {
  const { createSessionId } = await import('./core/types.js')
  const { resolveSwarmConfig } = await import('./config/config-resolver.js')

  const sessionId = createSessionId(getRequiredString(options, 'session'))
  const specPath = path.resolve(getRequiredString(options, 'spec'))
  const projectDir = path.resolve(getRequiredString(options, 'projectDir'))
  const configPathValue = options['config']
  const configPath = typeof configPathValue === 'string' ? configPathValue : undefined
  const dryRun = options['dryRun'] === true

  validateProjectDir(projectDir)
  validateSpecContainment(specPath, projectDir)

  const resolvedConfig = resolveSwarmConfig(projectDir, configPath)
  const runtimeDir = getRuntimeDir(projectDir, sessionId)

  return runSession({
    sessionId,
    specPath,
    projectDir,
    resolvedConfig,
    runtimeDir,
    dryRun,
  })
}

export const resumeCommand = async (options: Record<string, unknown>): Promise<number> => {
  const { createSessionId } = await import('./core/types.js')
  const { resolveSwarmConfig } = await import('./config/config-resolver.js')

  const sessionId = createSessionId(getRequiredString(options, 'session'))
  const projectDir = path.resolve(getRequiredString(options, 'projectDir'))

  validateProjectDir(projectDir)

  const existingState = await loadSessionState(sessionId, projectDir)
  if (existingState.status === 'completed') {
    throw new Error(`Session "${sessionId}" is already completed`)
  }

  const resolvedConfig = resolveSwarmConfig(projectDir)

  return runSession({
    sessionId,
    specPath: existingState.specPath,
    projectDir,
    resolvedConfig,
    runtimeDir: getRuntimeDir(projectDir, sessionId),
    dryRun: false,
    existingState,
  })
}

export const statusCommand = async (options: Record<string, unknown>): Promise<CliStatusSnapshot> => {
  const { createSessionId } = await import('./core/types.js')

  const sessionId = createSessionId(getRequiredString(options, 'session'))
  const projectDir = path.resolve(getRequiredString(options, 'projectDir'))
  const state = await loadSessionState(sessionId, projectDir)
  const snapshot = createStatusSnapshot(state)

  printJson(snapshot)
  return snapshot
}

export const configCommand = async (options: Record<string, unknown>): Promise<ResolvedConfig> => {
  const { createResolvedConfigSnapshot, resolveSwarmConfig } = await import('./config/config-resolver.js')

  const projectDir = path.resolve(getRequiredString(options, 'projectDir'))
  const configPathValue = options['config']
  const configPath = typeof configPathValue === 'string' ? configPathValue : undefined
  validateProjectDir(projectDir)
  const resolvedConfig = resolveSwarmConfig(projectDir, configPath)

  printJson({
    ...createResolvedConfigSnapshot(projectDir, resolvedConfig),
    runtimeOwnership: CLI_RUNTIME_OWNERSHIP,
  })

  return resolvedConfig
}

const isDirectExecution = process.argv[1] !== undefined &&
  (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))

if (isDirectExecution) {
  const { Command } = await import('commander')

  const runAndExit = async (
    options: Record<string, unknown>,
    command: (options: Record<string, unknown>) => Promise<number | CliStatusSnapshot | ResolvedConfig>,
  ) => {
    try {
      const result = await command(options)
      if (typeof result === 'number') {
        process.exit(result)
      }

      process.exit(0)
    } catch (error) {
      process.stderr.write(`Error: ${formatError(error)}\n`)
      process.exit(1)
    }
  }

  const program = new Command()
    .name('swarm')
    .description('AI agent orchestrator for autonomous software development')
    .version('0.1.0')

  program
    .command('run')
    .description('Execute a swarm session')
    .requiredOption('--session <name>', 'Session identifier')
    .requiredOption('--spec <path>', 'Path to the spec file')
    .requiredOption('--project-dir <path>', 'Target project directory')
    .option('--config <path>', 'Explicit config file path')
    .option('--dry-run', 'Validate config and print plan without running')
    .action(async (options: Record<string, unknown>) => {
      await runAndExit(options, runCommand)
    })

  program
    .command('resume')
    .description('Resume an interrupted session from the last completed top-level phase')
    .requiredOption('--session <name>', 'Session identifier')
    .requiredOption('--project-dir <path>', 'Target project directory')
    .action(async (options: Record<string, unknown>) => {
      await runAndExit(options, resumeCommand)
    })

  program
    .command('status')
    .description('Show persisted session status')
    .requiredOption('--session <name>', 'Session identifier')
    .requiredOption('--project-dir <path>', 'Target project directory')
    .action(async (options: Record<string, unknown>) => {
      await runAndExit(options, statusCommand)
    })

  program
    .command('config')
    .description('Print resolved configuration and CLI runtime ownership')
    .requiredOption('--project-dir <path>', 'Target project directory')
    .option('--config <path>', 'Explicit config file path')
    .action(async (options: Record<string, unknown>) => {
      await runAndExit(options, configCommand)
    })

  program.parse()
}
