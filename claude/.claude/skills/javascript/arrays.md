# Arrays, Iteration, Map and Set - JavaScript

## Array Methods Over Loops

Prefer declarative array methods (`.filter`/`.map`/`.reduce`) over imperative loops when transforming data.

**When `for...of` is the right call:**
- You need `break` / `continue` / early exit (impossible with `.forEach`)
- You need `await` inside the loop body (sequential async processing)
- Performance matters on very large arrays (avoids intermediate allocations)

Keep `for...of` only when the loop body does real work beyond a boolean test (side effects, `await`, accumulating non-boolean state).

## `.some()` / `.every()` for boolean checks

When the loop's only purpose is to test whether *any* or *all* elements match, use `.some()` / `.every()`. They express intent, return the boolean directly, and short-circuit - no manual `break` or flag variable. (The linter catches the `.filter(...).length > 0` variant; the flag+break loop is on you.)

```js
// AVOID - imperative search with flag + break
let hasAdmin = false
for (const user of users) {
  if (user.role === "admin") { hasAdmin = true; break }
}

// MANDATORY
const hasAdmin = users.some(u => u.role === "admin")
const allValid = items.every(i => i.isValid)
```

(`for...in` on arrays is linted - type-aware `no-for-in-array`.)

## Map and Set Over Plain Objects

When using an object purely as a key-value store (especially with dynamic keys), use `Map`. When tracking unique values, use `Set`.

```js
// AVOID - object as map
const counts = {}
for (const item of items) counts[item] = (counts[item] || 0) + 1

// PREFERRED
const counts = new Map()
for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)

// AVOID - array for unique values        // PREFERRED
if (!seen.includes(item)) seen.push(item)  // const seen = new Set(); seen.add(item)
```

