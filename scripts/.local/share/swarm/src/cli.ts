import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Validation helpers (exported for testability — SF-001)
// ---------------------------------------------------------------------------

const SYSTEM_ROOTS = new Set(['/', '/etc', '/var', '/usr'])

export function validateProjectDir(dir: string): void {
  const canonical = fs.realpathSync(dir)
  if (SYSTEM_ROOTS.has(canonical)) {
    throw new Error(
      `Project directory must not be a system root: ${canonical}`
    )
  }
  const stat = fs.statSync(canonical)
  if (!stat.isDirectory()) {
    throw new Error(
      `Project directory is not a directory: ${canonical}`
    )
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

// ---------------------------------------------------------------------------
// CLI entry point — commander setup (lightweight for now)
// ---------------------------------------------------------------------------

// Only run the CLI if this module is executed directly (not imported in tests)
const isDirectExecution = process.argv[1] &&
  (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))

if (isDirectExecution) {
  const { Command } = await import('commander')
  const { createSessionId } = await import('./core/types.js')
  const { resolveSwarmConfig } = await import('./config/config-resolver.js')
  const { createEventEmitter } = await import('./core/event-emitter.js')
  const { createStateManager } = await import('./core/state-manager.js')
  const { createDriverRegistry } = await import('./drivers/driver-registry.js')
  const { runPlanPhase } = await import('./phases/plan/plan-phase.js')
  const { runCodePhase } = await import('./phases/code/code-phase.js')
  const { runDocsPhase } = await import('./phases/docs/docs-phase.js')

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
      try {
        // Parse and validate
        const sessionId = createSessionId(options['session'] as string)
        const specPath = path.resolve(options['spec'] as string)
        const projectDir = path.resolve(options['projectDir'] as string)
        const configPath = options['config'] as string | undefined
        const dryRun = options['dryRun'] === true

        validateProjectDir(projectDir)
        validateSpecContainment(specPath, projectDir)

        // Resolve config
        const resolvedConfig = resolveSwarmConfig(projectDir, configPath)

        // Runtime directory — project-local, deterministic across execution contexts
        const runtimeDir = path.join(projectDir, '.swarm', 'run', sessionId)
        fs.mkdirSync(runtimeDir, { recursive: true })

        // Expose runtime dir so claude-driver writes NDJSON logs here
        process.env.SWARM_DEBUG_DIR = runtimeDir

        // Create emitter + state manager
        const emitter = createEventEmitter(sessionId)
        const state = createStateManager(sessionId, { tmpDir: runtimeDir })

        // Acquire lock
        state.acquireLock()

        // Build session context
        const ctx: import('./core/types.js').SessionContext = {
          sessionId,
          config: resolvedConfig,
          emitter,
          state,
          specPath,
          projectDir,
          dryRun,
        }

        // Initialize state
        const swarmState = {
          schemaVersion: 1 as const,
          sessionId,
          specPath,
          projectDir,
          config: resolvedConfig.config,
          currentPhase: 'init' as const,
          currentIteration: 0,
          currentSpecItem: 0,
          totalSpecItems: 1,
          completedPhases: [] as string[],
          phaseResults: {},
          errors: [],
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        state.save(swarmState as import('./core/types.js').SwarmState)

        // Setup AbortController for SIGINT/SIGTERM
        const controller = new AbortController()
        const onSignal = () => { controller.abort() }
        process.on('SIGINT', onSignal)
        process.on('SIGTERM', onSignal)

        // Emit session:start
        emitter.emit({
          type: 'session:start',
          timestamp: new Date().toISOString(),
          sessionId,
          data: { specPath, projectDir },
        })

        const signal = controller.signal

        const worktreeBranch = `swarm/${sessionId}`

        let exitCode = 1
        let worktreeCreated = false

        try {
          // Read spec file
          const specContent = fs.readFileSync(specPath, 'utf-8')

          // Create driver registry
          const registry = createDriverRegistry(resolvedConfig.config, emitter)

          // Helper to persist phase result to state
          const savePhaseResult = (phase: import('./core/types.js').Phase, result: unknown) => {
            const lr = state.load()
            if (lr.found && 'valid' in lr && lr.valid) {
              const s = lr.state
              s.currentPhase = phase
              s.completedPhases = [...s.completedPhases, phase]
              s.phaseResults = { ...s.phaseResults, [phase]: result }
              s.updatedAt = new Date().toISOString()
              state.save(s)
            }
          }

          // Phase 1: Plan
          const planResult = await runPlanPhase(ctx, registry, specContent, signal)
          savePhaseResult('plan', planResult)

          if (dryRun) {
            process.stdout.write(JSON.stringify(planResult, null, 2) + '\n')
            emitter.emit({
              type: 'session:end',
              timestamp: new Date().toISOString(),
              sessionId,
              data: { success: true, durationMs: Date.now() - Date.parse(swarmState.startedAt) },
            })
            return
          }

          // Create worktree for isolation (before TDD)
          const { createWorktree } = await import('./git/git-operations.js')
          const { worktreePath } = await createWorktree(sessionId, projectDir, worktreeBranch)
          worktreeCreated = true
          ctx.projectDir = worktreePath
          ctx.specPath = path.join(worktreePath, path.relative(projectDir, specPath))
          ctx.worktreeBranch = worktreeBranch

          // Persist worktree info in state
          const wtLoadResult = state.load()
          if (wtLoadResult.found && 'valid' in wtLoadResult && wtLoadResult.valid) {
            const s = wtLoadResult.state
            s.worktreePath = worktreePath
            s.projectDir = worktreePath
            s.updatedAt = new Date().toISOString()
            state.save(s)
          }

          // Phase 2: Code (TDD runs per-wave inside the DAG executor)
          const codeResult = await runCodePhase(ctx, registry, planResult, signal)
          savePhaseResult('code', codeResult)

          // Phase 3: Docs
          const docsResult = await runDocsPhase(ctx, registry, signal)
          savePhaseResult('docs', docsResult)

          // Final push — code commit + docs commit may still be local-only.
          // Non-fatal: no remote configured is fine (local-only workflow).
          try {
            const { spawn: spawnChild } = await import('node:child_process')
            await new Promise<void>((resolve, reject) => {
              const proc = spawnChild('git', ['push'], { cwd: ctx.projectDir })
              let stderr = ''
              proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
              proc.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(stderr))
              })
              proc.on('error', (err) => reject(err))
            })
          } catch (err) {
            process.stderr.write(`WARNING: git push skipped (no remote?): ${(err as Error).message}\n`)
          }

          // Session end
          emitter.emit({
            type: 'session:end',
            timestamp: new Date().toISOString(),
            sessionId,
            data: { success: codeResult.success, durationMs: Date.now() - Date.parse(swarmState.startedAt) },
          })

          process.stdout.write(`${JSON.stringify({
            success: codeResult.success,
            deliveryReportJsonPath: docsResult.deliveryReportJsonPath,
            deliveryReportMarkdownPath: docsResult.deliveryReportMarkdownPath,
            iterationLogJsonPath: docsResult.iterationLogJsonPath,
            iterationLogMarkdownPath: docsResult.iterationLogMarkdownPath,
          }, null, 2)}\n`)

          exitCode = codeResult.success ? 0 : 1
        } catch (err) {
          emitter.emit({
            type: 'session:error',
            timestamp: new Date().toISOString(),
            sessionId,
            data: { reason: (err as Error).message },
          })
          process.stderr.write(`Error: ${(err as Error).message}\n`)
          exitCode = 1
        } finally {
          // Clean up worktree — MUST complete before process.exit().
          // Timeout prevents hanging forever on stuck git/wt processes.
          if (worktreeCreated) {
            const CLEANUP_TIMEOUT_MS = 15_000
            try {
              const { removeWorktree } = await import('./git/git-operations.js')
              await Promise.race([
                removeWorktree(worktreeBranch, projectDir),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Worktree cleanup timed out')), CLEANUP_TIMEOUT_MS)
                ),
              ])
            } catch (err) {
              process.stderr.write(`WARNING: Worktree cleanup failed: ${(err as Error).message}\n`)
            }
          }

          // Clean up NDJSON debug logs on success (keep on failure for debugging)
          if (exitCode === 0) {
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

          process.off('SIGINT', onSignal)
          process.off('SIGTERM', onSignal)
          state.releaseLock()
        }

        process.exit(exitCode)
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`)
        process.exit(1)
      }
    })

  program
    .command('resume')
    .description('Resume an interrupted session')
    .requiredOption('--session <name>', 'Session identifier')
    .requiredOption('--project-dir <path>', 'Target project directory')
    .action((_options: Record<string, unknown>) => {
      console.error('swarm resume: not yet implemented')
      process.exit(1)
    })

  program
    .command('status')
    .description('Show status of a session')
    .requiredOption('--session <name>', 'Session identifier')
    .action((_options: Record<string, unknown>) => {
      console.error('swarm status: not yet implemented')
      process.exit(1)
    })

  program
    .command('config')
    .description('Print resolved configuration')
    .requiredOption('--project-dir <path>', 'Target project directory')
    .action((_options: Record<string, unknown>) => {
      console.error('swarm config: not yet implemented')
      process.exit(1)
    })

  program.parse()
}
