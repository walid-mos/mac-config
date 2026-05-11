# Logger API

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
- `scope` - override the parent scope
- `prefix` - override the parent prefix
- `minLevel` - override the parent min level
- `requestId` - override the parent request ID

Everything else (transports, environment, silent, includeLocation) is inherited.

---

## Log objects

The second argument to any log method is an optional `LogObject`:

```typescript
logger.info('User created', {
  scope: 'users',                    // Override logger's default scope for this call
  requestId: 'req-xyz',             // Override request ID for this call
  details: { userId: 42, role: 'admin' },  // Arbitrary data
  status: 201,                       // HTTP status code
})
```

| Field | Type | Purpose |
|-------|------|---------|
| `scope` | `string` | Per-call scope override |
| `requestId` | `string` | Per-call request ID override |
| `details` | `unknown` | Arbitrary structured data |
| `status` | `number` | HTTP status code |
| `[key: string]` | `unknown` | Additional arbitrary fields |

---

## Disposal

`dispose()` is on the `NextNodeLogger` class (not the `Logger` interface). Use it to flush buffered transports on shutdown:

```typescript
process.on('SIGTERM', async () => {
  await logger.dispose()  // Flushes buffered logs in all transports
  process.exit(0)
})
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
}

interface LoggerConfig {
  environment?: Environment
  prefix?: string
  scope?: string
  includeLocation?: boolean
  minLevel?: LogLevel
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
  object?: Omit<LogObject, 'scope'>
}

interface Transport {
  log(entry: LogEntry): void | Promise<void>
  dispose?(): void | Promise<void>
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type Environment = 'development' | 'production'
type RuntimeEnvironment = 'node' | 'browser' | 'webworker' | 'unknown'
```
