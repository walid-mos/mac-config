# Config: Vitest (Testing)

**Export paths** - pick by project type:

| Export | When to use |
|--------|-------------|
| `@nextnode-solutions/standards/vitest/backend` | Node libraries (logger, infrastructure, email-manager) |
| `@nextnode-solutions/standards/vitest/frontend` | Browser/React projects (jsdom environment) |
| `@nextnode-solutions/standards/vitest/astro` | Astro projects (uses `getViteConfig` under the hood) |
| `@nextnode-solutions/standards/vitest/vite-plugin` | Types-only - Vitest type augmentation without the Vite runtime config |

## Project setup

Create `vitest.config.ts` at the project root:

```typescript
// Backend (API, CLI, libraries)
import config from '@nextnode-solutions/standards/vitest/backend'

export default config

// Frontend (React, Astro, browser code)
import config from '@nextnode-solutions/standards/vitest/frontend'

export default config

// Astro projects
import config from '@nextnode-solutions/standards/vitest/astro'

export default config
```

## To extend/override

```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '@nextnode-solutions/standards/vitest/backend'

export default mergeConfig(baseConfig, defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
}))
```

## Backend config

- **Environment**: Node.js
- **Globals**: enabled (`describe`, `it`, `expect` without imports)
- **NODE_ENV**: set to `"test"`
- **Mock cleanup**: `restoreMocks`, `clearMocks`, `unstubGlobals` all true
- **Coverage**: v8 provider, excludes node_modules, dist, .d.ts, test/spec/config files, types.ts

## Frontend config

- **Environment**: jsdom
- **Globals**: enabled
- **Mock cleanup**: same as backend
- **Coverage**: v8 provider, additionally excludes .astro/, coverage/, tests/, config/, types/
