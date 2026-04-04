---
name: nextnode-logger
description: >-
  How to use @nextnode-solutions/logger in NextNode projects. Covers the Logger
  API, child loggers, transports (console, HTTP), formatters, testing utilities,
  and integration patterns.
user-invocable: true
---

# @nextnode-solutions/logger

A lightweight, zero-dependency TypeScript logging library for NextNode projects. Features scope-based organization, environment-aware formatting, pluggable transports, and runtime detection (Node.js, browser, webworker).

## Arguments

- No argument: full usage guide
- `api`: Logger class API reference
- `transports`: console and HTTP transports
- `testing`: spy/mock/noop loggers for tests
- `setup`: installation and configuration in a project

## Instructions

### Phase 1: Read the project

1. Read `package.json` — check if `@nextnode-solutions/logger` is installed
2. Search for existing logger usage (`import.*@nextnode-solutions/logger`)
3. Identify the logging patterns already in place

### Phase 2: Provide guidance

Based on the argument and current project state, explain the relevant part of the logger API. Always show concrete code examples.

---

## Installation

```bash
pnpm add @nextnode-solutions/logger
```

No peer dependencies. Zero runtime dependencies.

---

## Exports

The package has three entry points:

| Import path | What it provides |
|------------|-----------------|
| `@nextnode-solutions/logger` | Core logger class, factory, default instance, formatters, types, utilities |
| `@nextnode-solutions/logger/testing` | Spy logger, mock logger, noop logger for tests |
| `@nextnode-solutions/logger/transports/http` | HTTP transport for log aggregation |

---

## Basic usage

```typescript
import { logger } from '@nextnode-solutions/logger'

// Use the default instance
logger.info('Server started', { scope: 'http', details: { port: 3000 } })
logger.warn('Slow query detected', { details: { duration: 1500 } })
logger.error('Failed to connect', { details: { error } })
logger.debug('Request payload', { details: { body } })
```

### Log levels (priority order)

| Level | Priority | When to use |
|-------|----------|-------------|
| `debug` | 0 | Detailed diagnostic info, development only |
| `info` | 1 | Normal operational events |
| `warn` | 2 | Something unexpected but recoverable |
| `error` | 3 | Something failed, needs attention |

Logs below `minLevel` are silently dropped. Default: `debug` (all logs).

---

## Creating a custom logger

```typescript
import { createLogger, ConsoleTransport } from '@nextnode-solutions/logger'

const logger = createLogger({
  minLevel: 'info',         // Skip debug logs
  prefix: '[MyApp]',        // Prepend to all messages
  scope: 'api',             // Default scope for all logs
  environment: 'production', // 'development' | 'production'
  silent: false,            // true = suppress all output
  requestId: 'req-abc-123', // Trace ID for request correlation
  includeLocation: false,   // true = include file:line in dev
  transports: [             // Custom transport stack
    new ConsoleTransport({ environment: 'production' }),
  ],
})
```

All config fields are optional. Sensible defaults are applied:
- `environment`: auto-detected from `NODE_ENV` and runtime
- `includeLocation`: true in development, false in production
- `transports`: `[new ConsoleTransport()]` with auto-detected environment

---

## Child loggers

Create scoped loggers that inherit parent config:

```typescript
const appLogger = createLogger({ prefix: '[App]', requestId: 'req-123' })

// Child inherits prefix, requestId, transports, environment, minLevel
const dbLogger = appLogger.child({ scope: 'database' })
const authLogger = appLogger.child({ scope: 'auth', minLevel: 'warn' })

dbLogger.info('Query executed')   // -> [App] Query executed (scope: database, requestId: req-123)
authLogger.debug('Token check')   // -> silenced (minLevel is warn)
```

Child config options:
- `scope` — override the parent scope
- `prefix` — override the parent prefix
- `minLevel` — override the parent min level
- `requestId` — override the parent request ID

Everything else (transports, environment, silent, includeLocation) is inherited.

---

## Log objects

The second argument to any log method is an optional `LogObject`:

```typescript
logger.info('User created', {
  scope: 'users',                    // Override logger's default scope for this call
  requestId: 'req-xyz',             // Override request ID for this call
  details: { userId: 42, role: 'admin' }  // Arbitrary data attached to the log entry
})
```

| Field | Type | Purpose |
|-------|------|---------|
| `scope` | `string` | Per-call scope override |
| `requestId` | `string` | Per-call request ID override |
| `details` | `Record<string, unknown>` | Arbitrary structured data |

---

## Transports

### ConsoleTransport (default)

Auto-detects the runtime and uses the appropriate formatter:
- **Node.js**: ANSI-colored output with `formatForNode`
- **Browser**: CSS-styled console output with `formatForBrowser`
- **Production**: JSON structured output with `formatAsJson`

```typescript
import { ConsoleTransport } from '@nextnode-solutions/logger'

const transport = new ConsoleTransport({
  environment: 'development',  // Force environment (default: auto-detect)
})
```

### HttpTransport

Sends logs to a remote endpoint with batching and retry:

```typescript
import { HttpTransport } from '@nextnode-solutions/logger/transports/http'

const httpTransport = new HttpTransport({
  endpoint: 'https://logs.example.com/ingest',
  batchSize: 50,           // Flush after N logs (default: 50)
  flushInterval: 5000,     // Flush every N ms (default: 5000)
  maxRetries: 3,           // Retry on failure (default: 3)
  headers: {               // Custom headers
    'Authorization': 'Bearer token',
  },
})
```

Features:
- Batches logs and flushes periodically or when batch is full
- Exponential backoff on retry
- SSRF protection (validates endpoint URL)
- Call `transport.dispose()` on shutdown to flush remaining logs

