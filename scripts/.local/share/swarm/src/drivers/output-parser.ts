// === Parse Result ===

export type ParseStrategy = 'event-array' | 'result-field' | 'direct' | 'fence-strip' | 'brace-extract'

export type ParseResult =
  | { ok: true; output: string; strategy: ParseStrategy }
  | { ok: false; raw: string }

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

const FENCE_RE = /```(?:json)?\s*\n([\s\S]*?)\n```/

function tryFenceStrip(raw: string): ParseResult | null {
  const match = FENCE_RE.exec(raw)
  if (!match) return null

  const content = match[1]!.trim()
  try {
    JSON.parse(content)
    return { ok: true, output: content, strategy: 'fence-strip' }
  } catch {
    return null
  }
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
