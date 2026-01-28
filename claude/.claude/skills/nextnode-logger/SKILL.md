---
name: nextnode-logger
description: "@nextnode/logger usage guidelines for NextNode projects. Use when console.* is used in a NextNode project."
user-invocable: true
allowed-tools: Read
---

# @nextnode/logger Guidelines

When `@nextnode/logger` is in package.json, `console.*` is **FORBIDDEN**.

## Critical Rule

```typescript
// FORBIDDEN when logger is available
console.log('User created')
console.warn('Config missing')
console.error('Failed to process')

// REQUIRED
import { logger } from '@nextnode/logger'

logger.info('User created', { scope: 'auth' })
logger.warn('Config missing', { scope: 'config' })
logger.error('Failed to process', { scope: 'api' })
```

## Detection

Check `package.json` dependencies:
- If `@nextnode/logger` present -> Use logger exclusively
- If absent -> `console.*` is acceptable

## Usage Patterns

### Global Logger

```typescript
import { logger } from '@nextnode/logger'

logger.info('Server started', { scope: 'app', details: { port: 3000 } })
logger.warn('Missing optional config', { scope: 'config' })
logger.error('Unhandled rejection', { scope: 'app', details: { error } })
```

### Scoped Loggers

```typescript
import { createLogger } from '@nextnode/logger'

const authLogger = createLogger({ prefix: '[Auth]' })

authLogger.info('Login attempt', {
  scope: 'login',
  details: { email }
})
```

**Scopes**: `auth`, `api`, `db`, `payment`, `email`, `user-service`

## Log Levels

| Level | Method | When |
|-------|--------|------|
| debug | `logger.debug()` | Verbose dev info |
| info | `logger.info()` | Normal operations |
| warn | `logger.warn()` | Recoverable issues |
| error | `logger.error()` | Failures |

## Structured Logging

```typescript
// BAD - String interpolation
logger.info(`User ${userId} logged in from ${ip}`)

// GOOD - Structured data
logger.info('User logged in', {
  scope: 'auth',
  details: { userId, ip, userAgent }
})
```

## Dependency Injection

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

## Testing

```typescript
import { createSpyLogger } from '@nextnode/logger/testing'

describe('UserService', () => {
  it('logs user creation', () => {
    const spy = createSpyLogger()
    const service = new UserService(spy)

    service.createUser({ email: 'test@example.com' })

    expect(spy.wasCalledWith('Creating user')).toBe(true)
  })
})
```

## Security

**NEVER log sensitive data:**

```typescript
// BAD
logger.info('Login', { details: { email, password } })

// GOOD
logger.info('Login attempt', {
  scope: 'auth',
  details: { email, success: false, reason: 'invalid_password' }
})
```
