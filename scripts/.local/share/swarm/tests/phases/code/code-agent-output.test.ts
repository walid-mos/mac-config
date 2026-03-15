import { describe, it, expect } from 'vitest'
import { parseCodeAgentOutput } from '../../../src/phases/code/code-agent-output.js'
import type { TaskCodeAgentOutput } from '../../../src/phases/phase-results.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validCompletedOutput(): TaskCodeAgentOutput {
  return {
    taskId: 'TASK-1',
    status: 'completed',
    filesModified: ['src/feature.ts'],
    filesCreated: ['src/new-file.ts'],
    sanityChecksPassed: true,
  }
}

function validFailedOutput(): TaskCodeAgentOutput {
  return {
    taskId: 'TASK-2',
    status: 'failed',
    filesModified: ['src/broken.ts'],
    filesCreated: [],
    sanityChecksPassed: false,
    sanityErrors: ['Type error in src/broken.ts'],
  }
}

function validBlockedOutput(): TaskCodeAgentOutput {
  return {
    taskId: 'TASK-3',
    status: 'blocked',
    filesModified: [],
    filesCreated: [],
    sanityChecksPassed: false,
    sanityErrors: ['Missing dependency TASK-1'],
  }
}

// ---------------------------------------------------------------------------
// parseCodeAgentOutput
// ---------------------------------------------------------------------------

describe('parseCodeAgentOutput', () => {
  it('parses valid completed output correctly', () => {
    const raw = JSON.stringify(validCompletedOutput())

    const result = parseCodeAgentOutput(raw)

    expect(result.taskId).toBe('TASK-1')
    expect(result.status).toBe('completed')
    expect(result.filesModified).toEqual(['src/feature.ts'])
    expect(result.filesCreated).toEqual(['src/new-file.ts'])
    expect(result.sanityChecksPassed).toBe(true)
  })

  it('parses valid failed output with sanityErrors correctly', () => {
    const raw = JSON.stringify(validFailedOutput())

    const result = parseCodeAgentOutput(raw)

    expect(result.taskId).toBe('TASK-2')
    expect(result.status).toBe('failed')
    expect(result.sanityChecksPassed).toBe(false)
    if (result.status === 'failed') {
      expect(result.sanityErrors).toEqual(['Type error in src/broken.ts'])
    }
  })

  it('parses valid blocked output correctly', () => {
    const raw = JSON.stringify(validBlockedOutput())

    const result = parseCodeAgentOutput(raw)

    expect(result.taskId).toBe('TASK-3')
    expect(result.status).toBe('blocked')
    expect(result.sanityChecksPassed).toBe(false)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseCodeAgentOutput('not json {')).toThrow()
  })

  it('throws on missing required fields', () => {
    const incomplete = JSON.stringify({ taskId: 'TASK-1' })

    expect(() => parseCodeAgentOutput(incomplete)).toThrow()
  })

  it('throws on invalid taskId format', () => {
    const badId = JSON.stringify({
      ...validCompletedOutput(),
      taskId: 'INVALID-ID',
    })

    expect(() => parseCodeAgentOutput(badId)).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => parseCodeAgentOutput('')).toThrow()
  })

  it('ignores extra fields (lenient parsing)', () => {
    const withExtra = JSON.stringify({
      ...validCompletedOutput(),
      extraField: 'should be ignored',
      anotherOne: 42,
    })

    const result = parseCodeAgentOutput(withExtra)

    expect(result.taskId).toBe('TASK-1')
    expect(result.status).toBe('completed')
  })

  it('requires non-empty sanityErrors tuple for failed status', () => {
    const badFailed = JSON.stringify({
      taskId: 'TASK-1',
      status: 'failed',
      filesModified: [],
      filesCreated: [],
      sanityChecksPassed: false,
      sanityErrors: [],
    })

    expect(() => parseCodeAgentOutput(badFailed)).toThrow()
  })

  it('validates filesModified and filesCreated are arrays of strings', () => {
    const result = parseCodeAgentOutput(JSON.stringify(validCompletedOutput()))

    expect(Array.isArray(result.filesModified)).toBe(true)
    expect(Array.isArray(result.filesCreated)).toBe(true)
    for (const f of result.filesModified) {
      expect(typeof f).toBe('string')
    }
    for (const f of result.filesCreated) {
      expect(typeof f).toBe('string')
    }
  })
})
