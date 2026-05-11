---
name: nextnode-logger
description: >-
  How to use @nextnode-solutions/logger in NextNode projects. Covers the Logger
  API, child loggers, transports (console, HTTP), formatters, testing utilities,
  and integration patterns.
user-invocable: true
synced-at: a755da5
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

1. Read `package.json` - check if `@nextnode-solutions/logger` is installed
2. Search for existing logger usage (`import.*@nextnode-solutions/logger`)
3. Identify the logging patterns already in place

### Phase 2: Provide guidance

Based on the argument and current project state, explain the relevant part of the logger API. Always show concrete code examples.

Use the relevant sub-file for details:
- [setup.md](setup.md) - Installation, entry points
- [api.md](api.md) - Logger creation, config, child loggers, log objects, disposal, types
- [transports.md](transports.md) - ConsoleTransport, HttpTransport, formatters, utilities
- [testing.md](testing.md) - Spy, mock, and noop loggers for tests
- [patterns.md](patterns.md) - Per-request, module-scoped, and dependency injection patterns

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

## Rules

1. **Use the logger, not console** - oxlint warns on `console.log`. Use `@nextnode-solutions/logger` instead.
2. **Inject loggers via constructor/parameter** - Don't import a global logger in business logic. Accept a `Logger` interface for testability.
3. **Use child loggers for request context** - Create a child logger per request with the request ID. Don't pass request IDs manually to each log call.
4. **Scope by domain, not by file** - Use scopes like `'auth'`, `'database'`, `'api'` - not file names.
5. **Dispose on shutdown** - If using HttpTransport, always call `dispose()` to flush buffered logs.
6. **Use testing utilities in tests** - Never mock the logger manually. Use `createSpyLogger()` or `createMockLogger()` from `@nextnode-solutions/logger/testing`.
