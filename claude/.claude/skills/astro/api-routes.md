# API Routes (Server Endpoints)

## Basics

API routes live in `src/pages/api/` and export named functions for HTTP methods.

```ts
// src/pages/api/contact.ts
import type { APIContext } from 'astro'

export const prerender = false  // required in static output mode

export async function POST({ request, clientAddress }: APIContext): Promise<Response> {
  const body = await request.json()
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `ALL`.

## APIContext Properties

| Property | Type | Description |
|---|---|---|
| `request` | `Request` | Standard Web Request object |
| `clientAddress` | `string` | Client IP address |
| `cookies` | `AstroCookies` | Cookie read/write API |
| `redirect(path, status?)` | method | Return a redirect response |
| `params` | `Record<string, string>` | Dynamic route parameters |
| `locals` | `App.Locals` | Shared data from middleware |

## JSON Response Helper

Keep response construction consistent:

```ts
function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

## Validation Pattern

Validate early, return early. One check per block:

```ts
export async function POST({ request }: APIContext): Promise<Response> {
  // 1. Content-Type check
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonResponse({ error: 'Expected JSON' }, 400)
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  // 3. Field validation
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return jsonResponse({ error: 'Name is required' }, 400)
  }

  // 4. Business logic
  // ...
}
```

## Form Data (non-JSON)

For `multipart/form-data` or `application/x-www-form-urlencoded`:

```ts
export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData()
  const name = data.get('name')
  // ...
}
```

## Dynamic API Routes

Use bracket syntax for parameters:

```ts
// src/pages/api/posts/[id].ts
export async function GET({ params }: APIContext) {
  const { id } = params
  // ...
}
```
