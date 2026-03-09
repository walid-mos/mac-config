import { describe, it, expect } from 'vitest'
import { buildPlannerPrompt, buildFindingsFixPlannerPrompt } from '../../../src/phases/plan/planner-prompt.js'
import type { ReviewFinding } from '../../../src/phases/phase-results.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes spec item content in output', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toContain('user authentication')
  })

  it('includes project structure', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toContain('src/')
  })

  it('includes constraints (DAG, tags, domain separation)', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    // Should mention key constraints
    expect(result).toMatch(/dag|cycle|circular|dependency/i)
    expect(result).toMatch(/backend|frontend|fullstack/i)
    expect(result).toMatch(/domain|concern|same files/i)
  })

  it('includes rigid markdown template format', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    // Should include the template markers
    expect(result).toMatch(/TASK-\d+|TASK-N/i)
    expect(result).toMatch(/\*\*Tag\*\*|\bTag\b/i)
    expect(result).toMatch(/\*\*Dependencies\*\*|\bDependencies\b/i)
  })

  it('includes role description', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toMatch(/architect|decompos|planner/i)
  })

  it('includes output format instructions', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toMatch(/Task Decomposition|markdown|template|format/i)
  })

  it('instructs agent to output Tech Stack section', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toContain('## Tech Stack')
    expect(result).toContain('**Package Manager**')
    expect(result).toContain('**Test Command**')
    expect(result).toContain('**Build Command**')
    expect(result).toContain('**Typecheck Command**')
    expect(result).toContain('**Lint Command**')
    expect(result).toContain('**Languages**')
    expect(result).toContain('**Frameworks**')
    expect(result).toContain('**Test Runner**')
    expect(result).toContain('**Build Tool**')
    expect(result).toContain('**Config Files**')
  })

  it('instructs lockfile-based package manager detection', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toContain('pnpm-lock.yaml')
    expect(result).toContain('yarn.lock')
  })

  it('includes behavioral test hint guidance', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toMatch(/BEHAVIOR to verify/i)
    expect(result).toContain('BAD:')
    expect(result).toContain('GOOD:')
    expect(result).toMatch(/matching id/i)
  })

  it('includes command format rules (no markdown, no backticks)', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toContain('Command Format Rules')
    expect(result).toMatch(/plain shell commands/i)
    expect(result).toMatch(/NO markdown/i)
    expect(result).toMatch(/NO backticks/i)
  })

  it('requires functional task titles, not technical file names', () => {
    const result = buildPlannerPrompt(SPEC_CONTENT, PROJECT_STRUCTURE)

    expect(result).toMatch(/functional.*user-facing/i)
    expect(result).toContain('BAD:')
    expect(result).toContain('GOOD:')
    expect(result).toMatch(/Create BaseLayout\.astro/i)
    expect(result).toMatch(/Set up base page layout/i)
  })
})

// ---------------------------------------------------------------------------
// buildFindingsFixPlannerPrompt
// ---------------------------------------------------------------------------

const FINDINGS: ReviewFinding[] = [
  { file: 'src/hero.astro', line: 5, severity: 'critical', category: 'bug', description: 'Missing alt attribute on image' },
  { file: 'src/nav.astro', line: 12, severity: 'important', category: 'spec-compliance', description: 'Nav links missing', suggestedFix: 'Add links from spec' },
  { file: 'src/footer.astro', severity: 'suggestion', category: 'quality', description: 'Could use semantic HTML' },
]

const DECISION_LOG = `# Previous Iteration Decisions\n\n- **Iteration 0** | src/index.astro | critical bug: broken import → **Applied fix**: fixed import`

describe('buildFindingsFixPlannerPrompt — content', () => {
  it('returns a non-empty string', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes role description about grouping findings', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toMatch(/group|combine/i)
    expect(result).toMatch(/architect/i)
  })

  it('includes spec context', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('user authentication')
  })

  it('includes critical and important findings but not suggestions', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('Missing alt attribute')
    expect(result).toContain('Nav links missing')
    expect(result).not.toContain('Could use semantic HTML')
  })

  it('includes suggested fixes when available', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('Add links from spec')
  })

  it('includes decision log when provided', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, DECISION_LOG, SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('Previous Iteration Decisions')
    expect(result).toContain('broken import')
  })

  it('omits decision log section when empty', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).not.toContain('Previous Iteration Decisions')
  })

  it('includes project structure', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('src/')
    expect(result).toContain('package.json')
  })

  it('instructs task IDs starting at 900', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('900')
  })

  it('instructs aggressive grouping', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toMatch(/group aggressively/i)
  })

  it('includes TASK-N template in output format', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('TASK-900')
    expect(result).toContain('## Task Decomposition')
  })

  it('does not include Tech Stack section', () => {
    const result = buildFindingsFixPlannerPrompt(FINDINGS, '', SPEC_CONTENT, PROJECT_STRUCTURE)
    expect(result).toContain('Do NOT include a Tech Stack section')
  })
})
