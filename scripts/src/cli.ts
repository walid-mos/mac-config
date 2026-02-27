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
    .action((_options: Record<string, unknown>) => {
      // Run handler — to be implemented by orchestration spec
      console.error('swarm run: not yet implemented')
      process.exit(1)
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
