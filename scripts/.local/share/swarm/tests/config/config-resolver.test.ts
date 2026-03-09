import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { resolveSwarmConfig, getModelAssignment } from '../../src/config/config-resolver.js'
import { ConfigValidationError } from '../../src/core/errors.js'
import type { SwarmConfig, AgentRole } from '../../src/core/types.js'
import {
  createSwarmConfig,
  createModelAssignment,
  FULL_TOML,
  TOML_WITH_TAGS,
  PARTIAL_TOML,
  ALL_AGENT_ROLES,
  buildTomlContent,
} from '../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-config-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function writeProjectConfig(content: string): string {
  const configPath = path.join(tmpDir, 'swarm.toml')
  fs.writeFileSync(configPath, content, 'utf-8')
  return configPath
}

// ---------------------------------------------------------------------------
// FR-3: TOML parsing
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — TOML parsing (FR-3)', () => {
  it('parses valid TOML with all base agent roles', () => {
    writeProjectConfig(FULL_TOML)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.agents.plan).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
    expect(result.config.models.agents.test).toEqual({
      backend: 'opencode',
      model: 'gpt-5.3',
    })
    expect(result.config.models.agents.code).toEqual({
      backend: 'opencode',
      model: 'codex',
    })
    expect(result.resolvedFrom).toContain('swarm.toml')
  })

  it('parses TOML with tag overrides into the tagged map', () => {
    writeProjectConfig(TOML_WITH_TAGS)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.tagged['code-frontend']).toEqual({
      backend: 'opencode',
      model: 'gemini',
    })
    expect(result.config.models.tagged['code-backend']).toEqual({
      backend: 'opencode',
      model: 'codex',
    })
  })

  it('partitions flat TOML keys into agents (base) and tagged (suffixed)', () => {
    writeProjectConfig(TOML_WITH_TAGS)

    const result = resolveSwarmConfig(tmpDir)

    // Base roles in agents
    for (const role of ALL_AGENT_ROLES) {
      expect(result.config.models.agents).toHaveProperty(role)
    }
    // Tag overrides NOT in agents
    expect(result.config.models.agents).not.toHaveProperty('code-frontend')
    expect(result.config.models.agents).not.toHaveProperty('code-backend')
    // Tag overrides in tagged
    expect(result.config.models.tagged).toHaveProperty('code-frontend')
    expect(result.config.models.tagged).toHaveProperty('code-backend')
  })
})

