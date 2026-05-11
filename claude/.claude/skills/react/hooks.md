# Hooks Discipline

## Rules of Hooks (Non-Negotiable)

1. Only call hooks at the **top level** - never inside loops, conditions, or nested functions
2. Only call hooks from React function components or custom hooks

## Never Suppress exhaustive-deps

```tsx
// FORBIDDEN
useEffect(() => {
  fetchData(userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// MANDATORY - fix the code, not the linter
useEffect(() => {
  fetchData(userId)
}, [userId])
```

If the linter complains, the code has a design problem. Fix the design.

## Dependency Removal Checklist

When an Effect has too many dependencies, work through this in order:

1. **Should it be an event handler?** Move to handler
2. **Does it do multiple unrelated things?** Split into separate Effects
3. **Updating state based on previous state?** Use updater: `setCount(c => c + 1)` (removes `count` from deps)
4. **Object/function dep changes every render?** Move creation inside the Effect, or destructure props to primitives
5. **Need to read a value without reacting to it?** Use `useEffectEvent`

## Custom Hooks

- Names MUST start with `use` + capital letter
- Functions that don't call hooks MUST NOT start with `use` - use `get`, `create`, `calculate`
- Custom hooks share **stateful logic**, NOT state - each call gets independent state
- Extract when: logic is duplicated, or an Effect's intent becomes clearer when named

```tsx
// GOOD - clear intent, reusable
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
```

## Lifecycle Wrappers - FORBIDDEN

```tsx
// FORBIDDEN - all of these
function useMount(fn: () => void) { useEffect(fn, []) }
function useEffectOnce(fn: () => void) { useEffect(fn, []) }
function useUpdateEffect(fn, deps) { /* skip first render */ }
```

These mimic class lifecycle methods, bypass dependency linting, and prevent proper synchronization. Do not create them, do not use them.
