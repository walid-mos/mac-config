import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Phase, SessionContext, SwarmState } from './core/types.js'
import { createSessionId } from './core/types.js'
import { resolveSwarmConfig } from './config/config-resolver.js'
import { createEventEmitter } from './core/event-emitter.js'
import { createStateManager } from './core/state-manager.js'
import { createDriverRegistry } from './drivers/driver-registry.js'
import { runPlanPhase } from './phases/plan/plan-phase.js'
import { runCodePhase } from './phases/code/code-phase.js'
import { runDocsPhase } from './phases/docs/docs-phase.js'
import { createWorktree, removeWorktree } from './git/git-operations.js'
import { spawnNamedCommand } from './utils/process.js'

const cleanSuccessfulNdjsonLogs = (runtimeDir: string): void => {
  try {
    const entries = fs.readdirSync(runtimeDir)
    for (const entry of entries) {
      if (entry.startsWith('swarm-agent-') && entry.endsWith('.ndjson')) {
        fs.unlinkSync(path.join(runtimeDir, entry))
      }
    }
  } catch (err) {
    process.stderr.write(`WARNING: NDJSON cleanup failed: ${(err as Error).message}\n`)
  }
}

const savePhaseResult = (ctx: SessionContext, phase: Extract<Phase, 'plan' | 'code'>, result: unknown): void => {
  const loadResult = ctx.state.load()
  if (!loadResult.found || !('valid' in loadResult) || !loadResult.valid) {
    return
  }

  const state = loadResult.state
  state.currentPhase = phase
  state.completedPhases = [...state.completedPhases, phase]
  state.phaseResults = { ...state.phaseResults, [phase]: result }
  state.updatedAt = new Date().toISOString()
  ctx.state.save(state)
}

const createInitialState = (ctx: SessionContext): SwarmState => ({
  schemaVersion: 1,
  sessionId: ctx.sessionId,
  specPath: ctx.specPath,
  projectDir: ctx.projectDir,
  runtimeDir: path.join(ctx.projectDir, '.swarm', 'run', ctx.sessionId),
  configResolvedFrom: ctx.config.resolvedFrom,
  status: 'running',
  worktreeBranch: `swarm/${ctx.sessionId}`,
  config: ctx.config.config,
  currentPhase: 'init',
  currentIteration: 0,
  currentSpecItem: 0,
  totalSpecItems: 1,
  completedPhases: [],
  phaseResults: {},
  errors: [],
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export interface RunSessionOptions {
  session: string
  specPath: string
  projectDir: string
  configPath?: string
  dryRun: boolean
}

export const runSession = async ({
  session,
  specPath,
  projectDir,
  configPath,
  dryRun,
}: RunSessionOptions): Promise<number> => {
  const sessionId = createSessionId(session)
  const resolvedConfig = resolveSwarmConfig(projectDir, configPath)
  const runtimeDir = path.join(projectDir, '.swarm', 'run', sessionId)
  fs.mkdirSync(runtimeDir, { recursive: true })
  process.env.SWARM_DEBUG_DIR = runtimeDir

  const emitter = createEventEmitter(sessionId)
  const state = createStateManager(sessionId, { tmpDir: runtimeDir })
  state.acquireLock()

  const ctx: SessionContext = {
    sessionId,
    config: resolvedConfig,
    emitter,
    state,
    specPath,
    projectDir,
    dryRun,
  }

  const swarmState = createInitialState(ctx)
  state.save(swarmState)

  const controller = new AbortController()
  const onSignal = (): void => {
    controller.abort()
  }

  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  emitter.emit({
    type: 'session:start',
    timestamp: new Date().toISOString(),
    sessionId,
    data: { specPath, projectDir },
  })

  const registry = createDriverRegistry(resolvedConfig.config, emitter)
  const worktreeBranch = `swarm/${sessionId}`
  let worktreeCreated = false
  let exitCode = 1

  try {
    const specContent = fs.readFileSync(specPath, 'utf-8')
    const planResult = await runPlanPhase(ctx, registry, specContent, controller.signal)
    savePhaseResult(ctx, 'plan', planResult)

    if (dryRun) {
      process.stdout.write(JSON.stringify(planResult, null, 2) + '\n')
      emitter.emit({
        type: 'session:end',
        timestamp: new Date().toISOString(),
        sessionId,
        data: { success: true, durationMs: Date.now() - Date.parse(swarmState.startedAt) },
      })
      return 0
    }

    const { worktreePath } = await createWorktree(sessionId, projectDir, worktreeBranch)
    worktreeCreated = true
    ctx.projectDir = worktreePath
    ctx.specPath = path.join(worktreePath, path.relative(projectDir, specPath))
    ctx.worktreeBranch = worktreeBranch

    const worktreeState = state.load()
    if (worktreeState.found && 'valid' in worktreeState && worktreeState.valid) {
      worktreeState.state.worktreePath = worktreePath
      worktreeState.state.projectDir = worktreePath
      worktreeState.state.updatedAt = new Date().toISOString()
      state.save(worktreeState.state)
    }

    const codeResult = await runCodePhase(ctx, registry, planResult, controller.signal)
    savePhaseResult(ctx, 'code', codeResult)
    await runDocsPhase(ctx, registry, controller.signal)

    try {
      await spawnNamedCommand('git', ['push'], ctx.projectDir)
    } catch (err) {
      process.stderr.write(`WARNING: git push skipped (no remote?): ${(err as Error).message}\n`)
    }

    emitter.emit({
      type: 'session:end',
      timestamp: new Date().toISOString(),
      sessionId,
      data: { success: codeResult.success, durationMs: Date.now() - Date.parse(swarmState.startedAt) },
    })

    exitCode = codeResult.success ? 0 : 1
    return exitCode
  } catch (err) {
    emitter.emit({
      type: 'session:error',
      timestamp: new Date().toISOString(),
      sessionId,
      data: { reason: (err as Error).message },
    })
    process.stderr.write(`Error: ${(err as Error).message}\n`)
    exitCode = 1
    return exitCode
  } finally {
    if (worktreeCreated) {
      try {
        await Promise.race([
          removeWorktree(worktreeBranch, projectDir),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Worktree cleanup timed out')), 15_000)
          }),
        ])
      } catch (err) {
        process.stderr.write(`WARNING: Worktree cleanup failed: ${(err as Error).message}\n`)
      }
    }

    if (exitCode === 0) {
      cleanSuccessfulNdjsonLogs(runtimeDir)
    }

    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    state.releaseLock()
  }
}
