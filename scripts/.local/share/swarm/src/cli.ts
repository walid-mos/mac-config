import * as path from 'node:path'
import { runSession } from './cli-runtime.js'
import { validateProjectDir, validateSpecContainment } from './cli-validation.js'

export { validateProjectDir, validateSpecContainment }

// ---------------------------------------------------------------------------
// CLI entry point — commander setup (lightweight for now)
// ---------------------------------------------------------------------------

// Only run the CLI if this module is executed directly (not imported in tests)
const isDirectExecution = process.argv[1] &&
  (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))

if (isDirectExecution) {
  const { Command } = await import('commander')

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
        const specPath = path.resolve(options['spec'] as string)
        const projectDir = path.resolve(options['projectDir'] as string)
        const configPath = options['config'] as string | undefined
        const dryRun = options['dryRun'] === true

        validateProjectDir(projectDir)
        validateSpecContainment(specPath, projectDir)
        const exitCode = await runSession({
          session: options['session'] as string,
          specPath,
          projectDir,
          configPath,
          dryRun,
        })
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
