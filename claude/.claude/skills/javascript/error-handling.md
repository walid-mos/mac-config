# Error Handling - JavaScript-specific

## Check response status on fetch

`fetch` does NOT throw on HTTP errors (4xx, 5xx). You MUST check manually.

```js
// FORBIDDEN - silent failure on 404/500
const data = await fetch(url).then(r => r.json())

// MANDATORY
const res = await fetch(url)
if (!res.ok) {
  throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
}
const data = await res.json()
```

## Use custom error classes for domain errors

```js
class ValidationError extends Error {
  constructor(field, message) {
    super(message)
    this.name = "ValidationError"
    this.field = field
  }
}
```

## Never swallow a caught error

A `catch` that does nothing (or only logs) hides the failure from the caller. Either recover meaningfully, or re-throw — preserve the cause with `{ cause }`.

```js
// FORBIDDEN - error vanishes, caller thinks it succeeded
try {
  await save(record)
} catch (err) {
  console.log(err) // swallowed: caller never learns it failed
}

// MANDATORY - re-throw (optionally wrapped) so the caller can react
try {
  await save(record)
} catch (err) {
  throw new PersistenceError(`Failed to save ${record.id}`, { cause: err })
}
```

Only swallow when the catch genuinely makes the operation succeed (e.g. a documented optional cleanup), and say so in a comment.

For language-agnostic error handling principles (fail-fast, error-first ordering, no ambiguous return values), see the `coding` skill (RULE 1, RULE 11).
