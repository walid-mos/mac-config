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

## See also

- [architecture.md](architecture.md) - Project-level architectural rules: no god objects, typed structures over positional data, dispatch tables over switch chains, explicit invariants and ownership, centralized cross-cutting namespaces, velocity-vs-progress signals. Load when designing or modifying structures across files, not just functions.

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

## RULE 12 - Context Discipline (Grep Before Read)

Most of an AI coding bill is paying for context that never gets used. Reading 2000-line files to fix 30 lines is the single biggest leak. Don't do it.

**Mandatory habits:**
- **Locate before opening.** Use `Grep` / `Glob` first to find the exact symbol, function, or filename. Only `Read` once you know which file and roughly which lines matter.
- **Read targeted slices.** When a file is large (>500 lines) and you know the area, pass `offset` and `limit` to `Read`. Do NOT default to loading whole files.
- **One file at a time, on demand.** Never pre-load 5 files "in case they're related". Open the next file only when the current one tells you to.
- **Delegate breadth to Explore.** For "where is X defined / which files reference Y" across the repo, spawn the `Explore` subagent rather than running grep+Read in the main loop. Explore returns a digest; the main loop stays small.
- **Don't re-read after editing.** `Edit` and `Write` are tracked. Reading a file you just changed to "verify" is pure waste - the tool would have errored if the change failed.

```
// FORBIDDEN - blind whole-file read for a small fix
Read("/path/to/big-module.ts")            // 1800 lines, you need 20

// MANDATORY - locate, then slice
Grep("functionName", path="/path/to")     // returns file:line
Read("/path/to/big-module.ts", offset=420, limit=60)
```

If you cannot articulate WHY you need to read a file right now, do not read it.

---

## RULE 13 - Model Routing on Subagent Calls

The `Agent` tool accepts an optional `model` parameter (`"haiku" | "sonnet" | "opus"`). Use it. Running Opus on lint, lookup, or rename is paying premium for what Haiku nails.

**Pass `model: "haiku"` explicitly when invoking Agent for:**
- Read-only search / lookup (`Explore` agent, "where is X", "find references")
- Mechanical edits (rename a symbol, fix a lint, tweak a log message, adjust formatting)
- Status / introspection (`statusline-setup`, "what's the current git state")
- Q&A about tooling (`claude-code-guide`, "how does hook X work")

**Do NOT override (let it inherit) for:**
- `general-purpose` multi-step work (research + edits + reasoning)
- `Plan` (architect / design)
- Code review, security review
- Anything requiring cross-file reasoning, design tradeoffs, or correctness judgment

**Rule of thumb:** if the task is "find / list / format / rename", it's a Haiku job. If it's "decide / design / reason / refactor across files", let the parent model handle it.

```
// MANDATORY - cheap lookup
Agent({ subagent_type: "Explore", model: "haiku", prompt: "find every call site of fooBar across packages/" })

// MANDATORY - no override, real work
Agent({ subagent_type: "general-purpose", prompt: "refactor the auth flow to use the new session API" })
```

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
| `Read` whole file before locating area | FORBIDDEN | `Grep`/`Glob` first, then `Read` with `offset`/`limit` |
| Pre-loading files "just in case" | FORBIDDEN | Open files on demand, one at a time |
| Re-reading a file you just edited | FORBIDDEN | Trust the edit; tool would error on failure |
| Default model for `Explore`/lookup `Agent` calls | FORBIDDEN | Pass `model: "haiku"` explicitly |
| Overriding `model` on `general-purpose`/`Plan` | FORBIDDEN | Let it inherit the parent model |