### Using multiple transports

```typescript
const logger = createLogger({
  transports: [
    new ConsoleTransport({ environment: 'production' }),
    new HttpTransport({ endpoint: 'https://logs.example.com/ingest' }),
  ],
})
```

---

## Formatters

Available for direct use if you need custom formatting:

```typescript
import { formatForNode, formatForBrowser, formatAsJson, formatAsJsonPretty } from '@nextnode-solutions/logger'
```

| Formatter | Output | Use case |
|-----------|--------|----------|
| `formatForNode` | ANSI-colored string | Terminal output |
| `formatForBrowser` | CSS-styled args | Browser DevTools |
| `formatAsJson` | JSON string | Log aggregation, structured logging |
| `formatAsJsonPretty` | Pretty-printed JSON | Human-readable JSON |

---

## Utilities

```typescript
import {
  generateRequestId,    // Generates a unique request ID (crypto-based)
  detectRuntime,        // Returns 'node' | 'browser' | 'webworker'
  detectEnvironment,    // Returns 'development' | 'production'
  parseLocation,        // Extracts file:line from stack trace
  safeStringify,        // JSON.stringify with circular reference handling
  getCurrentTimestamp,  // ISO 8601 timestamp
} from '@nextnode-solutions/logger'
```

### Request ID generation

```typescript
import { generateRequestId } from '@nextnode-solutions/logger'

// In a middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] ?? generateRequestId()
  req.logger = appLogger.child({ requestId: req.requestId })
  next()
})
```

---

## Disposal

If using transports that buffer logs (like HttpTransport), call `dispose()` on shutdown:

```typescript
process.on('SIGTERM', async () => {
  await logger.dispose()  // Flushes buffered logs in all transports
  process.exit(0)
})
```

---

## Testing utilities

Import from the dedicated testing entry point:

```typescript
import { createSpyLogger, createMockLogger, createNoopLogger } from '@nextnode-solutions/logger/testing'
```

### Spy logger

Records all log calls for assertions:

```typescript
const { logger, spy } = createSpyLogger()

myFunction(logger)

expect(spy.info).toHaveBeenCalledWith('expected message', expect.objectContaining({
  scope: 'users',
}))
expect(spy.error).not.toHaveBeenCalled()
```

### Mock logger

A logger with mock functions (vi.fn()) — same as spy but without console output:

```typescript
const { logger, mock } = createMockLogger()

myService.process(logger)

expect(mock.warn).toHaveBeenCalledTimes(1)
```

### Noop logger

Silent logger that discards everything — use when you need to satisfy a Logger dependency but don't care about output:

```typescript
const logger = createNoopLogger()
// All methods are no-ops
```

---

## Common patterns

### Per-request logger (Express/Fastify)

```typescript
import { createLogger, generateRequestId } from '@nextnode-solutions/logger'

const appLogger = createLogger({ scope: 'api', environment: 'production' })

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string ?? generateRequestId()
  req.logger = appLogger.child({ requestId })
  req.logger.info('Request received', { details: { method: req.method, url: req.url } })
  next()
})
```

### Module-scoped logger

```typescript
import { createLogger } from '@nextnode-solutions/logger'

const logger = createLogger({ scope: 'database' })

export function query(sql: string): Result {
  logger.debug('Executing query', { details: { sql } })
  // ...
}
```

### Dependency injection

```typescript
import type { Logger } from '@nextnode-solutions/logger'

class UserService {
  constructor(private readonly logger: Logger) {}

  createUser(data: UserData): User {
    this.logger.info('Creating user', { details: { email: data.email } })
    // ...
  }
}

// Production
const service = new UserService(createLogger({ scope: 'users' }))

// Tests
const { logger, spy } = createSpyLogger()
const service = new UserService(logger)
```

---

## Types reference

```typescript
interface Logger {
  debug(message: string, object?: LogObject): void
  info(message: string, object?: LogObject): void
  warn(message: string, object?: LogObject): void
  error(message: string, object?: LogObject): void
  child(config: ChildLoggerConfig): Logger
  dispose(): Promise<void>
}

interface LoggerConfig {
  environment?: Environment        // 'development' | 'production'
  prefix?: string
  scope?: string
  includeLocation?: boolean
  minLevel?: LogLevel              // 'debug' | 'info' | 'warn' | 'error'
  silent?: boolean
  transports?: Transport[]
  requestId?: string
}

interface ChildLoggerConfig {
  scope?: string
  prefix?: string
  minLevel?: LogLevel
  requestId?: string
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  location: DevelopmentLocationInfo | ProductionLocationInfo
  requestId: string
  scope?: string
  object?: Record<string, unknown>
}

interface Transport {
  log(entry: LogEntry): void
  dispose?(): Promise<void>
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type Environment = 'development' | 'production'
type RuntimeEnvironment = 'node' | 'browser' | 'webworker'
```

## Rules

1. **Use the logger, not console** — oxlint warns on `console.log`. Use `@nextnode-solutions/logger` instead.
2. **Inject loggers via constructor/parameter** — Don't import a global logger in business logic. Accept a `Logger` interface for testability.
3. **Use child loggers for request context** — Create a child logger per request with the request ID. Don't pass request IDs manually to each log call.
4. **Scope by domain, not by file** — Use scopes like `'auth'`, `'database'`, `'api'` — not file names.
5. **Dispose on shutdown** — If using HttpTransport, always call `dispose()` to flush buffered logs.
6. **Use testing utilities in tests** — Never mock the logger manually. Use `createSpyLogger()` or `createMockLogger()` from `@nextnode-solutions/logger/testing`.
