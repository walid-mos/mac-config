# Vitest Best Practices: Complete Testing Guide

## Core Testing Philosophy
- **Test behavior, not implementation**: Focus on what your code does, not how it does it
- **Isolate dependencies**: Mock external dependencies to test your code in isolation
- **Maintain test independence**: Each test should run independently without relying on others
- **Keep tests simple**: One assertion per test when possible, clear test names

## Mock Cleanup (CRITICAL)
**ALWAYS clean up mocks between tests** - This is the #1 cause of flaky tests:

```typescript
// ✅ CORRECT - Automatic cleanup in vitest.config.ts
export default defineConfig({
  test: {
    restoreMocks: true,    // Automatically restore vi.spyOn mocks
    clearMocks: true,      // Clear mock history and reset implementation
    unstubGlobals: true,   // Clean vi.stubGlobal between tests
  }
})

// ✅ CORRECT - Manual cleanup in test files
describe('Test Suite', () => {
  afterEach(() => {
    vi.clearAllMocks()     // Clear call history but keep implementation
    vi.restoreAllMocks()   // Restore original implementations
    vi.unstubAllGlobals()  // Restore global properties
    vi.useRealTimers()     // Restore real timers if using fake ones
  })
})

// ❌ WRONG - No cleanup leads to test interference
describe('Flaky Tests', () => {
  // Tests influence each other, causing random failures
})
```

## Function Mocking Strategies

**vi.fn() vs vi.spyOn() - When to Use Each:**

```typescript
// ✅ vi.fn() - Create standalone mock functions
const mockCallback = vi.fn()
const mockFetch = vi.fn().mockResolvedValue({ ok: true })

// ✅ vi.spyOn() - Observe existing functions while keeping original behavior
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

// ✅ Partial mocking - Mock only specific methods
vi.spyOn(MyClass.prototype, 'method').mockReturnValue('mocked')

// ❌ WRONG - Don't create unnecessary spies
const unnecessarySpy = vi.spyOn(obj, 'method') // If you don't need to observe
```

## Module Mocking Best Practices

**Hoisted Mocks for Better Control:**
```typescript
// ✅ CORRECT - Use vi.hoisted() for shared mock references
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('./logger', () => mockLogger)

describe('Tests', () => {
  it('should log info', () => {
    myFunction()
    expect(mockLogger.info).toHaveBeenCalledWith('Expected message')
  })
})

// ✅ CORRECT - Partial module mocking
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils')
  return {
    ...actual,
    dangerousFunction: vi.fn().mockReturnValue('safe-value')
  }
})

// ❌ WRONG - Don't mock everything when you need some real functionality
vi.mock('./utils', () => ({
  // This breaks all other functions you might need
  onlyMockingThis: vi.fn()
}))
```

## Global Property Mocking

**Environment-Safe Global Mocking:**
```typescript
// ✅ CORRECT - Use vi.stubGlobal() for clean mocking
describe('Environment Detection', () => {
  it('should detect browser environment', () => {
    vi.stubGlobal('process', undefined)
    vi.stubGlobal('window', { location: { href: 'https://example.com' } })
    vi.stubGlobal('document', { createElement: vi.fn() })

    expect(detectEnvironment()).toBe('browser')
  })

  it('should detect Node.js environment', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('process', {
      versions: { node: '18.0.0' },
      env: { NODE_ENV: 'test' }
    })

    expect(detectEnvironment()).toBe('nodejs')
  })
})

// ❌ WRONG - Manual property manipulation
Object.defineProperty(globalThis, 'window', { value: undefined }) // Hard to clean up
delete globalThis.process // Can cause issues
```

## Time and Timer Mocking

**Proper Timer Mocking:**
```typescript
// ✅ CORRECT - Mock timers properly with cleanup
describe('Async Operations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers() // CRITICAL: Always restore real timers
  })

  it('should handle delayed operations', async () => {
    const callback = vi.fn()
    setTimeout(callback, 1000)

    await vi.advanceTimersByTimeAsync(1000)
    expect(callback).toHaveBeenCalled()
  })

  it('should mock system time', () => {
    const mockDate = new Date('2024-01-01')
    vi.setSystemTime(mockDate)

    expect(new Date()).toEqual(mockDate)
  })
})

// ❌ WRONG - Forgetting to restore timers affects other tests
vi.useFakeTimers()
// Test code...
// Forgot vi.useRealTimers() - breaks subsequent tests
```

