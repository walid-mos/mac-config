# Async / Await - JavaScript

## Always use `async/await` over `.then()` chains

```js
// FORBIDDEN
function getUser(id) {
  return fetch(`/api/users/${id}`)
    .then(res => res.json())
    .then(data => data.user)
    .catch(err => { throw err })
}

// MANDATORY
async function getUser(id) {
  const res = await fetch(`/api/users/${id}`)
  const data = await res.json()
  return data.user
}
```

## Parallelize independent async operations

Never run independent async operations sequentially. Choose the right concurrency strategy:

| Strategy | When to use | Behavior |
|---|---|---|
| `Promise.allSettled` | **Default choice** - best-effort, every result matters | Runs all, never short-circuits, returns status per promise |
| `Promise.all` | Fail-fast - one failure should abort the whole batch | Rejects on first failure, other results lost |
| `for...of` with `await` | Sequential ordering required, or race conditions are a concern | One at a time, full control |

```js
// FORBIDDEN - sequential when they could be parallel
const users = await fetchUsers()
const orders = await fetchOrders()
const products = await fetchProducts()

// PREFERRED - best-effort parallel (all results visible)
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
])
// inspect results[i].status === "fulfilled" | "rejected"

// ACCEPTABLE - fail-fast parallel (when any failure is fatal)
const [users, orders, products] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
])

// ACCEPTABLE - sequential (when order matters or shared resource)
for (const cmd of commands) {
  await session.exec(cmd) // each command depends on the previous
}
```

**Decision rule:** start with `Promise.allSettled`. Move to `Promise.all` only when a single failure makes the entire batch useless. Use sequential `for...of` only when operations must run in order or share a resource that doesn't support concurrency.

## Never fire-and-forget

```js
// FORBIDDEN - unhandled promise
doAsyncThing()

// MANDATORY - handle the result or error
await doAsyncThing()
// or if intentionally detached:
doAsyncThing().catch(handleError)
```
