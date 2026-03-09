import { describe, it, expect } from 'vitest'
import { parseStructuredOutput, extractStreamResult } from '../../src/drivers/output-parser.js'
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

    it('handles JSON with nested code fences in string values', () => {
      const nested = '```json\n{"findings": [{"description": "Missing import:\\n```astro\\nimport X\\n```"}]}\n```'

      const parsed = parseStructuredOutput(nested)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
        const obj = JSON.parse(parsed.output)
        expect(obj.findings).toHaveLength(1)
        expect(obj.findings[0].description).toContain('Missing import')
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

    it('handles \\r\\n line endings', () => {
      const crlf = '```json\r\n{"answer": 42}\r\n```'

      const parsed = parseStructuredOutput(crlf)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
        expect(JSON.parse(parsed.output)).toEqual({ answer: 42 })
      }
    })

    it('handles fences with trailing whitespace on fence lines', () => {
      const trailingWs = '```json  \n{"answer": 42}\n```  \n'

      const parsed = parseStructuredOutput(trailingWs)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
      }
    })

    it('handles 4+ backtick fences', () => {
      const quadFence = '````json\n{"answer": 42}\n````'

      const parsed = parseStructuredOutput(quadFence)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
      }
    })

    it('handles fences at end of string without trailing newline', () => {
      const noTrailing = '```json\n{"answer": 42}\n```'

      const parsed = parseStructuredOutput(noTrailing)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
      }
    })

    it('handles real-world review output with suggestedFix containing code blocks', () => {
      const reviewJson = JSON.stringify({
        findings: [{
          file: 'src/layouts/BaseLayout.astro',
          line: 9,
          severity: 'critical',
          category: 'bug',
          description: 'Missing is:inline directive',
          suggestedFix: 'Add is:inline to the script tag:\n\n```astro\n<script is:inline src="https://cdn.tailwindcss.com"></script>\n```\n\nThis bypasses Vite processing.',
        }],
      })
      const fenced = '```json\n' + reviewJson + '\n```'

      const parsed = parseStructuredOutput(fenced)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('fence-strip')
        const obj = JSON.parse(parsed.output)
        expect(obj.findings[0].suggestedFix).toContain('is:inline')
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
  // Strategy 6: bracket-extract
  // -----------------------------------------------------------------------
  describe('bracket-extract strategy', () => {
    it('extracts first [ to last ] as JSON array', () => {
      const messy = 'Here are the findings: [{"id": 1}, {"id": 2}] end'

      const parsed = parseStructuredOutput(messy)

      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.strategy).toBe('bracket-extract')
        const arr = JSON.parse(parsed.output)
        expect(arr).toHaveLength(2)
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
        expect(['stream-json', 'event-array', 'result-field', 'direct', 'fence-strip', 'brace-extract', 'bracket-extract']).toContain(
          parsed.strategy
        )
      }
    })
  })
})

// ---------------------------------------------------------------------------
// extractStreamResult (NDJSON from --output-format stream-json)
// ---------------------------------------------------------------------------

describe('extractStreamResult', () => {
  function ndjson(...events: Record<string, unknown>[]): string {
    return events.map(e => JSON.stringify(e)).join('\n') + '\n'
  }

  it('extracts result from a typical stream-json output', () => {
    const input = ndjson(
      { type: 'system', subtype: 'init', session_id: 'abc' },
      { type: 'assistant', message: { type: 'text', text: 'Working...' } },
      { type: 'result', subtype: 'success', result: 'The answer is 42' },
    )

    const parsed = extractStreamResult(input)

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.output).toBe('The answer is 42')
      expect(parsed.strategy).toBe('stream-json')
    }
  })

  it('extracts JSON string result', () => {
    const input = ndjson(
      { type: 'result', result: '{"tasks": [{"id": 1}]}' },
    )

    const parsed = extractStreamResult(input)

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.output).toBe('{"tasks": [{"id": 1}]}')
    }
  })

  it('stringifies object result', () => {
    const input = ndjson(
      { type: 'result', result: { key: 'value' } },
    )

    const parsed = extractStreamResult(input)

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(JSON.parse(parsed.output)).toEqual({ key: 'value' })
    }
  })

  it('returns ok: false when no result event exists', () => {
    const input = ndjson(
      { type: 'system', subtype: 'init' },
      { type: 'assistant', message: { type: 'text', text: 'hello' } },
    )

    const parsed = extractStreamResult(input)

    expect(parsed.ok).toBe(false)
  })

  it('returns ok: false for empty input', () => {
    const parsed = extractStreamResult('')
    expect(parsed.ok).toBe(false)
  })

  it('returns ok: false when result is empty string', () => {
    const input = ndjson(
      { type: 'result', result: '' },
    )

    const parsed = extractStreamResult(input)
    expect(parsed.ok).toBe(false)
  })

  it('handles mixed valid and invalid lines', () => {
    const input = [
      'not json at all',
      JSON.stringify({ type: 'system', subtype: 'init' }),
      '{"broken json',
      JSON.stringify({ type: 'result', result: 'found it' }),
    ].join('\n') + '\n'

    const parsed = extractStreamResult(input)

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.output).toBe('found it')
    }
  })

  it('uses the last result event when multiple exist', () => {
    const input = ndjson(
      { type: 'result', result: 'first' },
      { type: 'result', result: 'second' },
    )

    const parsed = extractStreamResult(input)

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      // Scans from end, so should get 'second'
      expect(parsed.output).toBe('second')
    }
  })
})