// ---------------------------------------------------------------------------
// FR-4: Config resolution precedence
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — precedence (FR-4)', () => {
  it('uses project-level config when present (first match)', () => {
    writeProjectConfig(FULL_TOML)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.resolvedFrom).toContain(tmpDir)
  })

  it('falls back to built-in defaults when no config file exists', () => {
    // Empty directory — no swarm.toml
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-empty-'))

    try {
      const result = resolveSwarmConfig(emptyDir)

      // All roles should get the default (claude/claude-opus-4-6)
      for (const role of ALL_AGENT_ROLES) {
        expect(result.config.models.agents[role]).toEqual({
          backend: 'claude',
          model: 'claude-opus-4-6',
        })
      }
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('uses explicit config path when --config is provided', () => {
    const explicitPath = path.join(tmpDir, 'custom.toml')
    fs.writeFileSync(explicitPath, FULL_TOML, 'utf-8')

    const result = resolveSwarmConfig(tmpDir, explicitPath)

    expect(result.resolvedFrom).toContain('custom.toml')
  })

  it('fills missing base roles with defaults after resolution', () => {
    // Only plan and code are defined — remaining 6 should get defaults
    writeProjectConfig(PARTIAL_TOML)

    const result = resolveSwarmConfig(tmpDir)

    // Explicitly defined
    expect(result.config.models.agents.plan).toEqual({
      backend: 'opencode',
      model: 'gpt-5.3',
    })
    // Auto-filled defaults
    expect(result.config.models.agents.review).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
    expect(result.config.models.agents.security).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
    expect(result.config.models.agents.consistency).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
    expect(result.config.models.agents.merge).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
    expect(result.config.models.agents.docs).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
    expect(result.config.models.agents.test).toEqual({
      backend: 'claude',
      model: 'claude-opus-4-6',
    })
  })

  it('guarantees all 8 base AgentRole keys are present after resolution', () => {
    writeProjectConfig(PARTIAL_TOML)

    const result = resolveSwarmConfig(tmpDir)

    for (const role of ALL_AGENT_ROLES) {
      expect(result.config.models.agents[role]).toBeDefined()
      expect(result.config.models.agents[role].backend).toBeDefined()
      expect(result.config.models.agents[role].model).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// Invalid config handling
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — invalid config', () => {
  it('throws ConfigValidationError on malformed TOML syntax', () => {
    writeProjectConfig('this is not valid toml [[[')

    try {
      resolveSwarmConfig(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err) {
      // Must be a ConfigValidationError, not the stub "Not implemented"
      expect((err as Error).message).not.toBe('Not implemented')
      expect(err).toBeInstanceOf(ConfigValidationError)
    }
  })

  it('throws ConfigValidationError when backend is unknown', () => {
    const badToml = buildTomlContent({
      plan: { backend: 'unknown-ai', model: 'opus' },
    })
    writeProjectConfig(badToml)

    try {
      resolveSwarmConfig(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('treats empty config file as valid — all defaults applied', () => {
    writeProjectConfig('')

    const result = resolveSwarmConfig(tmpDir)

    for (const role of ALL_AGENT_ROLES) {
      expect(result.config.models.agents[role]).toEqual({
        backend: 'claude',
        model: 'claude-opus-4-6',
      })
    }
  })

  it('emits stderr warning for unrecognized keys', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'opus' },
      'not-a-valid-role': { backend: 'claude', model: 'opus' },
    })
    writeProjectConfig(toml)

    resolveSwarmConfig(tmpDir)

    expect(stderrSpy).toHaveBeenCalled()
    const output = stderrSpy.mock.calls
      .map(call => String(call[0]))
      .join('')
    expect(output).toContain('not-a-valid-role')
  })
})

// ---------------------------------------------------------------------------
// SC-7: Model name validation
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — model name validation (SC-7)', () => {
  it('resolves known aliases to explicit model IDs', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'opus' },
    })
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.agents.plan.model).toBe('claude-opus-4-6')
  })

  it('accepts model names with dots and hyphens', () => {
    const toml = buildTomlContent({
      plan: { backend: 'opencode', model: 'gpt-5.3' },
    })
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.agents.plan.model).toBe('gpt-5.3')
  })

  it('accepts provider-prefixed model names with forward slash', () => {
    const toml = buildTomlContent({
      plan: { backend: 'opencode', model: 'openai/gpt-5.3' },
    })
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.agents.plan.model).toBe('openai/gpt-5.3')
  })

  it('rejects model names with invalid characters', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'opus; rm -rf /' },
    })
    writeProjectConfig(toml)

    try {
      resolveSwarmConfig(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('rejects empty model names', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: '' },
    })
    writeProjectConfig(toml)

    try {
      resolveSwarmConfig(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('rejects model names exceeding 64 characters', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'a'.repeat(65) },
    })
    writeProjectConfig(toml)

    try {
      resolveSwarmConfig(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })
})

// ---------------------------------------------------------------------------
// Agent field parsing
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — agent field', () => {
  it('parses agent field from TOML assignments', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'opus', agent: 'task-planner' },
      test: { backend: 'claude', model: 'opus' },
      code: { backend: 'claude', model: 'opus' },
      review: { backend: 'claude', model: 'opus' },
      security: { backend: 'claude', model: 'opus' },
      consistency: { backend: 'claude', model: 'opus' },
      merge: { backend: 'claude', model: 'opus' },
      docs: { backend: 'claude', model: 'opus' },
    })
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.agents.plan.agent).toBe('task-planner')
    expect(result.config.models.agents.test.agent).toBeUndefined()
  })

  it('rejects agent names with invalid characters', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'opus', agent: 'bad agent!' },
    })
    writeProjectConfig(toml)

    try {
      resolveSwarmConfig(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('preserves agent in tagged overrides', () => {
    const toml = buildTomlContent({
      plan: { backend: 'claude', model: 'opus' },
      test: { backend: 'claude', model: 'opus' },
      code: { backend: 'claude', model: 'opus' },
      review: { backend: 'claude', model: 'opus' },
      security: { backend: 'claude', model: 'opus' },
      consistency: { backend: 'claude', model: 'opus' },
      merge: { backend: 'claude', model: 'opus' },
      docs: { backend: 'claude', model: 'opus' },
      'code-frontend': { backend: 'opencode', model: 'gemini', agent: 'frontend-coder' },
    })
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.models.tagged['code-frontend']!.agent).toBe('frontend-coder')
  })
})

