---
triggers:
  project: ["typescript", "react", "next", "node"]
description: Data fetching and error handling patterns
---

# TypeScript Data Fetching & Error Handling

## Core Principle

**NEVER throw errors in APIs and libraries. Return structured results instead.**

Error handling belongs at the **client/UI boundary**, not in business logic.

---

## Discriminated Union State Pattern

For async operations, use discriminated unions with exhaustive status:

```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

**Benefits:**
- TypeScript knows `data` only exists when `status === 'success'`
- No `?`, no `!`, no undefined checks needed
- Exhaustive pattern matching possible

**Usage:**
```typescript
function render(state: AsyncState<User>) {
  if (state.status === 'success') {
    // TypeScript knows 'data' is 100% defined here
    return state.data.name;
  }
}
```

---

## Result Pattern for APIs/Libraries

### Tuple Result (Recommended - 90% of cases)

Preferred because you can name the data whatever you want via destructuring:

```typescript
type Result<T, E = Error> = [E, null] | [null, T];

// In your API/service
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findById(id);
    if (!user) {
      return [new NotFoundError('User not found'), null];
    }
    return [null, user];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}

// Client usage - name data whatever you want!
const [error, user] = await fetchUser('123');
const [err, profile] = await fetchProfile('123');
const [fetchError, products] = await fetchProducts();

if (error) {
  showError(error.message);
  return;
}
console.log(user.name); // TypeScript knows user exists
```

### Object Result (Alternative)

Use when you need to pass the result around or need more explicit status:

```typescript
type ObjectResult<T, E = Error> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

// In your API/service
async function fetchUser(id: string): Promise<ObjectResult<User>> {
  try {
    const user = await db.users.findById(id);
    if (!user) {
      return { status: 'error', error: new NotFoundError('User not found') };
    }
    return { status: 'success', data: user };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Client usage
const result = await fetchUser('123');
if (result.status === 'success') {
  console.log(result.data.name);
} else {
  showError(result.error.message);
}
```

---

## Error Boundary Rules

### Where to Handle Errors

| Layer | Throw? | Return Result? |
|-------|--------|----------------|
| Database/External API | Catch & wrap | Yes |
| Service/Business Logic | Never | Yes |
| API Route Handler | Never | Yes |
| React Component | Handle Result | Display error UI |
| Global Error Boundary | Catch unexpected | Last resort |

### API/Library Code (NEVER throw)

```typescript
// BAD - Throws error
async function getUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  if (!user) throw new Error('Not found'); // DON'T
  return user;
}

// GOOD - Returns Result
async function getUser(id: string): Promise<Result<User>> {
  const user = await db.users.findById(id);
  if (!user) return [new NotFoundError(), null];
  return [null, user];
}
```

### Client Code (Handle errors here)

```typescript
// React component - error handling at UI boundary
function UserProfile({ userId }: Props) {
  const [state, setState] = useState<AsyncState<User>>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });

    getUser(userId).then(([error, user]) => {
      if (error) {
        setState({ status: 'error', error });
      } else {
        setState({ status: 'success', data: user });
      }
    });
  }, [userId]);

  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorMessage error={state.error} />;
  if (state.status === 'success') return <UserCard user={state.data} />;
  return null;
}
```

---

## Custom Error Classes

Use discriminant properties for type narrowing:

```typescript
class NotFoundError extends Error {
  readonly type = 'not-found';
}

class ValidationError extends Error {
  readonly type = 'validation';
  constructor(public fields: Record<string, string>) {
    super('Validation failed');
  }
}

class UnauthorizedError extends Error {
  readonly type = 'unauthorized';
}

type AppError = NotFoundError | ValidationError | UnauthorizedError;

// Type-safe error handling
function handleError(error: AppError) {
  switch (error.type) {
    case 'not-found':
      return { status: 404, message: error.message };
    case 'validation':
      return { status: 400, fields: error.fields };
    case 'unauthorized':
      return { status: 401, message: 'Please login' };
  }
}
```

---

## Quick Reference

```typescript
// Async state for UI
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Result for APIs (tuple - PREFERRED)
type Result<T, E = Error> = [E, null] | [null, T];

// Result for APIs (object - alternative)
type ObjectResult<T, E = Error> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };
```

**Rules:**
1. APIs/libs return `Result`, never throw
2. Prefer tuple `[error, data]` - allows naming data freely
3. Use object result when passing result around or need explicit status
4. Handle errors at client/UI level only
5. Use discriminated unions for exhaustive checking
6. Custom errors with `readonly type` for narrowing
