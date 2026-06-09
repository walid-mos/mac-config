# Transports & Formatters

## ConsoleTransport (default)

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

## HttpTransport

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
- SSRF protection (validates endpoint URL — blocks private/loopback IPs such as `10.x`, `172.16-31.x`, `192.168.x`, `127.x`; if you are deploying to an internal logging service on a private network, you may see silent log loss)
- Call `transport.dispose()` on shutdown to flush remaining logs

## Using multiple transports

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
