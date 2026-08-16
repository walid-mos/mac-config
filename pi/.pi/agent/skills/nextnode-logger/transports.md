# Transports & Formatters

## ConsoleTransport (default)

Auto-detects the runtime and uses the appropriate formatter:
- **Node.js**: ANSI-colored output with `formatForNode`
- **Browser**: CSS-styled console output with `formatForBrowser`
- **Production**: JSON structured output with `formatAsJson`

```typescript
import { ConsoleTransport, createConsoleTransport } from '@nextnode-solutions/logger'

const transport = new ConsoleTransport({
  environment: 'development',  // Force environment (default: auto-detect)
})
// `createConsoleTransport(config?)` is the equivalent factory function
```

## HttpTransport

Sends logs to a remote endpoint with batching and retry:

```typescript
import { HttpTransport } from '@nextnode-solutions/logger/transports/http'

const httpTransport = new HttpTransport({
  endpoint: 'https://logs.example.com/ingest',
  batchSize: 10,          // Flush after N logs (default: 10)
  flushInterval: 5000,    // Flush every N ms (default: 5000)
  timeout: 10000,         // Request timeout in ms (default: 10000)
  maxRetries: 3,          // Retry on failure (default: 3)
  headers: {              // Custom headers
    'Authorization': 'Bearer token',
  },
  onError: (error, entries) => { /* called on failed request */ },
  onSuccess: (count) => { /* called when a batch is sent */ },
})
```

Features:
- Batches logs and flushes periodically or when batch is full
- Exponential backoff on retry (100ms, 200ms, 400ms…)
- SSRF protection validates the endpoint URL: it must parse and use `http:`/`https:` — any other protocol throws at construction. It does **not** block private/loopback IPs, so internal logging endpoints (`http://10.x`, `http://192.168.x`) work fine
- Header injection protection: `host`, `content-length`, `transfer-encoding` cannot be overridden (constructor throws)
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

Also exported from the main entry: `LOG_LEVEL_PRIORITY`, the type guards `isLogLevel` / `isEnvironment` / `isRuntimeEnvironment` / `isDevelopmentLocation`, and `hasCryptoSupport`.

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
