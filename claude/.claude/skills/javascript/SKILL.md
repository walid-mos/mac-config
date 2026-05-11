---
name: javascript
user-invocable: false
description: >-
  JavaScript-specific best practices that MUST be loaded whenever writing or
  modifying JavaScript files (*.js, *.jsx, *.mjs, *.cjs). Enforces modern
  JS idioms, strict equality, proper async patterns, and safe coding
  practices. Must be used alongside the language-agnostic "coding" skill.
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

- Use arrow functions for callbacks and lambdas.
- Use function declarations for top-level/exported functions (they have hoisting and a name in stack traces).
- **Never use `function` as a callback argument.**

```js
// FORBIDDEN
items.map(function(item) { return item.id })

// MANDATORY
items.map(item => item.id)

// GOOD - top-level named function
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

## Arrays, Iteration, Map and Set

See [arrays.md](arrays.md) for examples and decision rules. Quick summary:

- Prefer `.filter`/`.map`/`.reduce` pipelines over imperative loops.
- Use `for...of` when you need `break`/`continue`/`await` or to avoid intermediate allocations.
- Use `.some()` / `.every()` for boolean any/all checks - never a manual loop with flag + break.
- **FORBIDDEN:** `for...in` on arrays.
- Use `Map` for key-value stores with dynamic keys, `Set` for unique values - not plain objects/arrays.

---

## Async / Await

See [async.md](async.md) for the full decision tree. Quick summary:

- Always `async/await`, never `.then()` chains.
- **Default concurrency:** `Promise.allSettled` for independent operations.
- `Promise.all` only when one failure should abort the batch.
- Sequential `for...of` + `await` only when order matters or a shared resource forbids concurrency.
- Never fire-and-forget: `await` the call or attach `.catch(handleError)`.

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

See [error-handling.md](error-handling.md) for examples. Quick summary:

- `fetch` does NOT throw on 4xx/5xx - check `res.ok` manually.
- Use custom error classes (`class ValidationError extends Error`) for domain errors.
- For language-agnostic error principles, see the `coding` skill (RULE 1, RULE 11).

---

## No Inline Non-JS Content

NEVER embed non-JS content (TOML, JSON, YAML, HTML, XML, SQL, CSS, etc.) as hardcoded multiline strings or template literals in JS/TS files.

**In application code**: ALWAYS use separate files with the proper extension and load them (`fs.readFileSync`, `import`, etc.).

**In tests**: Use separate fixture files in a `fixtures/` or `__fixtures__/` directory next to the test file. Load them with a helper.

**Only exception**: Very short strings (1-2 lines max) where a separate file would be overkill (e.g., a one-line parser test).

```js
// FORBIDDEN - inline TOML in template literal
const path = writeTOML(`
[project]
name = "my-app"
type = "app"
`)

// CORRECT - fixture file: fixtures/minimal-config.toml
const path = writeTOML(readFixture("minimal-config.toml"))
```

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
| `\|\|` for non-boolean defaults | AVOID | `??` (nullish coalescing) |
| String concatenation with `+` | AVOID | Template literals |
| `function` in callbacks | AVOID | Arrow functions |
| Default exports | AVOID | Named exports |
| Fire-and-forget promises | NEVER | `await` or `.catch()` |
| Sequential `await` for independent ops | NEVER | `Promise.allSettled` (default) or `Promise.all` |
| `for...of` + `await` when parallelizable | AVOID | `Promise.allSettled` unless order/race matters |
| Unchecked `fetch` response | NEVER | Check `res.ok` |
