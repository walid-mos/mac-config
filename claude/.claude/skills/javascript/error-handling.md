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

For language-agnostic error handling principles (fail-fast, error-first ordering, no ambiguous return values), see the `coding` skill (RULE 1, RULE 11).