// ---------------------------------------------------------------------------
// SC-8: Config path validation
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — config path validation (SC-8)', () => {
  it('rejects --config paths that do not end in .toml', () => {
    const jsonPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(jsonPath, '{}', 'utf-8')

    try {
      resolveSwarmConfig(tmpDir, jsonPath)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('accepts --config paths ending in .toml', () => {
    const tomlPath = path.join(tmpDir, 'custom.toml')
    fs.writeFileSync(tomlPath, FULL_TOML, 'utf-8')

    const result = resolveSwarmConfig(tmpDir, tomlPath)

    expect(result.resolvedFrom).toContain('custom.toml')
  })
})

// ---------------------------------------------------------------------------
// getModelAssignment — pure lookup
// ---------------------------------------------------------------------------

describe('getModelAssignment', () => {
  const config = createSwarmConfig({
    models: {
      agents: {
        plan: createModelAssignment({ backend: 'claude', model: 'opus' }),
        test: createModelAssignment({ backend: 'opencode', model: 'gpt-5.3' }),
        code: createModelAssignment({ backend: 'opencode', model: 'codex' }),
        review: createModelAssignment({ backend: 'claude', model: 'opus' }),
        security: createModelAssignment({ backend: 'claude', model: 'opus' }),
        consistency: createModelAssignment({ backend: 'claude', model: 'opus' }),
        merge: createModelAssignment({ backend: 'claude', model: 'opus' }),
        docs: createModelAssignment({ backend: 'claude', model: 'opus' }),
      },
      tagged: {
        'code-frontend': createModelAssignment({
          backend: 'opencode',
          model: 'gemini',
        }),
      },
    },
  })

  it('returns the base role assignment', () => {
    const result = getModelAssignment(config, 'plan')

    expect(result).toEqual({ backend: 'claude', model: 'opus' })
  })

  it('returns the tagged override when tag matches', () => {
    const result = getModelAssignment(config, 'code', 'frontend')

    expect(result).toEqual({ backend: 'opencode', model: 'gemini' })
  })

  it('falls back to base role when tag has no override', () => {
    const result = getModelAssignment(config, 'code', 'infra')

    expect(result).toEqual({ backend: 'opencode', model: 'codex' })
  })

  it('throws on invalid tag format (special characters)', () => {
    try {
      getModelAssignment(config, 'code', '../exploit')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('throws on tag exceeding 32 characters', () => {
    const longTag = 'a'.repeat(33)

    try {
      getModelAssignment(config, 'code', longTag)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })

  it('throws on empty tag string', () => {
    try {
      getModelAssignment(config, 'code', '')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toBe('Not implemented')
    }
  })
})

// ---------------------------------------------------------------------------
// [convergence] config parsing
// ---------------------------------------------------------------------------

describe('resolveSwarmConfig — convergence config', () => {
  it('applies default convergence values when [convergence] section is absent', () => {
    writeProjectConfig(FULL_TOML)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.convergence).toEqual({
      maxIterations: 6,
    })
  })

  it('parses explicit [convergence] values from TOML', () => {
    const toml = `[convergence]
maxIterations = 10

${FULL_TOML}`
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.convergence).toEqual({
      maxIterations: 10,
    })
  })

  it('fills missing convergence fields with defaults', () => {
    const toml = `[convergence]
maxIterations = 8

${FULL_TOML}`
    writeProjectConfig(toml)

    const result = resolveSwarmConfig(tmpDir)

    expect(result.config.convergence).toEqual({
      maxIterations: 8,
    })
  })

  it('includes convergence in built-in defaults when no config file exists', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-conv-'))

    try {
      const result = resolveSwarmConfig(emptyDir)

      expect(result.config.convergence).toEqual({
        maxIterations: 6,
      })
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('throws on invalid convergence values', () => {
    const toml = `[convergence]
maxIterations = 0

${FULL_TOML}`
    writeProjectConfig(toml)

    expect(() => resolveSwarmConfig(tmpDir)).toThrow()
  })
})
