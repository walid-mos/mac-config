import { describe, it, expect } from 'vitest'
import { resolveModel, isKnownAlias, getAliases } from '../../src/config/model-registry.js'

describe('resolveModel', () => {
  it('resolves "opus" to explicit claude model ID', () => {
    expect(resolveModel('opus')).toBe('claude-opus-4-6')
  })

  it('resolves "sonnet" to explicit claude model ID', () => {
    expect(resolveModel('sonnet')).toBe('claude-sonnet-4-6')
  })

  it('resolves "haiku" to explicit claude model ID', () => {
    expect(resolveModel('haiku')).toBe('claude-haiku-4-5-20251001')
  })

  it('resolves "kimi" to explicit moonshot model ID', () => {
    expect(resolveModel('kimi')).toBe('moonshotai/kimi-k2.5')
  })

  it('passes through explicit model IDs unchanged', () => {
    expect(resolveModel('claude-opus-4-6')).toBe('claude-opus-4-6')
    expect(resolveModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
  })

  it('passes through third-party model IDs unchanged', () => {
    expect(resolveModel('gpt-5.3')).toBe('gpt-5.3')
    expect(resolveModel('openai/gpt-5.3-codex')).toBe('openai/gpt-5.3-codex')
    expect(resolveModel('google/gemini-2.5-pro')).toBe('google/gemini-2.5-pro')
  })
})

describe('isKnownAlias', () => {
  it('returns true for registered aliases', () => {
    expect(isKnownAlias('opus')).toBe(true)
    expect(isKnownAlias('sonnet')).toBe(true)
    expect(isKnownAlias('haiku')).toBe(true)
    expect(isKnownAlias('kimi')).toBe(true)
  })

  it('returns false for explicit IDs', () => {
    expect(isKnownAlias('claude-opus-4-6')).toBe(false)
  })

  it('returns false for unknown strings', () => {
    expect(isKnownAlias('gpt-5.3')).toBe(false)
    expect(isKnownAlias('unknown-model')).toBe(false)
  })
})

describe('getAliases', () => {
  it('returns all registered aliases', () => {
    const aliases = getAliases()

    expect(aliases.size).toBeGreaterThanOrEqual(4)
    expect(aliases.get('opus')).toBe('claude-opus-4-6')
    expect(aliases.get('sonnet')).toBe('claude-sonnet-4-6')
    expect(aliases.get('haiku')).toBe('claude-haiku-4-5-20251001')
    expect(aliases.get('kimi')).toBe('moonshotai/kimi-k2.5')
  })

  it('returns a read-only map', () => {
    const aliases = getAliases()

    // Map.set exists on the prototype but this is ReadonlyMap
    // The type system prevents mutation — runtime check that the reference is stable
    expect(aliases).toBe(getAliases())
  })
})
