---
name: logger
description: "@nextnode-solutions/logger standards. Reference this skill when a project uses @nextnode-solutions/logger or when logger integration is being added."
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
version: 0.3.2
---

# @nextnode-solutions/logger Standards

## Overview

Zero-dependency TypeScript logging library. ESM-only, Node.js 20+, browser, and web worker support. Three export paths:

- `@nextnode-solutions/logger` — core logger + formatters + utilities
- `@nextnode-solutions/logger/testing` — spy, noop, and mock loggers
- `@nextnode-solutions/logger/transports/http` — HTTP transport with batching

## Architecture

```
src/
  logger.ts              # Entry point: NextNodeLogger class, createLogger, default logger
  types.ts               # All types: LogLevel, Environment, LogEntry, Logger, Transport, etc.
  formatters/
    console-node.ts      # ANSI colorized output for terminals
    console-browser.ts   # CSS-styled output for DevTools
    json.ts              # Structured JSON for production/log aggregation
    shared.ts            # Shared formatting helpers (location display)
  transports/
    transport.ts         # Transport + TransportConfig interfaces
    console.ts           # ConsoleTransport (auto-detects runtime format)
    http.ts              # HttpTransport (batching, retry, exponential backoff)
  testing/
    test-utils.ts        # createSpyLogger, createNoopLogger, createMockLogger
  utils/
    crypto.ts            # generateRequestId (crypto.randomUUID → req_XXXXXXXX)
    environment.ts       # detectRuntime, hasCryptoSupport
    location.ts          # parseLocation (stack trace), detectEnvironment (NODE_ENV)
    scope.ts             # extractScope (separates scope from LogObject)
    serialization.ts     # safeStringify (circular refs, special types)
    time.ts              # getCurrentTimestamp, formatTimeForDisplay
```

## Key Types

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type Environment = 'development' | 'production'
type RuntimeEnvironment = 'node' | 'browser' | 'webworker' | 'unknown'

interface LogObject {
  readonly scope?: string
  readonly details?: unknown
  readonly status?: number
  readonly [key: string]: unknown
}

interface LoggerConfig {
  readonly prefix?: string           // Prepended to all messages
  readonly environment?: Environment // Auto-detected from NODE_ENV
  readonly includeLocation?: boolean // Default: true
  readonly minLevel?: LogLevel       // Default: 'debug'
  readonly silent?: boolean          // Default: false
  readonly transports?: Transport[]  // Default: [ConsoleTransport]
}

interface Logger {
  debug(message: string, object?: LogObject): void
  info(message: string, object?: LogObject): void
  warn(message: string, object?: LogObject): void
  error(message: string, object?: LogObject): void
}

// Core Transport (types.ts) — used by Logger interface
interface Transport {
  log(entry: LogEntry): void | Promise<void>
}

// Extended Transport (transports/transport.ts) — used by transport implementations
interface Transport {
  log(entry: LogEntry): void | Promise<void>
  dispose?(): void | Promise<void>
}

interface TransportConfig {
  enabled?: boolean  // Base config extended by ConsoleTransportConfig, HttpTransportConfig
}

interface ConsoleTransportConfig extends TransportConfig {
  environment?: Environment
  format?: 'auto' | 'node' | 'browser' | 'json'  // Default: 'auto'
}

interface HttpTransportConfig extends TransportConfig {
  endpoint: string                                    // Required, http/https only
  headers?: Record<string, string>                    // Restricted: host, content-length, transfer-encoding
  batchSize?: number                                  // Default: 10
  flushInterval?: number                              // Default: 5000ms
  timeout?: number                                    // Default: 10000ms
  maxRetries?: number                                 // Default: 3 (exponential backoff: 100ms, 200ms, 400ms)
  onError?: (error: Error, entries: LogEntry[]) => void
  onSuccess?: (count: number) => void
}

interface SpyLogger extends Logger {
  readonly calls: LogEntry[]
  getCallsByLevel(level: LogLevel): LogEntry[]
  getLastCall(): LogEntry | undefined
  wasCalledWith(message: string): boolean
  wasCalledWithLevel(level: LogLevel, message: string): boolean
  clear(): void
}

