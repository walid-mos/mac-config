# Arrays, Iteration, Map and Set - JavaScript

## Array Methods Over Loops

Prefer declarative array methods over imperative loops when transforming data.

```js
// AVOID - imperative
const active = []
for (const user of users) {
  if (user.isActive) {
    active.push(user.name)
  }
}

// PREFERRED - declarative pipeline
const active = users
  .filter(u => u.isActive)
  .map(u => u.name)
```

**When to use `for...of` instead:**
- When you need `break` / `continue` / early exit (can't do that with `.forEach`)
- When you need `await` inside the loop body (sequential async processing)
- When performance matters on very large arrays (avoids intermediate allocations)

## Prefer `.some()` and `.every()` over `for...of` for boolean checks

When the loop's only purpose is to test whether *any* or *all* elements match a condition, use `.some()` / `.every()`. They express intent, return a boolean directly, and short-circuit on the first decisive match - no manual `break` or flag variable needed.

```js
// AVOID - imperative search with flag + break
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

## Map and Set Over Plain Objects

When using an object purely as a key-value store (especially with dynamic keys), use `Map`. When tracking unique values, use `Set`.

```js
// AVOID - object as map
const counts = {}
for (const item of items) {
  counts[item] = (counts[item] || 0) + 1
}

// PREFERRED
const counts = new Map()
for (const item of items) {
  counts.set(item, (counts.get(item) ?? 0) + 1)
}

// AVOID - array for unique values
const seen = []
if (!seen.includes(item)) seen.push(item)

// PREFERRED
const seen = new Set()
seen.add(item)
```

`Map` advantages: any key type, guaranteed order, `.size`, no prototype pollution, better performance for frequent add/delete.
