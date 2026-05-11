# Installation and entry points

## Installation

```bash
pnpm add @nextnode-solutions/logger
```

No peer dependencies. Zero runtime dependencies.

## Exports

The package has three entry points:

| Import path | What it provides |
|------------|-----------------|
| `@nextnode-solutions/logger` | Core logger class, factory, default instance, formatters, types, utilities |
| `@nextnode-solutions/logger/testing` | Spy logger, mock logger, noop logger for tests |
| `@nextnode-solutions/logger/transports/http` | HTTP transport for log aggregation |