## Network Request Mocking

**API Mocking Strategies:**
```typescript
// ✅ CORRECT - Mock fetch with proper error handling
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

it('should handle API errors', async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 404,
    statusText: 'Not Found'
  })

  await expect(apiCall('/nonexistent')).rejects.toThrow('Not Found')
})

// ✅ CORRECT - Use MSW for complex API mocking
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json({ users: [] })
  })
)

beforeAll(() => server.listen())
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
```

## File System Mocking

**Safe File System Testing:**
```typescript
// ✅ CORRECT - Use memfs for file system mocking
import { fs } from 'memfs'

vi.mock('node:fs/promises', () => fs.promises)
vi.mock('node:fs', () => fs)

describe('File Operations', () => {
  beforeEach(() => {
    // Create in-memory file system
    fs.mkdirSync('/test', { recursive: true })
    fs.writeFileSync('/test/config.json', '{"setting": "value"}')
  })

  afterEach(() => {
    fs.rmSync('/test', { recursive: true, force: true })
  })

  it('should read configuration', async () => {
    const config = await readConfig('/test/config.json')
    expect(config.setting).toBe('value')
  })
})

// ❌ WRONG - Don't mock with incomplete implementations
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('{}') // Too simplistic
}))
```

## Advanced Assertions

**Use Vitest's Powerful Assertions:**
```typescript
// ✅ CORRECT - Use specific assertions
expect(mockFunction).toHaveBeenCalledTimes(1)
expect(mockFunction).toHaveBeenCalledWith('exact', 'arguments')
expect(mockFunction).toHaveBeenNthCalledWith(2, 'second', 'call')
expect(mockFunction).toHaveBeenLastCalledWith('last', 'call')
expect(mockFunction).toHaveReturnedWith('expected-value')

// ✅ CORRECT - Use asymmetric matchers
expect(apiCall).toHaveBeenCalledWith({
  id: expect.any(String),
  timestamp: expect.any(Number),
  metadata: expect.objectContaining({
    source: 'test'
  })
})

// ❌ WRONG - Manual call inspection
expect(mockFunction.mock.calls).toHaveLength(1) // Use toHaveBeenCalledTimes instead
expect(mockFunction.mock.calls[0]).toEqual([...]) // Use toHaveBeenCalledWith instead
```

## Common Anti-Patterns to Avoid

**Testing Implementation vs Behavior:**
```typescript
// ❌ WRONG - Testing implementation details
it('should call private method', () => {
  const spy = vi.spyOn(instance, '_privateMethod')
  instance.publicMethod()
  expect(spy).toHaveBeenCalled() // Don't test private methods
})

// ✅ CORRECT - Test behavior and outcomes
it('should process data correctly', () => {
  const result = instance.publicMethod(inputData)
  expect(result).toEqual(expectedOutput) // Test what the user sees
})
```

**Over-Mocking:**
```typescript
// ❌ WRONG - Mocking everything makes tests brittle
vi.mock('./utils', () => ({
  validate: vi.fn().mockReturnValue(true),
  transform: vi.fn().mockReturnValue('transformed'),
  save: vi.fn().mockResolvedValue(undefined)
}))

// ✅ CORRECT - Mock only external dependencies
vi.mock('./database') // Mock I/O
vi.mock('./logger') // Mock side effects
// Keep pure functions and business logic real
```

## Configuration Best Practices

**Optimal vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    globals: true,           // Use global describe, it, expect
    environment: 'node',     // Or 'jsdom' for DOM testing
    restoreMocks: true,      // Auto-restore spies
    clearMocks: true,        // Auto-clear mock history
    unstubGlobals: true,     // Auto-unstub globals
    mockReset: false,        // Keep false to preserve mock implementations
    coverage: {
      provider: 'v8',        // Use V8 for better performance
      reporter: ['text', 'html', 'json'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
    },
    setupFiles: ['./test/setup.ts'], // Global test setup
  }
})
```

## Testing Decision Framework
1. **Does this test verify user-facing behavior?** (If no, reconsider the test)
2. **Are mocks minimal and necessary?** (Mock I/O, keep business logic real)
3. **Will this test catch real bugs?** (Integration tests often catch more bugs)
4. **Is the test independent and deterministic?** (No shared state between tests)
5. **Does the test fail for the right reasons?** (Test the failure cases too)