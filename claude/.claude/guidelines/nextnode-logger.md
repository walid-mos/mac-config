---
triggers:
  keywords: ["nextnode", "@nextnode/logger"]
description: NextNode logger usage guidelines
---

# @nextnode/logger Best Practices

## Critical Rule

**When `@nextnode/logger` is installed, `console.*` is FORBIDDEN.**

```typescript
// ❌ FORBIDDEN - Never use console when logger is available
console.log('User created')
console.warn('Config missing')
console.error('Failed to process')
console.debug('Debug info')

// ✅ REQUIRED - Use @nextnode/logger
import { logger } from '@nextnode/logger'

logger.info('User created', { scope: 'auth' })
logger.warn('Config missing', { scope: 'config' })
logger.error('Failed to process', { scope: 'api' })
logger.debug('Debug info', { scope: 'debug' })
```

## Detection

Check if `@nextnode/logger` is in `package.json` dependencies:
- If present → Use logger exclusively
- If absent → `console.*` is acceptable

---

## Usage Patterns

### Global Logger (App-Wide Events)

For application-level events (startup, shutdown, config):

```typescript
import { logger } from '@nextnode/logger'

// App startup
logger.info('Server started', { scope: 'app', details: { port: 3000 } })

// Config warnings
logger.warn('Missing optional config', { scope: 'config' })

// Unhandled errors
logger.error('Unhandled rejection', { scope: 'app', details: { error } })
```

### Scoped Loggers (Modules/Services)

Each module/service MUST have its own scoped logger:

```typescript
import { createLogger } from '@nextnode/logger'

// Create at module level
const authLogger = createLogger({ prefix: '[Auth]' })

export class AuthService {
  login(email: string) {
    authLogger.info('Login attempt', {
      scope: 'login',
      details: { email }
    })
  }
}
```

**Naming convention for scopes:**
- `auth` - Authentication/authorization
- `api` - HTTP handlers
- `db` - Database operations
- `payment` - Payment processing
- `email` - Email sending
- Multi-word: `user-service`, `order-processing`

---

## Log Levels

| Level   | Method           | When to Use                        |
|---------|------------------|------------------------------------|
| `debug` | `logger.debug()` | Verbose dev info, trace execution  |
| `info`  | `logger.info()`  | Normal operations, milestones      |
| `warn`  | `logger.warn()`  | Recoverable issues, deprecations   |
| `error` | `logger.error()` | Failures requiring attention       |

---

## Structured Logging

**ALWAYS use structured data, NEVER string interpolation:**

```typescript
// ❌ BAD - String interpolation
logger.info(`User ${userId} logged in from ${ip}`)

// ✅ GOOD - Structured data
logger.info('User logged in', {
  scope: 'auth',
  details: { userId, ip, userAgent }
})
```

**ALWAYS include scope:**

```typescript
// ❌ BAD - No scope
logger.info('Request processed')

// ✅ GOOD - With scope
logger.info('Request processed', { scope: 'api' })
```

---

## Dependency Injection

Pass logger to classes for testability:

```typescript
import type { Logger } from '@nextnode/logger'

export class UserService {
  constructor(private readonly logger: Logger) {}

  async createUser(data: UserData) {
    this.logger.info('Creating user', {
      scope: 'users',
      details: { email: data.email }
    })
  }
}
```

---

## Testing

Use testing utilities from `@nextnode/logger/testing`:

```typescript
import { createSpyLogger } from '@nextnode/logger/testing'

describe('UserService', () => {
  it('logs user creation', () => {
    const spy = createSpyLogger()
    const service = new UserService(spy)

    service.createUser({ email: 'test@example.com' })

    expect(spy.wasCalledWith('Creating user')).toBe(true)
    expect(spy.calls[0].scope).toBe('users')
  })
})
```

**Available test utilities:**
- `createSpyLogger()` - Captures calls for assertions
- `createNoopLogger()` - Silent, for DI when logs don't matter
- `createMockLogger()` - Vi/Jest mock functions

---

## Security

**NEVER log sensitive data:**

```typescript
// ❌ BAD - Logs password
logger.info('Login', { details: { email, password } })

// ❌ BAD - Logs token
logger.debug('Auth header', { details: { authorization: req.headers.authorization } })

// ✅ GOOD - Safe logging
logger.info('Login attempt', {
  scope: 'auth',
  details: { email, success: false, reason: 'invalid_password' }
})
```

---

## Quick Reference

```typescript
// Global import (app-wide)
import { logger } from '@nextnode/logger'

// Scoped logger (per module)
import { createLogger } from '@nextnode/logger'
const moduleLogger = createLogger({ prefix: '[Module]' })

// Always use scope
logger.info('Message', { scope: 'feature' })

// Add structured details
logger.info('Message', { scope: 'feature', details: { key: 'value' } })

// Testing
import { createSpyLogger } from '@nextnode/logger/testing'
```
