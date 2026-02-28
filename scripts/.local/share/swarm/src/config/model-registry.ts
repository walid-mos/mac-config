// ---------------------------------------------------------------------------
// Model Registry — single source of truth for model aliases
// ---------------------------------------------------------------------------
//
// When a new model is released, update the alias mapping here.
// Everything else (config resolver, defaults, drivers) resolves through this.
// ---------------------------------------------------------------------------

const MODEL_ALIASES = new Map<string, string>([
  ['opus', 'claude-opus-4-6'],
  ['sonnet', 'claude-sonnet-4-6'],
  ['haiku', 'claude-haiku-4-5-20251001'],
  ['kimi', 'moonshotai/kimi-k2.5'],
])

/**
 * Resolve a model string: known alias → explicit ID, unknown → pass through.
 */
export function resolveModel(raw: string): string {
  return MODEL_ALIASES.get(raw) ?? raw
}

/**
 * Check if a string is a known alias (not an explicit ID).
 */
export function isKnownAlias(raw: string): boolean {
  return MODEL_ALIASES.has(raw)
}

/**
 * Return all registered aliases (read-only snapshot).
 */
export function getAliases(): ReadonlyMap<string, string> {
  return MODEL_ALIASES
}
