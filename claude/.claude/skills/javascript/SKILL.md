---
name: javascript
user-invocable: false
description: >-
  JavaScript-specific best practices and idioms. Use when writing or
  modifying *.js, *.jsx, *.mjs, or *.cjs files. Must be loaded alongside
  the language-agnostic "coding" skill.
---

# JavaScript Best Practices - Mandatory Rules

These rules apply to ALL JavaScript code you write or modify. They build on top of the language-agnostic coding rules, which also apply.

## Deep-dive references

For detailed examples and decision trees, consult these sub-files when relevant:

- [async.md](async.md) - async/await, Promise.all vs allSettled, fire-and-forget rules
- [arrays.md](arrays.md) - declarative methods, `.some`/`.every`, `Map`/`Set` over plain objects
- [error-handling.md](error-handling.md) - fetch status checks, custom error classes

---

## RULE 0 - ABSOLUTE BANS

### `var` is FORBIDDEN

Always use `const`. Use `let` only when reassignment is genuinely needed. `var` has function scoping, hoisting, and redeclaration bugs. It does not exist in modern code.

```js
var user = getUser()       // FORBIDDEN
const user = getUser()     // MANDATORY
let count = 0              // let ONLY when actually reassigned
```

### `==` and `!=` are FORBIDDEN

Always use `===` and `!==`. Loose equality has insane coercion rules that cause real bugs.

```js
// FORBIDDEN
if (status != "active")

// MANDATORY
if (value === null || value === undefined)
if (status !== "active")
```

**Single tolerated exception:** `value == null` (matches both `null` and `undefined`) is a well-known idiom. Pick one form per project and stay consistent.

### `eval()`, `with`, `arguments` object are FORBIDDEN

- `eval()` - security hole, performance killer. Never.
- `with` - scoping chaos. Never.
- `arguments` - use rest parameters (`...args`) instead.

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

// PREFERRED
const { name, email } = user
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

Use arrow functions for callbacks; use named function declarations at top level (hoisting + stack-trace names). Implicit return preferred for one-expression arrows.

```js
items.map(item => item.id)               // MANDATORY (not `function(item) { ... }`)
export function calculateTax(a, r) { ... } // top-level named
```

---

## Arrays, Iteration, Map and Set

Declarative pipelines over loops, `.some()`/`.every()` for any/all checks, `for...in` on arrays FORBIDDEN, `Map`/`Set` over plain objects/arrays. **[arrays.md](arrays.md) is the canonical source** — load it for the decision rules and examples.

---

## Async / Await

Always `async/await` (never `.then()` chains), `Promise.allSettled` is the default for independent ops, never fire-and-forget. **[async.md](async.md) is the canonical source** — load it for the concurrency decision tree (`allSettled` vs `all` vs sequential).

---

## Object and Spread Patterns

### Spread for shallow copies

```js
const updated = { ...user, name: "new name" }
const copy = [...items]
```

### Use `structuredClone` for deep copies

```js
// FORBIDDEN - JSON roundtrip loses dates, functions, undefined, etc.
const deep = JSON.parse(JSON.stringify(obj))

// MANDATORY
const deep = structuredClone(obj)
```

**Caveat:** `structuredClone` silently drops functions, DOM nodes, and class-instance methods (it throws on functions at the top level but drops them inside objects). Use it only for plain-data objects.

### Optional chaining and nullish coalescing

```js
// AVOID - verbose null checks
const city = user && user.address && user.address.city

// MANDATORY
const city = user?.address?.city

// AVOID - falsy-tripped fallback
const port = config.port || 3000 // BUG: port 0 is valid but falsy

// MANDATORY - nullish coalescing
const port = config.port ?? 3000
```

**Rule:** use `||` only for booleans. For everything else, use `??` to avoid the falsy trap (`0`, `""`, `false` are valid values).

### Logical assignment operators

Collapse conditional-assignment patterns with `??=`, `||=`, `&&=`. Same nullish-vs-falsy rule applies: prefer `??=` over `||=` for defaults.

```js
// AVOID
if (config.port === undefined || config.port === null) config.port = 3000
options.tags = options.tags || []

// MANDATORY
config.port ??= 3000   // assign only if null/undefined (port 0 stays 0)
options.tags ||= []    // assign on any falsy value
```

---

## Never Mutate Function Arguments

Treat parameters as read-only. Mutating an object or array passed by the caller is a silent bug: the caller's value changes under them. Copy before you write.

```js
// FORBIDDEN - mutates the caller's object/array in place
function addRole(user, role) {
  user.roles.push(role) // caller's user is now mutated
  return user
}

// MANDATORY - copy, then modify the copy
function addRole(user, role) {
  return { ...user, roles: [...user.roles, role] }
}
```

Use spread for shallow copies, `structuredClone` when you must mutate deeply. Same applies to defaults: never `arr.sort()` / `arr.reverse()` (in-place) on a parameter — copy first (`[...arr].sort()`) or use `arr.toSorted()` / `arr.toReversed()`.

---

## Modules and Imports

- **Use ES modules** (`import/export`). Not CommonJS (`require`) unless forced by the runtime/config.
- **Prefer named exports** over default exports. Named exports are refactor-safe and auto-importable.
- **One module, one responsibility (MANDATORY).** A module that exports more than one unrelated concern MUST be split. A `utils.js` / `helpers.js` catch-all of unrelated functions is FORBIDDEN — name the module after its single concern (`tax.js`, `formatDate.js`). For the SOLID/SRP rationale and clean file-splitting thresholds see `/coding` RULE 13; for DRY (extract repeated logic, never inline-duplicate) see `/coding` RULE 12.

```js
// AVOID
export default function calculateTax(amount, rate) { ... }

// PREFERRED
export function calculateTax(amount, rate) { ... }
```

---

## Error Handling (JS-Specific)

`fetch` does NOT throw on 4xx/5xx (check `res.ok`), custom error classes for domain errors, never swallow a caught error silently. **[error-handling.md](error-handling.md) is the canonical source** — load it for the examples. Language-agnostic error principles: `/coding` RULE 1, RULE 11.

---

## Forbidden Patterns - Quick Reference

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
| `\|\|` for non-boolean defaults | AVOID | `??` / `??=` (nullish) |
| `if (x == null) x = d` assignment | AVOID | `x ??= d` / `x \|\|= d` / `x &&= d` |
| String concatenation with `+` | AVOID | Template literals |
| `function` in callbacks | AVOID | Arrow functions |
| Default exports | AVOID | Named exports |
| `utils.js` grab-bag of unrelated fns | NEVER | One module, one concern (`/coding` RULE 13) |
| Mutating a function argument in place | NEVER | Copy first (spread / `structuredClone`) |
| In-place `.sort()`/`.reverse()` on a param | NEVER | `[...arr].sort()` / `.toSorted()` |
| Fire-and-forget promises | NEVER | `await` or `.catch()` |
| Sequential `await` for independent ops | NEVER | `Promise.allSettled` (default) or `Promise.all` |
| `for...of` + `await` when parallelizable | AVOID | `Promise.allSettled` unless order/race matters |
| Unchecked `fetch` response | NEVER | Check `res.ok` |
| Swallowed / silently-logged caught error | NEVER | Recover or re-throw (`{ cause }`) |
| `structuredClone` on objects with methods/fns | NEVER | Clone plain data only |
