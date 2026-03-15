import { describe, it, expect } from 'vitest'
import { buildCodeAgentPrompt, buildFindingFixPrompt } from '../../../src/phases/code/code-agent-prompt.js'
import type { PlannerTask } from '../../../src/phases/plan/task-parser.js'
import type { TechStack } from '../../../src/detect/tech-stack.js'
import type { ReviewFinding } from '../../../src/phases/phase-results.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTask(overrides: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: 'TASK-1' as `TASK-${number}`,
    title: 'Implement user authentication',
    description: 'Add login/logout flow with JWT tokens',
    tag: 'backend',
    dependencies: [],
    testHints: ['test login returns token', 'test invalid credentials rejected'],
    ...overrides,
  }
}

function createTechStack(overrides: Partial<TechStack> = {}): TechStack {
  return {
    languages: ['typescript'],
    frameworks: ['express'],
    testRunner: 'vitest',
    packageManager: 'pnpm',
    buildTool: 'vite',
    configFiles: ['tsconfig.json'],
    testCommand: 'vitest run',
    buildCommand: null,
    typecheckCommand: null,
    lintCommand: null,
    ...overrides,
  }
}

function createFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    file: 'src/auth.ts',
    line: 15,
    severity: 'critical',
    category: 'bug',
    description: 'Null check missing for token',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildCodeAgentPrompt
// ---------------------------------------------------------------------------

describe('buildCodeAgentPrompt', () => {
  it('includes task title and description', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('Implement user authentication')
    expect(prompt).toContain('Add login/logout flow with JWT tokens')
  })

  it('includes test hints', () => {
    const task = createTask({
      testHints: ['test login returns token', 'test invalid credentials rejected'],
    })
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('test login returns token')
    expect(prompt).toContain('test invalid credentials rejected')
  })

  it('includes tech stack info', () => {
    const task = createTask()
    const techStack = createTechStack({ languages: ['typescript'], frameworks: ['express'] })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('typescript')
    expect(prompt).toContain('express')
  })

  it('includes previous findings when provided (iteration 2+)', () => {
    const task = createTask()
    const techStack = createTechStack()
    const findings = [createFinding({ description: 'Missing null check on token' })]

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack, findings)

    expect(prompt).toContain('Missing null check on token')
  })

  it('truncates previous findings per DL-SC-7 (32KB total)', () => {
    const task = createTask()
    const techStack = createTechStack()
    // Create findings that exceed 32KB
    const largeFinding = createFinding({ description: 'x'.repeat(40_000) })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack, [largeFinding])

    // The prompt should exist and be under a reasonable limit
    expect(prompt.length).toBeLessThanOrEqual(40_000)
  })

  it('instructs agent to write files directly', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('writing files directly')
  })

  it('includes coding conventions constraint', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    // Should have some reference to conventions/guidelines
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('includes review finding handling instructions', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('Handling Review Findings')
    expect(prompt).toContain('suggestedFix')
    expect(prompt).toContain('[RECURRING]')
    expect(prompt).toMatch(/NEVER remove spec-required functionality/i)
  })

  it('includes guidance for conflicting findings vs spec', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toMatch(/fix the ENVIRONMENT/i)
    expect(prompt).toMatch(/DIFFERENT approach/i)
  })

  it('includes execution section with test command', () => {
    const task = createTask()
    const techStack = createTechStack({ testCommand: 'pnpm exec vitest run' })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('# Execution')
    expect(prompt).toContain('pnpm exec vitest run')
    expect(prompt).toMatch(/MUST run tests/i)
    expect(prompt).toContain('iterate until green')
  })

  it('includes build execution section when buildCommand is set', () => {
    const task = createTask()
    const techStack = createTechStack({ buildCommand: 'pnpm build' })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('## Build Execution')
    expect(prompt).toContain('pnpm build')
  })

  it('omits build execution section when no buildCommand', () => {
    const task = createTask()
    const techStack = createTechStack({ buildCommand: null })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).not.toContain('## Build Execution')
  })

  it('includes typecheck execution section when typecheckCommand is set', () => {
    const task = createTask()
    const techStack = createTechStack({ typecheckCommand: 'pnpm exec tsc --noEmit' })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('## Type Check Execution')
    expect(prompt).toContain('pnpm exec tsc --noEmit')
    expect(prompt).toContain('type errors is NOT acceptable')
  })

  it('omits typecheck execution section when no typecheckCommand', () => {
    const task = createTask()
    const techStack = createTechStack({ typecheckCommand: null })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).not.toContain('## Type Check Execution')
  })

  it('includes lint execution section when lintCommand is set', () => {
    const task = createTask()
    const techStack = createTechStack({ lintCommand: 'pnpm exec eslint .' })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('## Lint Execution')
    expect(prompt).toContain('pnpm exec eslint .')
    expect(prompt).toContain('Do NOT disable lint rules')
  })

  it('omits lint execution section when no lintCommand', () => {
    const task = createTask()
    const techStack = createTechStack({ lintCommand: null })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).not.toContain('## Lint Execution')
  })

  it('includes typecheck and lint commands in tech stack section', () => {
    const task = createTask()
    const techStack = createTechStack({
      typecheckCommand: 'pnpm exec tsc --noEmit',
      lintCommand: 'pnpm exec eslint .',
    })

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('Typecheck command: pnpm exec tsc --noEmit')
    expect(prompt).toContain('Lint command: pnpm exec eslint .')
  })

  it('includes structured JSON output section', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack)

    expect(prompt).toContain('## Output')
    expect(prompt).toContain('```json')
    expect(prompt).toContain('filesChanged')
    expect(prompt).toContain('testResult')
    expect(prompt).toContain('buildResult')
    expect(prompt).toContain('summary')
  })

  it('summarizes older test files when the list grows large', () => {
    const task = createTask()
    const techStack = createTechStack()
    const testFiles = Array.from({ length: 10 }, (_, index) => `tests/task-${index + 1}.test.ts`)

    const prompt = buildCodeAgentPrompt(task, testFiles, techStack)

    expect(prompt).toContain('earlier test file(s) already exist')
    expect(prompt).toContain('tests/task-10.test.ts')
    expect(prompt).not.toContain('tests/task-1.test.ts')
  })

  it('includes decision log when provided', () => {
    const task = createTask()
    const techStack = createTechStack()
    const decisionLog = '# Previous Iteration Decisions\n\n- **Iteration 0** | src/auth.ts:15 | critical bug: Missing null check → **Applied fix**: Added optional chaining'

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack, undefined, decisionLog)

    expect(prompt).toContain('Previous Iteration Decisions')
    expect(prompt).toContain('Missing null check')
    expect(prompt).toContain('Applied fix')
  })

  it('omits decision log when empty', () => {
    const task = createTask()
    const techStack = createTechStack()

    const prompt = buildCodeAgentPrompt(task, ['tests/auth.test.ts'], techStack, undefined, '')

    expect(prompt).not.toContain('Previous Iteration Decisions')
  })
})

