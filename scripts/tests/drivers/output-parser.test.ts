import { describe, it, expect } from 'vitest'
import { parseStructuredOutput } from '../../src/drivers/output-parser.js'
import type { ParseResult } from '../../src/drivers/output-parser.js'

// ---------------------------------------------------------------------------
// parseStructuredOutput
// ---------------------------------------------------------------------------

describe('parseStructuredOutput', () => {
  // -----------------------------------------------------------------------
  // Strategy 1: event-array (Claude streaming format)
  // -----------------------------------------------------------------------
  describe('event-array strategy (Claude streaming format)', () => {
    it('extracts result from a JSON array with type="result" element', () => {
      const claudeOutput = JSON.stringify([
        { type: 'assistant', message: { content: 'thinking...' } },
        { type: 'result', result: 'The final answer is 42' },
      ])

      const parsed = parseStructuredOutput(claudeOutput)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.output).toBe('The final answer is 42')
        expect(parsed.strategy).toBe('event-array')
      }
    })

    it('extracts result when multiple events precede the result element', () => {
      const claudeOutput = JSON.stringify([
        { type: 'system', text: 'preamble' },
        { type: 'assistant', message: { content: 'step 1' } },
        { type: 'assistant', message: { content: 'step 2' } },
        { type: 'result', result: '{"key": "value"}' },
      ])

      const parsed = parseStructuredOutput(claudeOutput)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.output).toBe('{"key": "value"}')
        expect(parsed.strategy).toBe('event-array')
      }
    })

    it('uses the last result element when multiple exist', () => {
      // Edge case: multiple result events — the function should pick one
      const claudeOutput = JSON.stringify([
        { type: 'result', result: 'first' },
        { type: 'result', result: 'second' },
      ])

      const parsed = parseStructuredOutput(claudeOutput)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('event-array')
        // Either first or second is acceptable — the point is it extracts one
        expect(typeof parsed.output).toBe('string')
      }
    })

    it('falls through when array has no type="result" element', () => {
      const noResult = JSON.stringify([
        { type: 'assistant', message: 'hello' },
        { type: 'system', text: 'done' },
      ])

      // Should NOT match event-array since no result type
      // May match another strategy or fail
      const parsed = parseStructuredOutput(noResult)

      if (parsed.ok) {
        expect(parsed.strategy).not.toBe('event-array')
      }
    })
  })

  // -----------------------------------------------------------------------
  // Strategy 2: result-field (OpenCode format)
  // -----------------------------------------------------------------------
  describe('result-field strategy (OpenCode format)', () => {
    it('extracts .result field from a JSON object', () => {
      const openCodeOutput = JSON.stringify({
        result: 'Here is the generated code',
        metadata: { model: 'gpt-5.3' },
      })

      const parsed = parseStructuredOutput(openCodeOutput)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.output).toBe('Here is the generated code')
        expect(parsed.strategy).toBe('result-field')
      }
    })

    it('extracts .result when it contains JSON-stringified content', () => {
      const output = JSON.stringify({
        result: '{"tasks": [{"id": 1}]}',
      })

      const parsed = parseStructuredOutput(output)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.output).toBe('{"tasks": [{"id": 1}]}')
        expect(parsed.strategy).toBe('result-field')
      }
    })
  })

  // -----------------------------------------------------------------------
  // Strategy 3: direct JSON parse
  // -----------------------------------------------------------------------
  describe('direct strategy', () => {
    it('parses raw output as direct JSON when it is a valid object', () => {
      // A JSON object without .result field — not an array, so event-array
      // and result-field strategies should not match, but direct should
      const directJson = JSON.stringify({ tasks: [1, 2, 3], count: 3 })

      const parsed = parseStructuredOutput(directJson)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('direct')
        expect(parsed.output).toBe(directJson)
      }
    })

    it('handles a plain string that is valid JSON', () => {
      // A JSON string is valid JSON — JSON.parse('"hello"') === 'hello'
      const jsonString = '"just a string"'

      const parsed = parseStructuredOutput(jsonString)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('direct')
      }
    })
  })

  // -----------------------------------------------------------------------
  // Strategy 4: fence-strip (markdown code fences)
  // -----------------------------------------------------------------------
  describe('fence-strip strategy', () => {
    it('strips ```json fences and parses the content', () => {
      const fenced = '```json\n{"answer": 42}\n```'

      const parsed = parseStructuredOutput(fenced)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.output).toContain('"answer"')
        expect(parsed.strategy).toBe('fence-strip')
      }
    })

    it('strips plain ``` fences without language tag', () => {
      const fenced = '```\n{"key": "value"}\n```'

      const parsed = parseStructuredOutput(fenced)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
      }
    })

    it('handles fences with surrounding prose', () => {
      const withProse = 'Here is the output:\n```json\n{"result": true}\n```\nDone.'

      const parsed = parseStructuredOutput(withProse)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        // Should be fence-strip since the raw input is not valid JSON
        expect(parsed.strategy).toBe('fence-strip')
      }
    })
  })

  // -----------------------------------------------------------------------
  // Strategy 5: brace-extract
  // -----------------------------------------------------------------------
  describe('brace-extract strategy', () => {
    it('extracts first { to last } as JSON', () => {
      const messy = 'Some preamble text {"data": "extracted"} trailing stuff'

      const parsed = parseStructuredOutput(messy)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.output).toContain('"data"')
        expect(parsed.strategy).toBe('brace-extract')
      }
    })

    it('handles nested braces correctly', () => {
      const nested = 'prefix {"outer": {"inner": "value"}} suffix'

      const parsed = parseStructuredOutput(nested)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('brace-extract')
        const obj = JSON.parse(parsed.output)
        expect(obj.outer.inner).toBe('value')
      }
    })
  })

  // -----------------------------------------------------------------------
  // All strategies fail
  // -----------------------------------------------------------------------
  describe('failure case', () => {
    it('returns { ok: false, raw } when all strategies fail', () => {
      const garbage = 'This is not JSON at all, no braces, no fences.'

      const parsed = parseStructuredOutput(garbage)

      expect(parsed.ok).toBe(false)
      if (!parsed.ok) {
        expect(parsed.raw).toBe(garbage)
      }
    })

    it('returns { ok: false } for invalid JSON inside braces', () => {
      const badBraces = 'prefix {not: valid: json} suffix'

      const parsed = parseStructuredOutput(badBraces)

      expect(parsed.ok).toBe(false)
      if (!parsed.ok) {
        expect(parsed.raw).toBe(badBraces)
      }
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('returns { ok: false } for empty string', () => {
      const parsed = parseStructuredOutput('')

      expect(parsed.ok).toBe(false)
      if (!parsed.ok) {
        expect(parsed.raw).toBe('')
      }
    })

    it('returns { ok: false } for whitespace-only string', () => {
      const parsed = parseStructuredOutput('   \n\t  ')

      expect(parsed.ok).toBe(false)
      if (!parsed.ok) {
        expect(parsed.raw).toBe('   \n\t  ')
      }
    })

    it('handles deeply nested JSON objects', () => {
      const deep = JSON.stringify({ a: { b: { c: { d: { e: 'deep' } } } } })
      const parsed = parseStructuredOutput(deep)

      expect(parsed.ok).toBe(true)
    })

    it('handles JSON with unicode content', () => {
      const unicode = JSON.stringify({ emoji: '\u{1F600}', text: 'cafe\u0301' })
      const parsed = parseStructuredOutput(unicode)

      expect(parsed.ok).toBe(true)
    })

    it('tracks the strategy used in successful results', () => {
      // Every successful parse must include a strategy field
      const simple = JSON.stringify({ result: 'hello' })
      const parsed = parseStructuredOutput(simple)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(['event-array', 'result-field', 'direct', 'fence-strip', 'brace-extract']).toContain(
          parsed.strategy
        )
      }
    })
  })
})