// LOG_LEVEL_PRIORITY: Record<LogLevel, number> — debug=0, info=1, warn=2, error=3
```

## Usage Patterns

### Basic usage — default singleton
```typescript
import { logger } from '@nextnode-solutions/logger'
logger.info('Server started', { scope: 'app', details: { port: 3000 } })
```

### Custom logger with config
```typescript
import { createLogger } from '@nextnode-solutions/logger'
const log = createLogger({ prefix: '[API]', minLevel: 'warn', environment: 'production' })
```

### Custom transports
```typescript
import { createLogger, ConsoleTransport } from '@nextnode-solutions/logger'
import { HttpTransport } from '@nextnode-solutions/logger/transports/http'

const log = createLogger({
  transports: [
    new ConsoleTransport({ format: 'json' }),
    new HttpTransport({
      endpoint: 'https://logs.example.com',
      batchSize: 20,
      maxRetries: 5,
      onError: (err, entries) => console.error(`Failed to send ${entries.length} logs`, err),
    }),
  ],
})
// Call dispose() on shutdown to flush buffered HTTP logs
await log.dispose()
```

### Factory functions (alternative to `new`)
```typescript
import { createConsoleTransport } from '@nextnode-solutions/logger'
import { createHttpTransport } from '@nextnode-solutions/logger/transports/http'
const transport = createConsoleTransport({ format: 'node' })
const http = createHttpTransport({ endpoint: 'https://logs.example.com' })
```

### Testing — spy logger
```typescript
import { createSpyLogger } from '@nextnode-solutions/logger/testing'
const spy = createSpyLogger()
spy.info('test', { scope: 'auth' })
expect(spy.wasCalledWith('test')).toBe(true)
expect(spy.getCallsByLevel('info')).toHaveLength(1)
spy.clear()
```

### Testing — noop and mock
```typescript
import { createNoopLogger, createMockLogger } from '@nextnode-solutions/logger/testing'
import type { MockLogger } from '@nextnode-solutions/logger/testing'
// Noop: discards all output, satisfies Logger interface
const service = new MyService(createNoopLogger())
// Mock: tracks raw calls (mock.info.mock.calls), typed as MockLogger
const mock = createMockLogger()
expect(mock.info.mock.calls[0][0]).toBe('Expected message')
mock.info.mockClear() // Reset a single method
```

## Re-exported Utilities (from main entry)

- **Formatters**: `formatForNode`, `formatForBrowser`, `createBrowserLogArgs`, `formatAsJson`, `formatAsJsonPretty`
- **Utilities**: `generateRequestId`, `detectRuntime`, `hasCryptoSupport`, `detectEnvironment`, `parseLocation`, `safeStringify`, `getCurrentTimestamp`
- **Constants**: `LOG_LEVEL_PRIORITY`
- **Types**: `BrowserLogOutput`, `JsonLogOutput`, `ConsoleTransportConfig`, `DevelopmentLocationInfo`, `ProductionLocationInfo`, `LocationInfo`, `SpyLogger` (+ all core types)

## Conventions

- `scope` goes in the LogObject, not the message: `logger.info('msg', { scope: 'users' })`
- `details` is the conventional key for structured data in LogObject
- Production always outputs JSON regardless of ConsoleTransport format setting
- Development auto-detects runtime (Node.js ANSI vs browser CSS)
- HttpTransport validates endpoint URL (http/https only) and rejects restricted headers
- `exactOptionalPropertyTypes` is enabled — use `| undefined` explicitly in optional properties
- All imports use `.js` extensions (ESM)
- No barrel exports — direct imports only
- Tests live in `src/__tests__/` organized by concern (`core/`, `transports/`, `utils/`, `config/`)
- `__testing__` exports on formatters are for internal test access only — not part of public API

## Build

- **Bundler**: tsup (esbuild), target es2023
- **Format**: ESM-only, minified, tree-shaken, code-split
- **Entries**: `logger`, `testing`, `transports/http`
- **Output**: `dist/` (JS + .d.ts)
- **Linting**: oxlint (`pnpm lint`)
- **Formatting**: oxfmt (`pnpm format`)
- **Commands**: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm type-check`, `pnpm size`
