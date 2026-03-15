// === Parse Result ===

export type ParseStrategy = 'stream-json' | 'event-array' | 'result-field' | 'direct' | 'fence-strip' | 'brace-extract' | 'bracket-extract'

export type ParseResult =
  | { ok: true; output: string; strategy: ParseStrategy }
  | { ok: false; raw: string }

// === Stream JSON extractor (NDJSON from --output-format stream-json) ===

export function extractStreamResult(ndjson: string): ParseResult {
  const lines = ndjson.split('\n')
  // Scan from end — result event is always last
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line === undefined) continue
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    try {
      const event = JSON.parse(trimmedLine)
      if (event.type === 'result' && event.result !== undefined) {
        const output = typeof event.result === 'string'
          ? event.result
          : JSON.stringify(event.result)
        if (output.trim()) return { ok: true, output, strategy: 'stream-json' }
      }
    } catch {
      continue
    }
  }
  return { ok: false, raw: ndjson }
}

// === Shared Output Parser ===

export function parseStructuredOutput(raw: string): ParseResult {
  if (raw.trim() === '') {
    return { ok: false, raw }
  }

  // Strategy 1: event-array (Claude streaming format)
  const eventArrayResult = tryEventArray(raw)
  if (eventArrayResult) return eventArrayResult

  // Strategy 2: result-field (OpenCode format)
  const resultFieldResult = tryResultField(raw)
  if (resultFieldResult) return resultFieldResult

  // Strategy 3: direct JSON parse
  const directResult = tryDirect(raw)
  if (directResult) return directResult

  // Strategy 4: fence-strip (markdown code fences)
  const fenceResult = tryFenceStrip(raw)
  if (fenceResult) return fenceResult

  // Strategy 5: brace-extract (first { to last })
  const braceResult = tryBraceExtract(raw)
  if (braceResult) return braceResult

  // Strategy 6: bracket-extract (first [ to last ])
  const bracketResult = tryBracketExtract(raw)
  if (bracketResult) return bracketResult

  // All strategies failed
  return { ok: false, raw }
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

function tryEventArray(raw: string): ParseResult | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) return null

  // Find the last element with type === "result"
  let resultElement: { result: unknown } | null = null
  for (const element of parsed) {
    if (
      typeof element === 'object' &&
      element !== null &&
      'type' in element &&
      (element as Record<string, unknown>)['type'] === 'result' &&
      'result' in element
    ) {
      resultElement = element as { result: unknown }
    }
  }

  if (!resultElement) return null

  const output = typeof resultElement.result === 'string'
    ? resultElement.result
    : JSON.stringify(resultElement.result)

  if (output.trim() === '') return null

  return { ok: true, output, strategy: 'event-array' }
}

function tryResultField(raw: string): ParseResult | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  if (!('result' in parsed)) return null

  const result = (parsed as Record<string, unknown>)['result']
  const output = typeof result === 'string'
    ? result
    : JSON.stringify(result)

  if (output.trim() === '') return null

  return { ok: true, output, strategy: 'result-field' }
}

function tryDirect(raw: string): ParseResult | null {
  try {
    JSON.parse(raw)
    return { ok: true, output: raw, strategy: 'direct' }
  } catch {
    return null
  }
}

// Fence regexes: handle \r\n, optional trailing whitespace on fence lines, and end-of-string
const FENCE_OPEN = /`{3,}(?:json)?\s*(?:\r?\n|$)/
const FENCE_CLOSE_LAZY = /\r?\n\s*`{3,}\s*(?:\r?\n|$)/

function tryFenceStrip(raw: string): ParseResult | null {
  const openMatch = FENCE_OPEN.exec(raw)
  if (!openMatch) return null

  const contentStart = openMatch.index + openMatch[0].length

  // Try non-greedy: find FIRST closing fence and check if content is valid JSON
  const afterOpen = raw.slice(contentStart)
  const lazyClose = FENCE_CLOSE_LAZY.exec(afterOpen)
  if (lazyClose) {
    const content = afterOpen.slice(0, lazyClose.index).trim()
    try {
      JSON.parse(content)
      return { ok: true, output: content, strategy: 'fence-strip' }
    } catch {
      // Partial capture — fall through to greedy
    }
  }

  // Try greedy: find LAST closing fence (handles nested fences in string values)
  const remaining = raw.slice(contentStart)
  // Find the last occurrence of ``` on its own line
  let lastFenceIdx = -1
  const closeFenceGlobal = /\r?\n\s*`{3,}\s*(?:\r?\n|$)/g
  let match: RegExpExecArray | null
  while ((match = closeFenceGlobal.exec(remaining)) !== null) {
    lastFenceIdx = match.index
  }
  if (lastFenceIdx > 0) {
    const content = remaining.slice(0, lastFenceIdx).trim()
    try {
      JSON.parse(content)
      return { ok: true, output: content, strategy: 'fence-strip' }
    } catch {
      // Fall through
    }
  }

  return null
}

function tryBraceExtract(raw: string): ParseResult | null {
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null

  const candidate = raw.slice(firstBrace, lastBrace + 1)
  try {
    JSON.parse(candidate)
    return { ok: true, output: candidate, strategy: 'brace-extract' }
  } catch {
    return null
  }
}

function tryBracketExtract(raw: string): ParseResult | null {
  const firstBracket = raw.indexOf('[')
  const lastBracket = raw.lastIndexOf(']')

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) return null

  const candidate = raw.slice(firstBracket, lastBracket + 1)
  try {
    JSON.parse(candidate)
    return { ok: true, output: candidate, strategy: 'bracket-extract' }
  } catch {
    return null
  }
}
