# Common Patterns

## Per-request logger (Express/Fastify)

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

## Module-scoped logger

```typescript
import { createLogger } from '@nextnode-solutions/logger'

const logger = createLogger({ scope: 'database' })

export function query(sql: string): Result {
  logger.debug('Executing query', { details: { sql } })
  // ...
}
```

## Dependency injection

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
