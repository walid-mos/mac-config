---
name: coding
user-invocable: false
description: >-
  Language-agnostic coding rules that MUST be loaded whenever writing or
  modifying code in ANY language. Enforces early returns, flat control flow,
  small functions, meaningful naming, and clean code principles. These rules
  are MANDATORY - they apply on top of any language-specific skill.
---

# Coding Rules - Mandatory, Language-Agnostic

These rules apply to ALL code you write or modify, in every language. No exceptions.

---

## RULE 1 - Early Returns (Guard Clauses)

Handle invalid/edge cases FIRST and return immediately. Never wrap the entire function body in an `if`. Errors first, happy path last at natural indentation.

```
// FORBIDDEN
function getDiscount(user) {
  if (user) {
    if (user.isActive) {
      if (user.hasMembership) {
        return calculateDiscount(user)
      }
    }
  }
  return 0
}

// MANDATORY
function getDiscount(user) {
  if (!user) return 0
  if (!user.isActive) return 0
  if (!user.hasMembership) return 0

  return calculateDiscount(user)
}
```

If you can exit early, exit early. The main logic should never be inside a conditional - it is the natural continuation after all guards pass.

---

## RULE 2 - Maximum Nesting Depth: 2 Levels

If your code goes deeper than 2 levels of indentation (relative to the function body), it MUST be refactored. Deep nesting destroys readability.

**Techniques to reduce nesting:**
- Early returns (Rule 1)
- Extract inner blocks into named functions
- Invert conditions
- Use `continue` / `break` in loops to skip early
- Use pipeline-style operations (map/filter/reduce) instead of nested loops

```
// FORBIDDEN - 4 levels deep
function processOrders(orders) {
  for (const order of orders) {
    if (order.isValid) {
      for (const item of order.items) {
        if (item.inStock) {
          ship(item)
        }
      }
    }
  }
}

// MANDATORY - flat
function processOrders(orders) {
  const validOrders = orders.filter(o => o.isValid)

  for (const order of validOrders) {
    shipAvailableItems(order.items)
  }
}

function shipAvailableItems(items) {
  for (const item of items) {
    if (!item.inStock) continue
    ship(item)
  }
}
```

---

## RULE 3 - Small, Focused Functions

Each function does ONE thing. If you need "and" to describe what a function does, split it. ~20 lines is a baseline; the real signal is mixing multiple things or abstraction levels.

- **Single level of abstraction.** Don't mix high-level orchestration with low-level details in the same function. A function should either call other functions (orchestrate) or do a small piece of work (implement) - not both.

```
// FORBIDDEN - orchestration mixed with implementation detail
function registerUser(data) {
  // validation (low-level)
  if (!data.email || !data.email.includes("@")) throw new Error("bad email")
  if (data.password.length < 8) throw new Error("weak password")

  // hashing (low-level)
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(data.password, salt, 10000, 64, "sha512")

  // persistence (low-level)
  db.query("INSERT INTO users ...")

  // email (low-level)
  smtp.send({ to: data.email, subject: "Welcome", ... })
}

// MANDATORY - orchestration at one level
function registerUser(data) {
  validateRegistration(data)
  const user = createUser(data)
  sendWelcomeEmail(user)
}
```

---

## RULE 4 - Meaningful Naming

Names are documentation. Bad names create confusion that comments can't fix.

### Variables
- **Describe WHAT it holds**, not the type or structure: `activeUsers` not `userList`, `retryDelayMs` not `num`.
- **Booleans read as yes/no questions:** `isActive`, `hasPermission`, `canRetry`, `shouldNotify`. Never `active`, `flag`, `status` for a boolean.
- **Use domain language.** If the business calls it a "claim", the code calls it `claim`, not `request` or `item`.

### Functions
- **Verbs for actions:** `fetchUser`, `validateEmail`, `calculateTax`.
- **Predicates return booleans:** `isValid`, `hasAccess`, `canAfford`.
- **Name reveals intent, not mechanics:** `ensureAuthenticated` not `checkAndMaybeRedirect`.

### Avoid
- **Single-letter names** except in trivial lambdas (`items.map(x => x.id)` is fine).
- **Abbreviations** that aren't universally known: `cfg`, `ctx`, `mgr`, `svc` - write the full word unless the abbreviation is standard in the domain (e.g. `URL`, `HTTP`, `ID`).
- **Generic names:** `data`, `info`, `result`, `item`, `value`, `temp`, `stuff`. If everything is `data`, nothing is.
- **Negated booleans:** `isNotReady`, `hasNoAccess` - use the positive form and negate at the call site.

