# Async / Await - JavaScript

(`.then()` chains and floating promises are linted - `promise/prefer-await-to-then` warn, type-aware `no-floating-promises`. What the linter cannot choose is the concurrency strategy.)

## Parallelize independent async operations

Never run independent async operations sequentially. Choose the strategy:

| Strategy | When to use | Behavior |
|---|---|---|
| `Promise.allSettled` | **Default choice** - best-effort, every result matters | Runs all, never short-circuits, returns status per promise |
| `Promise.all` | Fail-fast - one failure should abort the whole batch | Rejects on first failure, other results lost |
| `for...of` with `await` | Sequential ordering required, or shared resource | One at a time, full control (linted as warn - justify it) |

```js
// FORBIDDEN - sequential when they could be parallel
const users = await fetchUsers()
const orders = await fetchOrders()

// PREFERRED - best-effort parallel (all results visible)
const results = await Promise.allSettled([fetchUsers(), fetchOrders(), fetchProducts()])
// inspect results[i].status === "fulfilled" | "rejected"

// ACCEPTABLE - fail-fast parallel (when any failure is fatal)
const [users, orders] = await Promise.all([fetchUsers(), fetchOrders()])

// ACCEPTABLE - sequential (each command depends on the previous)
for (const cmd of commands) await session.exec(cmd)
```

**Decision rule:** start with `Promise.allSettled`. Move to `Promise.all` only when a single failure makes the entire batch useless. Sequential only when operations must run in order or share a resource that doesn't support concurrency.

## Fire-and-forget

Never leave a promise floating (linted). Either `await` it, or detach intentionally with an error handler:

```js
await doAsyncThing()
// or, intentionally detached:
doAsyncThing().catch(handleError)
```
