// === Tech Stack Types & Project Context ===

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// === Types ===

export interface TechStack {
  languages: string[]
  frameworks: string[]
  testRunner: string | null
  packageManager: string
  buildTool: string | null
  configFiles: string[]
  testCommand: string
  buildCommand: string | null
  typecheckCommand: string | null
  lintCommand: string | null
}

export interface ProjectContext {
  dependencies: string[]
  devDependencies: string[]
  configHighlights: string[]
}

// === Constants ===

const CONFIG_HIGHLIGHT_FILES = [
  'vite.config.ts', 'vite.config.js',
  'astro.config.mjs', 'astro.config.ts',
  'tailwind.config.js', 'tailwind.config.ts',
  'tsconfig.json',
]

const MAX_CONFIG_PREVIEW_BYTES = 2048

// === API ===

export async function readProjectContext(projectDir: string): Promise<ProjectContext> {
  const packageJsonPath = join(projectDir, 'package.json')

  let dependencies: string[] = []
  let devDependencies: string[] = []

  if (existsSync(packageJsonPath)) {
    try {
      const raw = readFileSync(packageJsonPath, 'utf-8')
      const parsed = JSON.parse(raw) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      dependencies = Object.keys(parsed.dependencies ?? {})
      devDependencies = Object.keys(parsed.devDependencies ?? {})
    } catch (err) {
      process.stderr.write(`WARNING: Failed to read package.json in readProjectContext: ${(err as Error).message}\n`)
    }
  }

  const configHighlights: string[] = []
  for (const configFile of CONFIG_HIGHLIGHT_FILES) {
    const configPath = join(projectDir, configFile)
    if (!existsSync(configPath)) continue
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const preview = raw.length > MAX_CONFIG_PREVIEW_BYTES
        ? raw.slice(0, MAX_CONFIG_PREVIEW_BYTES) + '\n...(truncated)'
        : raw
      configHighlights.push(`### ${configFile}\n\`\`\`\n${preview}\n\`\`\``)
    } catch (err) {
      process.stderr.write(`WARNING: Failed to read config file ${configFile}: ${(err as Error).message}\n`)
    }
  }

  return {
    dependencies,
    devDependencies,
    configHighlights,
  }
}
