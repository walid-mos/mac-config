---
name: nextnode-logger
description: >-
  How to use @nextnode-solutions/logger in NextNode projects. Load when
  @nextnode-solutions/logger appears in package.json, when the user imports
  `createLogger` or `Logger` from it, or when configuring logging in a
  NextNode project.
user-invocable: true
synced-at: a755da5
---

# @nextnode-solutions/logger

A lightweight, zero-dependency TypeScript logging library for NextNode projects. Features scope-based organization, environment-aware formatting, pluggable transports, and runtime detection (Node.js, browser, webworker).

## Instructions

### Phase 1: Read the project

1. Read `package.json` - check if `@nextnode-solutions/logger` is installed
2. Search for existing logger usage (`import.*@nextnode-solutions/logger`)
3. Identify the logging patterns already in place

### Phase 2: Provide guidance

Based on the current project state, explain the relevant part of the logger API. Always show concrete code examples.

Use the relevant sub-file for details:
- [api.md](api.md) - Logger creation, config, child loggers, log objects, disposal, types
- [transports.md](transports.md) - ConsoleTransport, HttpTransport, formatters, utilities
- [testing.md](testing.md) - Spy, mock, and noop loggers for tests

---

## Log levels (priority order)

| Level | Priority | When to use |
|-------|----------|-------------|
| `debug` | 0 | Detailed diagnostic info, development only |
| `info` | 1 | Normal operational events |
| `warn` | 2 | Something unexpected but recoverable — the process continues |
| `error` | 3 | Unrecoverable failure or data loss — needs immediate attention |

Logs below `minLevel` are silently dropped. Default: `debug` (all logs).

See [api.md](api.md) for the full API including child loggers and request correlation patterns.

## Quick Reference — MANDATORY / FORBIDDEN

| # | Rule | Verdict |
|---|------|---------|
| 1 | Use `@nextnode-solutions/logger` — never `console.log` (oxlint flags it) | **FORBIDDEN: console.log** |
| 2 | Import the `Logger` interface as a constructor/param dep in business logic | **FORBIDDEN: import global logger in business-logic classes** |
| 3 | Pass structured data in `details: {}` — never build the message via string interpolation | **FORBIDDEN: string interpolation in log messages** |
| 4 | Set `includeLocation: true` only in development | **FORBIDDEN: includeLocation:true in production** |
| 5 | Call `logger.dispose()` on SIGTERM when `HttpTransport` is in use | **MANDATORY: dispose() on SIGTERM** |
| 6 | Create a child logger per request (with `requestId`) — never pass it manually to each call | **MANDATORY: child logger per request** |
| 7 | Scope by domain noun, not file name — lowercase, kebab-case for compounds | **MANDATORY: scope format** |
| 8 | Use `createSpyLogger()` / `createMockLogger()` / `createNoopLogger()` in tests | **FORBIDDEN: manual logger mock** |

### Scope naming

Canonical forms: `'auth'`, `'db'`, `'http'`, `'email-queue'`, `'payments'`.  
FORBIDDEN: file-path-style scopes (`'src/services/userService'`) or mixed-case (`'UserService'`).