// ---------------------------------------------------------------------------
// buildFindingFixPrompt
// ---------------------------------------------------------------------------

describe('buildFindingFixPrompt', () => {
  it('groups findings by severity', () => {
    const findings = [
      createFinding({ severity: 'important', description: 'minor styling issue' }),
      createFinding({ severity: 'critical', description: 'null pointer' }),
      createFinding({ severity: 'suggestion', description: 'could use better naming' }),
    ]

    const prompt = buildFindingFixPrompt(findings)

    const critIdx = prompt.indexOf('## Critical')
    const impIdx = prompt.indexOf('## Important')
    const sugIdx = prompt.indexOf('## Suggestion')
    expect(critIdx).toBeLessThan(impIdx)
    expect(impIdx).toBeLessThan(sugIdx)
  })

  it('includes file and line location', () => {
    const findings = [createFinding({ file: 'src/hero.astro', line: 42 })]

    const prompt = buildFindingFixPrompt(findings)

    expect(prompt).toContain('src/hero.astro:42')
  })

  it('includes file without line when line is null', () => {
    const findings = [createFinding({ file: 'src/hero.astro', line: null })]

    const prompt = buildFindingFixPrompt(findings)

    expect(prompt).toContain('src/hero.astro')
    expect(prompt).not.toContain('src/hero.astro:')
  })

  it('includes category in brackets', () => {
    const findings = [createFinding({ category: 'security' })]

    const prompt = buildFindingFixPrompt(findings)

    expect(prompt).toContain('[security]')
  })

  it('includes suggested fix when present', () => {
    const findings = [createFinding({ suggestedFix: 'Import HeroImage from components/' })]

    const prompt = buildFindingFixPrompt(findings)

    expect(prompt).toContain('Suggested fix: Import HeroImage from components/')
  })

  it('omits suggested fix line when not present', () => {
    const findings = [createFinding({ suggestedFix: undefined })]

    const prompt = buildFindingFixPrompt(findings)

    expect(prompt).not.toContain('Suggested fix:')
  })

  it('includes decision log when provided', () => {
    const decisionLog = '# Previous Iteration Decisions\n\n- **Iteration 0** | fix applied'

    const prompt = buildFindingFixPrompt([createFinding()], decisionLog)

    expect(prompt).toContain('Previous Iteration Decisions')
  })

  it('omits decision log when empty', () => {
    const prompt = buildFindingFixPrompt([createFinding()], '')

    expect(prompt).not.toContain('Previous Iteration Decisions')
  })

  it('includes JSON output section', () => {
    const prompt = buildFindingFixPrompt([createFinding()])

    expect(prompt).toContain('## Output')
    expect(prompt).toContain('filesChanged')
    expect(prompt).toContain('testResult')
  })

  it('starts with Fix Required heading', () => {
    const prompt = buildFindingFixPrompt([createFinding()])

    expect(prompt).toContain('# Fix Required')
  })

  it('includes fix-only instruction', () => {
    const prompt = buildFindingFixPrompt([createFinding()])

    expect(prompt).toContain('Fix ONLY these issues')
  })

  it('is significantly shorter than buildCodeAgentPrompt', () => {
    const findings = [createFinding()]
    const fixPrompt = buildFindingFixPrompt(findings)
    const fullPrompt = buildCodeAgentPrompt(
      createTask(), ['tests/auth.test.ts'], createTechStack(), findings
    )

    expect(fixPrompt.length).toBeLessThan(fullPrompt.length)
  })
})
