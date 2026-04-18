---
name: javascript
user-invocable: false
description: >-
  JavaScript-specific best practices that MUST be loaded whenever writing or
  modifying JavaScript files (*.js, *.jsx, *.mjs, *.cjs). Enforces modern
  JS idioms, strict equality, proper async patterns, and safe coding
  practices. Must be used alongside the language-agnostic "coding" skill.
---

# JavaScript Best Practices — Mandatory Rules

These rules apply to ALL JavaScript code you write or modify. They build on top of the language-agnostic coding rules, which also apply.

---

## RULE 0 — ABSOLUTE BANS

### `var` is FORBIDDEN

Always use `const`. Use `let` only when reassignment is genuinely needed. `var` has function scoping, hoisting, and redeclaration bugs. It does not exist in modern code.

```js
// FORBIDDEN
var count = 0
var user = getUser()

// MANDATORY
const user = getUser()
let count = 0 // only because we reassign below
count++
```

### `==` and `!=` are FORBIDDEN

Always use `===` and `!==`. Loose equality has insane coercion rules that cause real bugs.

```js
// FORBIDDEN
if (value == null)
if (status != "active")

// MANDATORY
if (value === null || value === undefined) // or: value == null is the ONLY tolerated exception
if (status !== "active")
```

**The single exception:** `value == null` (checks both `null` and `undefined`) is tolerated because it's a well-known JS idiom, but `value === null || value === undefined` or `value == null` — pick one and be consistent in the project.

### `eval()`, `with`, `arguments` object are FORBIDDEN

- `eval()` — security hole, performance killer. Never.
- `with` — scoping chaos. Never.
- `arguments` — use rest parameters (`...args`) instead.

---

## Variable Declarations

- **`const` by default.** Only use `let` when the variable WILL be reassigned.
- **One declaration per line.** No `const a = 1, b = 2, c = 3`.
- **Declare at the point of first use**, not at the top of the function.
- **Use destructuring** to extract values:

```js
// AVOID
const name = user.name
const email = user.email
const role = user.role

// PREFERRED
const { name, email, role } = user

// AVOID
const first = items[0]
const second = items[1]

// PREFERRED
const [first, second] = items
```

---

## Template Literals Over Concatenation

```js
// FORBIDDEN
const msg = "Hello " + name + ", you have " + count + " items"

// MANDATORY
const msg = `Hello ${name}, you have ${count} items`
```

Use template literals even for single interpolations. String concatenation with `+` is forbidden when building dynamic strings.

---

## Arrow Functions

- Use arrow functions for callbacks and lambdas.
- Use function declarations for top-level/exported functions (they have hoisting and a name in stack traces).
- **Never use `function` as a callback argument.**

```js
// FORBIDDEN
items.map(function(item) { return item.id })
setTimeout(function() { doStuff() }, 100)

// MANDATORY
items.map(item => item.id)
setTimeout(() => doStuff(), 100)

// GOOD — top-level named function
function processOrder(order) { ... }
export function calculateTax(amount, rate) { ... }
```

Implicit return for one-expression arrows is preferred:
```js
// AVOID
const getIds = (items) => { return items.map(i => i.id) }

// PREFERRED
const getIds = (items) => items.map(i => i.id)
```

---

## Array Methods Over Loops

Prefer declarative array methods over imperative loops when transforming data.

```js
// AVOID — imperative
const active = []
for (const user of users) {
  if (user.isActive) {
    active.push(user.name)
  }
}

// PREFERRED — declarative pipeline
const active = users
  .filter(u => u.isActive)
  .map(u => u.name)
```

