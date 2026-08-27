# Typed Error Handling - TypeScript

## Catch as `unknown`, narrow before touching

```typescript
try {
  await save(user)
} catch (e: unknown) {
  if (e instanceof ValidationError) return { ok: false, error: e.message }
  throw e
}
```

## Result returns for expected, recoverable failures

Prefer a **Result/discriminated-union return** over throwing - the compiler forces the caller to handle both branches:

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

## Exhaustive switches with a `never` guard

A new union variant becomes a compile error. The type-aware linter also checks exhaustiveness - and fires even when a `default` exists, by design:

```typescript
switch (shape.kind) {
  case "circle": return Math.PI * shape.r ** 2
  case "square": return shape.side ** 2
  default: {
    const _exhaustive: never = shape
    throw new Error(`Unhandled shape: ${String(_exhaustive)}`)
  }
}
```
