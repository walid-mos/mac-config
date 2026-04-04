# Testing Utilities

Import from the dedicated testing entry point:

```typescript
import { createSpyLogger, createMockLogger, createNoopLogger } from '@nextnode-solutions/logger/testing'
```

## Spy logger

Records all log calls for assertions:

```typescript
const { logger, spy } = createSpyLogger()

myFunction(logger)

expect(spy.info).toHaveBeenCalledWith('expected message', expect.objectContaining({
  scope: 'users',
}))
expect(spy.error).not.toHaveBeenCalled()
```

## Mock logger

A logger with mock functions (vi.fn()) — same as spy but without console output:

```typescript
const { logger, mock } = createMockLogger()

myService.process(logger)

expect(mock.warn).toHaveBeenCalledTimes(1)
```

## Noop logger

Silent logger that discards everything — use when you need to satisfy a Logger dependency but don't care about output:

```typescript
const logger = createNoopLogger()
// All methods are no-ops
```
