import { describe, it, expect } from 'vitest'
import { buildPlannerPrompt } from '../../src/prompts/planner-prompt.js'
import type { TechStack } from '../../src/tech-stack.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTechStack(overrides: Partial<TechStack> = {}): TechStack {
  return {
    languages: ['typescript'],
    frameworks: ['react'],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: ['tsconfig.json', 'vitest.config.ts'],
    testCommand: 'vitest run',
    ...overrides,
  }
}

const SPEC_CONTENT = `
# Feature Spec
Implement a user authentication system with login, logout, and session management.
`

const PROJECT_STRUCTURE = [
  'src/',
  'src/auth/',
  'src/components/',
  'tests/',
  'package.json',
  'tsconfig.json',
]

// ---------------------------------------------------------------------------
// Prompt content
// ---------------------------------------------------------------------------

describe('buildPlannerPrompt — content', () => {
  it('returns a non-empty string', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes spec item content in output', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    expect(result).toContain('user authentication')
  })

  it('includes tech stack information', () => {
    const techStack = createTechStack({ frameworks: ['react', 'express'] })

    const result = buildPlannerPrompt(SPEC_CONTENT, techStack, PROJECT_STRUCTURE)

    expect(result).toMatch(/react/i)
    expect(result).toMatch(/typescript/i)
  })

  it('includes project structure', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    expect(result).toContain('src/')
  })

  it('includes constraints (non-overlapping files, DAG, tags, relative paths)', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    // Should mention key constraints from FR-2
    expect(result).toMatch(/overlap|non-overlapping|disjoint/i)
    expect(result).toMatch(/dag|cycle|circular|dependency/i)
    expect(result).toMatch(/backend|frontend|fullstack/i)
    expect(result).toMatch(/relative|absolute/i)
  })

  it('includes rigid markdown template format', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    // Should include the template markers
    expect(result).toMatch(/TASK-\d+|TASK-N/i)
    expect(result).toMatch(/\*\*Tag\*\*|\bTag\b/i)
    expect(result).toMatch(/\*\*Files\*\*|\bFiles\b/i)
    expect(result).toMatch(/\*\*Dependencies\*\*|\bDependencies\b/i)
  })

  it('includes role description', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    expect(result).toMatch(/architect|decompos|planner/i)
  })

  it('includes output format instructions', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, createTechStack(), PROJECT_STRUCTURE)

    expect(result).toMatch(/Task Decomposition|markdown|template|format/i)
  })
})
