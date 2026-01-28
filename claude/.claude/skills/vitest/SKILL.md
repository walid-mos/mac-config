---
name: vitest
description: Vitest testing best practices and patterns. Use when writing tests, discussing mocking strategies, or reviewing test code.
allowed-tools: Read
---

# Vitest Testing Guide

Complete Vitest testing guide with best practices.

## Quick Rules

- **Test behavior, not implementation**
- **ALWAYS clean up mocks** - #1 cause of flaky tests
- **Mock only external dependencies** (I/O, side effects)
- **Keep pure functions and business logic real**
- Use specific assertions (`toHaveBeenCalledTimes`) not manual inspection

## Mock Cleanup (CRITICAL)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    restoreMocks: true,    // Restore vi.spyOn mocks
    clearMocks: true,      // Clear mock history
    unstubGlobals: true,   // Clean vi.stubGlobal
  }
})

// Manual cleanup in test files
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
```

## Function Mocking

```typescript
// vi.fn() - Standalone mock functions
const mockCallback = vi.fn()
const mockFetch = vi.fn().mockResolvedValue({ ok: true })

// vi.spyOn() - Observe existing functions
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
```

## Module Mocking

```typescript
// Hoisted mocks for shared references
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('./logger', () => mockLogger)

// Partial module mocking
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils')
  return {
    ...actual,
    dangerousFunction: vi.fn().mockReturnValue('safe-value')
  }
})
```

## Global Property Mocking

```typescript
describe('Environment Detection', () => {
  it('should detect browser environment', () => {
    vi.stubGlobal('process', undefined)
    vi.stubGlobal('window', { location: { href: 'https://example.com' } })

    expect(detectEnvironment()).toBe('browser')
  })
})

// WRONG - Hard to clean up
Object.defineProperty(globalThis, 'window', { value: undefined })
```

## Timer Mocking

```typescript
describe('Async Operations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers() // CRITICAL: Always restore
  })

  it('should handle delayed operations', async () => {
    const callback = vi.fn()
    setTimeout(callback, 1000)

    await vi.advanceTimersByTimeAsync(1000)
    expect(callback).toHaveBeenCalled()
  })
})
```

## Network Mocking

```typescript
// Simple fetch mock
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

it('should handle API success', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: 'success' })
  })

  const result = await apiCall('/users')
  expect(result.data).toBe('success')
})
```

## Assertions

```typescript
// Specific assertions
expect(mockFunction).toHaveBeenCalledTimes(1)
expect(mockFunction).toHaveBeenCalledWith('exact', 'arguments')
expect(mockFunction).toHaveBeenNthCalledWith(2, 'second', 'call')

// Asymmetric matchers
expect(apiCall).toHaveBeenCalledWith({
  id: expect.any(String),
  timestamp: expect.any(Number),
  metadata: expect.objectContaining({ source: 'test' })
})

// WRONG - Manual inspection
expect(mockFunction.mock.calls).toHaveLength(1)
```

## Anti-Patterns

```typescript
// WRONG - Testing implementation
it('should call private method', () => {
  const spy = vi.spyOn(instance, '_privateMethod')
  instance.publicMethod()
  expect(spy).toHaveBeenCalled()
})

// CORRECT - Test behavior
it('should process data correctly', () => {
  const result = instance.publicMethod(inputData)
  expect(result).toEqual(expectedOutput)
})
```

```typescript
// WRONG - Over-mocking
vi.mock('./utils', () => ({
  validate: vi.fn().mockReturnValue(true),
  transform: vi.fn().mockReturnValue('transformed'),
  save: vi.fn().mockResolvedValue(undefined)
}))

// CORRECT - Mock only external dependencies
vi.mock('./database') // Mock I/O
vi.mock('./logger') // Mock side effects
// Keep pure functions real
```

## Decision Framework

1. Does this test verify user-facing behavior?
2. Are mocks minimal and necessary?
3. Will this test catch real bugs?
4. Is the test independent and deterministic?
5. Does the test fail for the right reasons?
