# Testing Astro with Vitest - Container API

The Astro Container API lets you render `.astro` components in isolation inside Vitest. It runs server-side only - no browser, no dev server. As of Astro 6 the API is still flagged experimental and the export is `experimental_AstroContainer` (alias it on import).

## Setup

The project must use Astro's Vite-based test setup. In `vitest.config.ts`:

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    /* vitest options */
  },
});
```

Use `getViteConfig()` from `astro/config` - do NOT use `defineConfig` from `vitest/config` directly. Astro's wrapper configures the Vite plugins needed to import `.astro` files.

## Container Basics

```ts
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { expect, test } from "vitest";
import Card from "../src/components/Card.astro";

test("renders Card", async () => {
  const container = await AstroContainer.create();
  const result = await container.renderToString(Card);

  expect(result).toContain("Expected content");
});
```

- `AstroContainer.create()` is async - always `await` it.
- `renderToString()` returns raw HTML as a `string`.
- `renderToResponse()` returns a full `Response` object - use for endpoints or when you need status/headers.

## Passing Props

```ts
import Card from "../src/components/Card.astro";

const container = await AstroContainer.create();
const result = await container.renderToString(Card, {
  props: { title: "Hello" },
});
```

## Passing Slots

```ts
const result = await container.renderToString(Card, {
  slots: {
    default: "Main content",
    footer: "<p>Footer HTML</p>",
  },
});
```

Slot values are raw HTML strings. Named slots use the slot name as key.

## Injecting `Astro.locals`

Use `locals` to simulate middleware-injected data:

```ts
const result = await container.renderToString(AuthGuard, {
  locals: {
    checkAuth() {
      return true;
    },
  },
});

expect(result).toContain("You're in");
```

## Dynamic Route Params

For components that read `Astro.params`:

```ts
import LocaleSlug from "../src/pages/[locale]/[slug].astro";

const result = await container.renderToString(LocaleSlug, {
  params: { locale: "en", slug: "getting-started" },
});
```

## Testing API Endpoints

Use `renderToResponse` with `routeType: "endpoint"`:

```ts
import * as Endpoint from "../src/pages/api/users.ts";

const response = await container.renderToResponse(Endpoint, {
  routeType: "endpoint",
});
const json = await response.json();

expect(response.status).toBe(200);
expect(json.users).toHaveLength(3);
```

To test specific HTTP methods, pass a `request`:

```ts
const response = await container.renderToResponse(Endpoint, {
  routeType: "endpoint",
  request: new Request("https://example.com/api/users", {
    method: "POST",
    body: JSON.stringify({ name: "Alice" }),
    headers: { "Content-Type": "application/json" },
  }),
});
```

## Adding Framework Renderers

If the component under test uses React, Vue, or other framework islands, register their renderers on the container:

```ts
import reactRenderer from "@astrojs/react/server.js";

const container = await AstroContainer.create();
container.addServerRenderer({ renderer: reactRenderer });
container.addClientRenderer({
  name: "@astrojs/react",
  entrypoint: "@astrojs/react/client.js",
});
```

- Add server renderers **before** client renderers.
- Only add renderers for frameworks actually used by the component under test.

## Astro-specific gotchas

- One fresh `AstroContainer` per test (no shared container - state leaks).
- Assert on rendered content with `toContain()`; never snapshot full HTML.
