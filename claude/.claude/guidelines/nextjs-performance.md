---
triggers:
  project: ["next", "nextjs"]
description: Next.js performance patterns and optimizations
---

# Next.js Performance Guidelines

## Eliminating Waterfalls (CRITICAL)

Sequential async operations are the #1 performance killer. Always parallelize independent operations.

### Use Promise.all for Independent Operations

```typescript
// BAD - Sequential waterfall (slow)
const user = await getUser(id)
const posts = await getPosts(id)
const comments = await getComments(id)

// GOOD - Parallel execution (fast)
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id),
])
```

### Defer await Until Needed

```typescript
// BAD - Blocks on first await even if we might return early
async function getUserData(id: string) {
  const user = await getUser(id)
  if (!isAuthorized(user)) return null
  const posts = await getPosts(id)
  return { user, posts }
}

// GOOD - Start fetching immediately, await only when needed
async function getUserData(id: string) {
  const userPromise = getUser(id)
  const postsPromise = getPosts(id)

  const user = await userPromise
  if (!isAuthorized(user)) return null

  const posts = await postsPromise
  return { user, posts }
}
```

### Suspense Boundaries for Streaming

```tsx
// GOOD - Stream independent sections
export default function Page() {
  return (
    <main>
      <Header />
      <Suspense fallback={<UserSkeleton />}>
        <UserSection />
      </Suspense>
      <Suspense fallback={<PostsSkeleton />}>
        <PostsSection />
      </Suspense>
    </main>
  )
}
```

### Partial Dependencies with Promise Pattern

```typescript
// When B depends on A, but C is independent
async function fetchData() {
  const [a, c] = await Promise.all([fetchA(), fetchC()])
  const b = await fetchB(a.id) // Only this needs to wait for A
  return { a, b, c }
}
```

---

## Bundle Optimization (CRITICAL)

### Dynamic Imports for Heavy Components

```tsx
import dynamic from 'next/dynamic'

// GOOD - Monaco, charts, rich editors loaded on demand
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  loading: () => <EditorSkeleton />,
  ssr: false, // Client-only for browser APIs
})

const Chart = dynamic(() => import('./Chart'), {
  loading: () => <ChartSkeleton />,
})
```

### Preload on Hover/Focus

```tsx
import dynamic from 'next/dynamic'

const HeavyModal = dynamic(() => import('./HeavyModal'))

// Preload when user shows intent
function OpenModalButton() {
  const preload = () => {
    // Triggers the dynamic import
    import('./HeavyModal')
  }

  return (
    <button
      onMouseEnter={preload}
      onFocus={preload}
      onClick={() => setOpen(true)}
    >
      Open
    </button>
  )
}
```

### Configure optimizePackageImports

```typescript
// next.config.ts
const config: NextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'lodash-es',
    ],
  },
}
```

### Defer Analytics After Hydration

```tsx
'use client'

import { useEffect } from 'react'

export function Analytics() {
  useEffect(() => {
    // Load analytics only after hydration
    import('@vercel/analytics').then(({ inject }) => inject())
  }, [])

  return null
}
```

---

## Server-Side Performance

### React.cache() for Request Deduplication

```typescript
import { cache } from 'react'

// Deduplicated within a single request
export const getUser = cache(async (id: string) => {
  const user = await db.user.findUnique({ where: { id } })
  return user
})

// Multiple components can call getUser(id) - only one DB query
```

### LRU Cache for Cross-Request Caching

```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, User>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
})

export async function getUser(id: string) {
  const cached = cache.get(id)
  if (cached) return cached

  const user = await db.user.findUnique({ where: { id } })
  if (user) cache.set(id, user)
  return user
}
```

### Minimize RSC Serialization

```tsx
// BAD - Sending entire user object to client
async function Page() {
  const user = await getUser(id) // 50+ fields
  return <ClientComponent user={user} />
}

// GOOD - Send only what client needs
async function Page() {
  const user = await getUser(id)
  return (
    <ClientComponent
      name={user.name}
      avatar={user.avatar}
    />
  )
}
```

### Non-Blocking Operations with after()

```typescript
import { after } from 'next/server'

export async function POST(request: Request) {
  const data = await request.json()
  const result = await saveToDatabase(data)

  // Run after response is sent (non-blocking)
  after(async () => {
    await sendEmailNotification(data)
    await logAnalytics('item_created', data)
  })

  return Response.json(result)
}
```

---

## Client-Side Data Fetching

### SWR for Automatic Deduplication

```tsx
import useSWR from 'swr'

// Multiple components calling same key = single request
function UserProfile() {
  const { data: user } = useSWR(`/api/user/${id}`, fetcher)
  return <div>{user?.name}</div>
}

function UserAvatar() {
  // Same key, same fetcher = deduplicated
  const { data: user } = useSWR(`/api/user/${id}`, fetcher)
  return <img src={user?.avatar} />
}
```

### Passive Event Listeners

```tsx
useEffect(() => {
  const handler = () => { /* scroll logic */ }

  // GOOD - passive: true for scroll/touch events
  window.addEventListener('scroll', handler, { passive: true })

  return () => window.removeEventListener('scroll', handler)
}, [])
```

### LocalStorage Versioning Pattern

```typescript
const STORAGE_VERSION = 'v2'
const STORAGE_KEY = `app_settings_${STORAGE_VERSION}`

// Version bump invalidates old cached data
export function getSettings() {
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : defaultSettings
}
```

---

## Route & Navigation

### Prefetching Strategy

```tsx
import Link from 'next/link'

// Automatic prefetch on viewport (default)
<Link href="/dashboard">Dashboard</Link>

// Disable for rarely-used links
<Link href="/admin" prefetch={false}>Admin</Link>

// Manual prefetch on hover for dynamic routes
import { useRouter } from 'next/navigation'

function ProductCard({ id }: { id: string }) {
  const router = useRouter()

  return (
    <div onMouseEnter={() => router.prefetch(`/product/${id}`)}>
      <Link href={`/product/${id}`}>View Product</Link>
    </div>
  )
}
```

### Route Groups for Code Splitting

```
app/
├── (marketing)/      # Separate bundle
│   ├── page.tsx
│   └── about/
├── (dashboard)/      # Separate bundle
│   ├── layout.tsx
│   └── settings/
```

---

## Quick Reference

| Pattern | When to Use |
|---------|-------------|
| `Promise.all()` | Independent async operations |
| Deferred await | Early return possible |
| `dynamic()` | Heavy components (>50KB) |
| Preload on hover | Modal/drawer content |
| `React.cache()` | Same-request deduplication |
| LRU cache | Cross-request caching |
| `after()` | Non-blocking side effects |
| SWR | Client data with dedup |
| `{ passive: true }` | Scroll/touch listeners |

### Performance Checklist

- [ ] No sequential awaits for independent data
- [ ] Heavy components use dynamic imports
- [ ] Analytics deferred until after hydration
- [ ] RSC passes minimal data to client components
- [ ] Scroll/touch events use passive listeners
- [ ] SWR or React Query for client fetching
