import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'node:child_process'
import { createDriverRegistry } from '../../src/drivers/driver-registry.js'
import type { DriverRegistry, DriverResolution, BackendName } from '../../src/drivers/driver.js'
import type { ModelId } from '../../src/core/types.js'
import {
  createSwarmConfig,
  createMixedBackendConfig,
  createMockEmitter,
  createMockChildProcess,
} from '../__test-utils__/factories.js'

// ---------------------------------------------------------------------------
// Test-wide helpers
// ---------------------------------------------------------------------------

let emitter: ReturnType<typeof createMockEmitter>

beforeEach(() => {
  emitter = createMockEmitter()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createDriverRegistry', () => {
  it('returns a DriverRegistry with getDriver and checkAll methods', () => {
    const config = createSwarmConfig()
    const registry = createDriverRegistry(config, emitter)

    expect(typeof registry.getDriver).toBe('function')
    expect(typeof registry.checkAll).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// getDriver — basic routing
// ---------------------------------------------------------------------------

describe('getDriver() — basic routing', () => {
  it('returns DriverResolution with correct driver for a claude-backed role', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    const resolution = registry.getDriver('plan')

    expect(resolution).toBeDefined()
    expect(resolution.driver).toBeDefined()
    expect(resolution.driver.name).toBe('claude')
    expect(resolution.model).toBe('opus')
  })

  it('returns DriverResolution with correct driver for an opencode-backed role', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    const resolution = registry.getDriver('code')

    expect(resolution.driver.name).toBe('opencode')
    expect(resolution.model).toBe('openai/gpt-5.3-codex')
  })

  it('returns correct model for each role', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    // Test a few roles from the mixed config
    expect(registry.getDriver('test').model).toBe('gpt-5.3')
    expect(registry.getDriver('review').model).toBe('opus')
    expect(registry.getDriver('docs').model).toBe('moonshot/kimi-k2.5')
  })

  it('returns same driver instance for same backend across roles', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    // plan and review both use claude
    const planDriver = registry.getDriver('plan').driver
    const reviewDriver = registry.getDriver('review').driver
    expect(planDriver).toBe(reviewDriver)
  })
})

// ---------------------------------------------------------------------------
// getDriver — tag routing
// ---------------------------------------------------------------------------

describe('getDriver() — tag routing', () => {
  it('returns tagged model assignment when tag override exists', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    const resolution = registry.getDriver('code', 'frontend')

    expect(resolution.driver.name).toBe('opencode')
    expect(resolution.model).toBe('google/gemini-2.5-pro')
  })

  it('falls back to base role when tag override does not exist', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    // 'code-nonexistent' is not in tagged, so should fall back to 'code' base
    const resolution = registry.getDriver('code', 'nonexistent')

    expect(resolution.driver.name).toBe('opencode')
    expect(resolution.model).toBe('openai/gpt-5.3-codex')
  })

  it('returns tagged backend model for code-backend', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    const resolution = registry.getDriver('code', 'backend')

    expect(resolution.model).toBe('openai/gpt-5.3-codex')
  })
})

// ---------------------------------------------------------------------------
// getDriver — DriverResolution shape
// ---------------------------------------------------------------------------

describe('getDriver() — DriverResolution shape', () => {
  it('returns an object with driver and model properties', () => {
    const config = createSwarmConfig()
    const registry = createDriverRegistry(config, emitter)

    const resolution = registry.getDriver('plan')

    expect(resolution).toHaveProperty('driver')
    expect(resolution).toHaveProperty('model')
    expect(typeof resolution.driver.name).toBe('string')
    expect(typeof resolution.model).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// checkAll — availability
// ---------------------------------------------------------------------------

describe('checkAll() — availability', () => {
  it('returns availability for both backends', async () => {
    const config = createSwarmConfig()
    const registry = createDriverRegistry(config, emitter)

    // Mock spawn for both claude and opencode availability checks
    const mockClaude = createMockChildProcess(1001)
    const mockOpenCode = createMockChildProcess(1002)
    let callCount = 0
    vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
      callCount++
      // Return different mock processes for different calls
      const proc = callCount === 1 ? mockClaude : mockOpenCode
      return proc as unknown as childProcess.ChildProcess
    })

    const checkPromise = registry.checkAll()

    // Simulate both availability checks completing
    mockClaude.simulateOutput('claude v1.0.42\n')
    mockOpenCode.simulateOutput('opencode v2.1.0\n')

    const result = await checkPromise

    // Both backend keys must be present
    expect(result).toHaveProperty('claude')
    expect(result).toHaveProperty('opencode')
  })

  it('returns Record<BackendName, DriverAvailability> shape', async () => {
    const config = createSwarmConfig()
    const registry = createDriverRegistry(config, emitter)

    const mockClaude = createMockChildProcess(2001)
    const mockOpenCode = createMockChildProcess(2002)
    let callCount = 0
    vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
      callCount++
      const proc = callCount === 1 ? mockClaude : mockOpenCode
      return proc as unknown as childProcess.ChildProcess
    })

    const checkPromise = registry.checkAll()

    mockClaude.simulateOutput('claude v1.0.42\n')
    mockOpenCode.simulateOutput('opencode v2.1.0\n')

    const result = await checkPromise

    // Each entry should have the DriverAvailability discriminated union shape
    for (const backend of ['claude', 'opencode'] as BackendName[]) {
      const avail = result[backend]
      expect(avail).toBeDefined()
      if (avail.available) {
        expect(typeof avail.version).toBe('string')
      } else {
        expect(typeof avail.error).toBe('string')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// All backend names mapped
// ---------------------------------------------------------------------------

describe('backend name coverage', () => {
  it('supports all BackendName values (claude and opencode)', () => {
    const config = createMixedBackendConfig()
    const registry = createDriverRegistry(config, emitter)

    // Roles using claude backend
    const claudeResolution = registry.getDriver('plan')
    expect(claudeResolution.driver.name).toBe('claude')

    // Roles using opencode backend
    const opencodeResolution = registry.getDriver('code')
    expect(opencodeResolution.driver.name).toBe('opencode')
  })
})
