# Testing Utilities

Import from the dedicated testing entry point:

```typescript
import { createSpyLogger, createMockLogger, createNoopLogger } from '@nextnode-solutions/logger/testing'
```

## Which logger to use

| Scenario | Logger | Why |
|----------|--------|-----|
| Assert that a specific message was logged (content, level, call count) | `createSpyLogger()` | `SpyLogger` provides `.wasCalledWith()`, `.getCallsByLevel()`, `.calls` — high-level query API |
| Assert on the exact arguments passed to each log call (shape, order) | `createMockLogger()` | `MockLogger` exposes `.mock.calls` — same interface as vitest/jest mock functions |
| Logger is a required dep but the test does not care about logging at all | `createNoopLogger()` | Discards everything silently — zero noise, zero overhead |

FORBIDDEN: manual logger mock (e.g. `{ info: vi.fn(), debug: vi.fn(), ... }`). Use the factory functions above.

## Spy logger

Returns a `SpyLogger` directly - records all log calls with query methods:

```typescript
const spy = createSpyLogger()

myFunction(spy)

expect(spy.wasCalledWith('expected message')).toBe(true)
expect(spy.wasCalledWithLevel('info', 'expected message')).toBe(true)
expect(spy.calls).toHaveLength(1)
expect(spy.calls[0].level).toBe('info')
expect(spy.getCallsByLevel('error')).toHaveLength(0)
expect(spy.getLastCall()?.message).toBe('expected message')

spy.clear() // Reset between tests
```

`SpyLogger` extends `Logger` and adds:

| Method | Returns | Purpose |
|--------|---------|---------|
| `calls` | `LogEntry[]` | All recorded log entries |
| `getCallsByLevel(level)` | `LogEntry[]` | Filter calls by level |
| `getLastCall()` | `LogEntry \| undefined` | Most recent call |
| `wasCalledWith(message)` | `boolean` | Check if any call includes message |
| `wasCalledWithLevel(level, message)` | `boolean` | Check by level + message |
| `clear()` | `void` | Reset recorded calls |
| `child(config)` | `SpyLogger` | Child spy sharing the same calls array |

## Mock logger

Returns a `MockLogger` directly with trackable mock functions (works without vitest/jest):

```typescript
const mock = createMockLogger()

myService.process(mock)

expect(mock.info.mock.calls).toHaveLength(1)
expect(mock.info.mock.calls[0][0]).toBe('Expected message')
```

## Noop logger

Silent logger that discards everything - satisfies a `Logger` dependency with no output:

```typescript
const logger = createNoopLogger()
```
