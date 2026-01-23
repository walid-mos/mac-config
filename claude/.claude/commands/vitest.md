---
allowed-tools: Read
description: Vitest testing best practices and patterns
---

# /vitest

Complete Vitest testing guide with best practices.

---

## Core Testing Philosophy

- **Test behavior, not implementation**: Focus on what code does, not how
- **Isolate dependencies**: Mock external dependencies
- **Maintain test independence**: Each test runs independently
- **Keep tests simple**: One assertion per test when possible

---

## Mock Cleanup (CRITICAL)

**ALWAYS clean up mocks between tests** - #1 cause of flaky tests:

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

---

## Function Mocking

```typescript
// vi.fn() - Standalone mock functions
const mockCallback = vi.fn()
const mockFetch = vi.fn().mockResolvedValue({ ok: true })

// vi.spyOn() - Observe existing functions
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
```

---

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

---

## Global Property Mocking

```typescript
describe('Environment Detection', () => {
  it('should detect browser environment', () => {
    vi.stubGlobal('process', undefined)
    vi.stubGlobal('window', { location: { href: 'https://example.com' } })
    vi.stubGlobal('document', { createElement: vi.fn() })

    expect(detectEnvironment()).toBe('browser')
  })
})

// WRONG - Manual property manipulation
Object.defineProperty(globalThis, 'window', { value: undefined }) // Hard to clean up
```

---

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

  it('should mock system time', () => {
    vi.setSystemTime(new Date('2024-01-01'))
    expect(new Date()).toEqual(new Date('2024-01-01'))
  })
})
```

---

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

// MSW for complex API mocking
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users', () => HttpResponse.json({ users: [] }))
)

beforeAll(() => server.listen())
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
```

---

## File System Mocking

```typescript
import { fs } from 'memfs'

vi.mock('node:fs/promises', () => fs.promises)
vi.mock('node:fs', () => fs)

describe('File Operations', () => {
  beforeEach(() => {
    fs.mkdirSync('/test', { recursive: true })
    fs.writeFileSync('/test/config.json', '{"setting": "value"}')
  })

  afterEach(() => {
    fs.rmSync('/test', { recursive: true, force: true })
  })
})
```

---

## Assertions

```typescript
// Specific assertions
expect(mockFunction).toHaveBeenCalledTimes(1)
expect(mockFunction).toHaveBeenCalledWith('exact', 'arguments')
expect(mockFunction).toHaveBeenNthCalledWith(2, 'second', 'call')
expect(mockFunction).toHaveBeenLastCalledWith('last', 'call')

// Asymmetric matchers
expect(apiCall).toHaveBeenCalledWith({
  id: expect.any(String),
  timestamp: expect.any(Number),
  metadata: expect.objectContaining({
    source: 'test'
  })
})

// WRONG - Manual call inspection
expect(mockFunction.mock.calls).toHaveLength(1) // Use toHaveBeenCalledTimes
```

---

## Anti-Patterns

### Testing Implementation vs Behavior
```typescript
// WRONG - Testing implementation details
it('should call private method', () => {
  const spy = vi.spyOn(instance, '_privateMethod')
  instance.publicMethod()
  expect(spy).toHaveBeenCalled()
})

// CORRECT - Test behavior and outcomes
it('should process data correctly', () => {
  const result = instance.publicMethod(inputData)
  expect(result).toEqual(expectedOutput)
})
```

### Over-Mocking
```typescript
// WRONG - Mocking everything
vi.mock('./utils', () => ({
  validate: vi.fn().mockReturnValue(true),
  transform: vi.fn().mockReturnValue('transformed'),
  save: vi.fn().mockResolvedValue(undefined)
}))

// CORRECT - Mock only external dependencies
vi.mock('./database') // Mock I/O
vi.mock('./logger') // Mock side effects
// Keep pure functions and business logic real
```

---

## Configuration

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom'
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    mockReset: false, // Preserve mock implementations
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
    },
    setupFiles: ['./test/setup.ts'],
  }
})
```

---

## Decision Framework

1. Does this test verify user-facing behavior?
2. Are mocks minimal and necessary?
3. Will this test catch real bugs?
4. Is the test independent and deterministic?
5. Does the test fail for the right reasons?