**When to use `for...of` instead:**
- When you need `break` / `continue` / early exit (can't do that with `.forEach`)
- When you need `await` inside the loop body (sequential async processing)
- When performance matters on very large arrays (avoids intermediate allocations)

### Prefer `.some()` and `.every()` over `for...of` for boolean checks

When the loop's only purpose is to test whether *any* or *all* elements match a condition, use `.some()` / `.every()`. They express intent, return a boolean directly, and short-circuit on the first decisive match — no manual `break` or flag variable needed.

```js
// AVOID — imperative search with flag + break
let hasAdmin = false
for (const user of users) {
  if (user.role === "admin") {
    hasAdmin = true
    break
  }
}

// MANDATORY
const hasAdmin = users.some(u => u.role === "admin")

// AVOID
let allValid = true
for (const item of items) {
  if (!item.isValid) {
    allValid = false
    break
  }
}

// MANDATORY
const allValid = items.every(i => i.isValid)
```

Keep `for...of` only when the loop body does real work beyond a boolean test (side effects, `await`, accumulating non-boolean state).

**FORBIDDEN:** `for...in` on arrays. It iterates over keys (strings), not values, and includes inherited properties.

```js
// FORBIDDEN on arrays
for (const i in items) { ... }

// CORRECT
for (const item of items) { ... }
```

---

## Async / Await

### Always use `async/await` over `.then()` chains

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

### Parallelize independent async operations

Never run independent async operations sequentially. Choose the right concurrency strategy:

| Strategy | When to use | Behavior |
|---|---|---|
| `Promise.allSettled` | **Default choice** - best-effort, every result matters | Runs all, never short-circuits, returns status per promise |
| `Promise.all` | Fail-fast - one failure should abort the whole batch | Rejects on first failure, other results lost |
| `for...of` with `await` | Sequential ordering required, or race conditions are a concern | One at a time, full control |

```js
// FORBIDDEN — sequential when they could be parallel
const users = await fetchUsers()
const orders = await fetchOrders()
const products = await fetchProducts()

// PREFERRED — best-effort parallel (all results visible)
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
])
// inspect results[i].status === "fulfilled" | "rejected"

// ACCEPTABLE — fail-fast parallel (when any failure is fatal)
const [users, orders, products] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
])

// ACCEPTABLE — sequential (when order matters or shared resource)
for (const cmd of commands) {
  await session.exec(cmd) // each command depends on the previous
}
```

**Decision rule:** start with `Promise.allSettled`. Move to `Promise.all` only when a single failure makes the entire batch useless. Use sequential `for...of` only when operations must run in order or share a resource that doesn't support concurrency.

### Never fire-and-forget

```js
// FORBIDDEN — unhandled promise
doAsyncThing()

// MANDATORY — handle the result or error
await doAsyncThing()
// or if intentionally detached:
doAsyncThing().catch(handleError)
```

---

## Object and Spread Patterns

### Spread for shallow copies

```js
// GOOD
const updated = { ...user, name: "new name" }
const copy = [...items]
```

### Use `structuredClone` for deep copies

```js
// FORBIDDEN — JSON roundtrip loses dates, functions, undefined, etc.
const deep = JSON.parse(JSON.stringify(obj))

// MANDATORY
const deep = structuredClone(obj)
```

### Optional chaining and nullish coalescing

```js
// AVOID — verbose null checks
const city = user && user.address && user.address.city

// MANDATORY
const city = user?.address?.city

// AVOID — falsy-tripped fallback
const port = config.port || 3000 // BUG: port 0 is valid but falsy

// MANDATORY — nullish coalescing
const port = config.port ?? 3000
```

**Rule:** use `||` only for booleans. For everything else, use `??` to avoid the falsy trap (`0`, `""`, `false` are valid values).

---

## Map and Set Over Plain Objects

When using an object purely as a key-value store (especially with dynamic keys), use `Map`. When tracking unique values, use `Set`.

```js
// AVOID — object as map
const counts = {}
for (const item of items) {
  counts[item] = (counts[item] || 0) + 1
}

// PREFERRED
const counts = new Map()
for (const item of items) {
  counts.set(item, (counts.get(item) ?? 0) + 1)
}

// AVOID — array for unique values
const seen = []
if (!seen.includes(item)) seen.push(item)

// PREFERRED
const seen = new Set()
seen.add(item)
```

`Map` advantages: any key type, guaranteed order, `.size`, no prototype pollution, better performance for frequent add/delete.

---

## Modules and Imports

- **Use ES modules** (`import/export`). Not CommonJS (`require`) unless forced by the runtime/config.
- **Prefer named exports** over default exports. Named exports are refactor-safe and auto-importable.
- **One module, one responsibility.** Don't dump unrelated functions in a `utils.js` grab bag.

```js
// AVOID
export default function calculateTax(amount, rate) { ... }

// PREFERRED
export function calculateTax(amount, rate) { ... }
```

---

## Error Handling (JS-Specific)

### Check response status on fetch

`fetch` does NOT throw on HTTP errors (4xx, 5xx). You MUST check manually.

```js
// FORBIDDEN — silent failure on 404/500
const data = await fetch(url).then(r => r.json())

// MANDATORY
const res = await fetch(url)
if (!res.ok) {
  throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
}
const data = await res.json()
```

### Use custom error classes for domain errors

```js
class ValidationError extends Error {
  constructor(field, message) {
    super(message)
    this.name = "ValidationError"
    this.field = field
  }
}
```

---

## No Inline Non-JS Content

NEVER embed non-JS content (TOML, JSON, YAML, HTML, XML, SQL, CSS, etc.) as hardcoded multiline strings or template literals in JS/TS files.

**In application code**: ALWAYS use separate files with the proper extension and load them (`fs.readFileSync`, `import`, etc.).

**In tests**: Use separate fixture files in a `fixtures/` or `__fixtures__/` directory next to the test file. Load them with a helper.

**Only exception**: Very short strings (1-2 lines max) where a separate file would be overkill (e.g., a one-line parser test).

```js
// FORBIDDEN — inline TOML in template literal
const path = writeTOML(`
[project]
name = "my-app"
type = "app"

[scripts]
lint = "lint"
test = "test"
`)

// CORRECT — fixture file: fixtures/minimal-config.toml
const path = writeTOML(readFixture("minimal-config.toml"))
```

---

## Forbidden Patterns — Quick Reference

| Pattern | Verdict | Instead |
|---|---|---|
| `var` | NEVER | `const` / `let` |
| `==` / `!=` | NEVER | `===` / `!==` (except `== null`) |
| `eval()` | NEVER | Find another way |
| `arguments` | NEVER | Rest params `...args` |
| `for...in` on arrays | NEVER | `for...of` |
| `for...of` for boolean any/all checks | AVOID | `.some()` / `.every()` |
| `.then()` chains | AVOID | `async/await` |
| `JSON.parse(JSON.stringify())` for cloning | NEVER | `structuredClone()` |
| `\|\|` for non-boolean defaults | AVOID | `??` (nullish coalescing) |
| String concatenation with `+` | AVOID | Template literals |
| `function` in callbacks | AVOID | Arrow functions |
| Default exports | AVOID | Named exports |
| Fire-and-forget promises | NEVER | `await` or `.catch()` |
| Sequential `await` for independent ops | NEVER | `Promise.allSettled` (default) or `Promise.all` |
| `for...of` + `await` when parallelizable | AVOID | `Promise.allSettled` unless order/race matters |
| Unchecked `fetch` response | NEVER | Check `res.ok` |