---

## RULE 5 - No Magic Values

Every literal value that isn't self-evident (0, 1, "", true/false) MUST be a named constant.

```
// FORBIDDEN
if (retries > 3) ...
setTimeout(fn, 86400000)
if (user.role === "adm") ...

// MANDATORY
const MAX_RETRIES = 3
const ONE_DAY_MS = 86_400_000
const ROLE_ADMIN = "adm"

if (retries > MAX_RETRIES) ...
setTimeout(fn, ONE_DAY_MS)
if (user.role === ROLE_ADMIN) ...
```

Exception: values that are obvious from context don't need a constant (`arr.length === 0`, `index + 1`, `i < n`).

---

## RULE 6 - Avoid Boolean Parameters

Boolean parameters make call sites unreadable.

```
// FORBIDDEN - what does `true` mean here?
createUser(data, true)
formatDate(now, false, true)

// MANDATORY - use an options object or separate functions
createUser(data, { sendWelcomeEmail: true })
// or
createUserWithWelcome(data)
createUserSilently(data)
```

One boolean on an internal/private helper is tolerable. Two or more booleans on any function is always forbidden.

---

## RULE 7 - Immutability by Default

Do not mutate inputs. Do not mutate shared state. Create new values.

- Never modify function parameters.
- Use `const` / `val` / `let` (immutable) by default. Mutable variables only when accumulation or reassignment is genuinely needed.
- Prefer pure transformations: `map`, `filter`, spread/copy - over in-place `push`, `splice`, `sort` on shared data.
- When mutation is necessary for performance, keep it local to the function scope - never mutate something the caller owns.

---

## RULE 8 - Pure Functions First

Prefer functions with no side effects. A pure function takes inputs and returns outputs - nothing else.

- **Separate computation from side effects.** Compute the result, then apply it. Don't interleave IO in the middle of a calculation.
- **Side-effectful operations** (DB, network, file, logging) should live at the edges, not in utility/helper functions.
- This makes code testable without mocks and easier to reason about.

---

## RULE 9 - Simplify Conditionals

### Prefer positive conditions
```
// HARD TO READ - double negation
if (!isNotReady) ...

// CLEAR
if (isReady) ...
```

### Consolidate related conditions
```
// FORBIDDEN - scattered checks
if (!user) return
if (!user.email) return
if (!user.isVerified) return

// PREFERRED - one clear guard
if (!user?.email || !user.isVerified) return
```

### Use lookup tables instead of long if/else or switch chains
```
// AVOID - long chain
if (status === "active") return handleActive()
else if (status === "pending") return handlePending()
else if (status === "cancelled") return handleCancelled()
// ... 10 more

// PREFERRED - lookup
const handlers = { active: handleActive, pending: handlePending, cancelled: handleCancelled }
const handler = handlers[status]
if (!handler) throw new Error(`Unknown status: ${status}`)
return handler()
```

---

## RULE 10 - No Dead Code

- Delete commented-out code. Git remembers.
- Delete unused functions, variables, imports. Don't leave them "just in case".
- Delete unreachable branches. If a condition can never be true, remove it.

---

## RULE 11 - Fail Fast, Fail Loud

Errors should be caught AS CLOSE to their source as possible and should produce a CLEAR message.

- Validate inputs at function entry - don't let invalid data travel deep before exploding.
- Error messages MUST include context: what was expected, what was received, and what the caller should do about it.
- Never return ambiguous values (`null`, `-1`, `false`) to signal errors when the language supports proper error handling (exceptions, Result types, etc.).

---

## Quick Reference - Forbidden vs Mandatory

| Pattern | Verdict | Instead |
|---|---|---|
| Whole function body inside `if` | FORBIDDEN | Early return |
| Success path before error path | FORBIDDEN | Error-first, early return |
| Nesting > 2 levels | FORBIDDEN | Extract, early return, continue |
| Functions doing multiple things | FORBIDDEN | Split by responsibility |
| Generic names (`data`, `result`, `temp`) | FORBIDDEN | Descriptive domain names |
| Magic numbers/strings | FORBIDDEN | Named constants |
| Boolean parameters | FORBIDDEN (2+) | Options object or separate functions |
| Mutating function inputs | FORBIDDEN | Return new values |
| Commented-out code | FORBIDDEN | Delete it |
| Negated boolean names | FORBIDDEN | Positive form |
| Side effects in pure helpers | FORBIDDEN | Push IO to the edges |
| Em dash character `-` (U+2014) | FORBIDDEN | Use `-` with spaces or rephrase |

