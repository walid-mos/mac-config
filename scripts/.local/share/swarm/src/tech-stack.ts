// === Tech Stack Detection (Spec 3 — FR-9) ===

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// === Types ===

export interface TechStack {
  languages: string[]
  frameworks: string[]
  testRunner: 'vitest' | 'jest' | 'playwright' | null
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  buildTool: 'vite' | 'webpack' | 'turbopack' | null
  configFiles: string[]
  testCommand: string
}

// === Constants ===

const MAX_FILE_SIZE = 1_048_576 // 1MB

const LOCK_FILE_MAP: ReadonlyArray<[string, TechStack['packageManager']]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
]

const TEST_RUNNER_CONFIGS: ReadonlyArray<[string, TechStack['testRunner']]> = [
  ['vitest.config.ts', 'vitest'],
  ['vitest.config.js', 'vitest'],
  ['vitest.config.mts', 'vitest'],
  ['jest.config.ts', 'jest'],
  ['jest.config.js', 'jest'],
  ['jest.config.mjs', 'jest'],
  ['playwright.config.ts', 'playwright'],
  ['playwright.config.js', 'playwright'],
]

const BUILD_TOOL_CONFIGS: ReadonlyArray<[string, NonNullable<TechStack['buildTool']>]> = [
  ['vite.config.ts', 'vite'],
  ['vite.config.js', 'vite'],
  ['vite.config.mts', 'vite'],
  ['webpack.config.js', 'webpack'],
  ['webpack.config.ts', 'webpack'],
]

const FRAMEWORK_PACKAGES: ReadonlyArray<[string, string]> = [
  ['react', 'react'],
  ['next', 'next'],
  ['astro', 'astro'],
  ['vue', 'vue'],
  ['express', 'express'],
  ['fastify', 'fastify'],
  ['@angular/core', 'angular'],
  ['svelte', 'svelte'],
]

const DEV_DEP_TEST_RUNNERS: ReadonlyArray<[string, TechStack['testRunner']]> = [
  ['vitest', 'vitest'],
  ['jest', 'jest'],
  ['@playwright/test', 'playwright'],
]

const CONFIG_FILES_TO_CHECK: readonly string[] = [
  'tsconfig.json',
  'vitest.config.ts',
  'vitest.config.js',
  'jest.config.ts',
  'jest.config.js',
  'playwright.config.ts',
  'playwright.config.js',
  'vite.config.ts',
  'vite.config.js',
  'webpack.config.js',
  'webpack.config.ts',
  '.eslintrc.json',
  '.eslintrc.js',
  'eslint.config.js',
  'biome.json',
  'biome.jsonc',
  'tailwind.config.js',
  'tailwind.config.ts',
]

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
}

// === Helpers ===

function checkFileSize(filePath: string): void {
  const stats = statSync(filePath)
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds 1MB size limit: ${filePath} (${stats.size} bytes)`)
  }
}

function detectPackageManager(projectDir: string): TechStack['packageManager'] {
  for (const [lockFile, manager] of LOCK_FILE_MAP) {
    if (existsSync(join(projectDir, lockFile))) {
      return manager
    }
  }
  return 'npm'
}

function detectTestRunner(
  projectDir: string,
  devDependencies: Record<string, string>
): TechStack['testRunner'] {
  for (const [configFile, runner] of TEST_RUNNER_CONFIGS) {
    if (existsSync(join(projectDir, configFile))) {
      return runner
    }
  }
  for (const [depName, runner] of DEV_DEP_TEST_RUNNERS) {
    if (depName in devDependencies) {
      return runner
    }
  }
  return null
}

function detectBuildTool(projectDir: string): TechStack['buildTool'] {
  for (const [configFile, tool] of BUILD_TOOL_CONFIGS) {
    if (existsSync(join(projectDir, configFile))) {
      return tool
    }
  }
  return null
}

function detectFrameworks(
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>
): string[] {
  const allDeps = { ...dependencies, ...devDependencies }
  const frameworks: string[] = []
  for (const [pkg, name] of FRAMEWORK_PACKAGES) {
    if (pkg in allDeps) {
      frameworks.push(name)
    }
  }
  return frameworks
}

function detectLanguages(projectDir: string): string[] {
  const srcDir = join(projectDir, 'src')
  let entries: string[]
  try {
    entries = readdirSync(srcDir) as unknown as string[]
  } catch {
    return []
  }

  const languageSet = new Set<string>()
  for (const entry of entries) {
    const dotIndex = entry.lastIndexOf('.')
    if (dotIndex === -1) continue
    const ext = entry.slice(dotIndex)
    const language = EXTENSION_LANGUAGE_MAP[ext]
    if (language) {
      languageSet.add(language)
    }
  }
  return [...languageSet]
}

function detectConfigFiles(projectDir: string): string[] {
  const found: string[] = []
  for (const configFile of CONFIG_FILES_TO_CHECK) {
    if (existsSync(join(projectDir, configFile))) {
      found.push(configFile)
    }
  }
  return found
}

function resolveTestCommand(
  testRunner: TechStack['testRunner'],
  packageManager: TechStack['packageManager']
): string {
  if (testRunner) {
    return `${testRunner} run`
  }
  return `${packageManager} test`
}

// === API ===

export async function detectTechStack(projectDir: string): Promise<TechStack> {
  const packageJsonPath = join(projectDir, 'package.json')

  let dependencies: Record<string, string> = {}
  let devDependencies: Record<string, string> = {}

  if (existsSync(packageJsonPath)) {
    checkFileSize(packageJsonPath)
    const raw = readFileSync(packageJsonPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    }
    dependencies = parsed.dependencies ?? {}
    devDependencies = parsed.devDependencies ?? {}
  }

  const packageManager = detectPackageManager(projectDir)
  const testRunner = detectTestRunner(projectDir, devDependencies)
  const buildTool = detectBuildTool(projectDir)
  const frameworks = detectFrameworks(dependencies, devDependencies)
  const languages = detectLanguages(projectDir)
  const configFiles = detectConfigFiles(projectDir)
  const testCommand = resolveTestCommand(testRunner, packageManager)

  return {
    languages,
    frameworks,
    testRunner,
    packageManager,
    buildTool,
    configFiles,
    testCommand,
  }
}
