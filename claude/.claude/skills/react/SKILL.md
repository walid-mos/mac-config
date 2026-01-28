---
name: react
description: React and frontend anti-patterns to avoid. Use when writing React components, hooks, or discussing frontend architecture.
allowed-tools: Read
---

# React Anti-Patterns

React and frontend patterns with correct implementations.

## Quick Rules

- Split god components (500+ lines) by responsibility
- Use Context/state management instead of prop drilling (4+ levels)
- Compute derived data on render, don't store in state
- **NEVER mutate state** - create new arrays/objects
- Use functional updates: `setCount(prev => prev + 1)`
- Use lazy initialization: `useState(() => expensiveCalc())`
- **Always call hooks unconditionally** - conditionally use results
- Use stable unique IDs as keys, **never array index**
- Use `count > 0 &&` not `count &&` (avoids rendering "0")

## State Management

```tsx
// BAD - Storing computed values
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${user.firstName} ${user.lastName}`)
}, [user])

// GOOD - Compute on render
const fullName = `${user.firstName} ${user.lastName}`

// For expensive operations
const result = useMemo(() => expensiveCalc(data), [data])
```

```tsx
// BAD - Stale closure risk
const handleClick = () => setCount(count + 1)

// GOOD - Functional update
const handleClick = () => setCount(prev => prev + 1)
```

```tsx
// BAD - Eager initialization
const [data, setData] = useState(expensiveCalc())

// GOOD - Lazy initialization
const [data, setData] = useState(() => expensiveCalc())
```

## Performance

```tsx
// BAD - New function every render in list
{items.map(item => (
  <Item onClick={() => handleClick(item.id)} />
))}

// GOOD - useCallback + pass id
const handleClick = useCallback((id) => { ... }, [])
{items.map(item => (
  <MemoizedItem onClick={handleClick} id={item.id} />
))}
```

```tsx
// BAD - Blocks input while filtering
const handleChange = (e) => {
  setQuery(e.target.value)
  setFilteredItems(filterItems(e.target.value)) // Expensive
}

// GOOD - startTransition for non-urgent updates
const handleChange = (e) => {
  setQuery(e.target.value) // Urgent
  startTransition(() => {
    setFilteredItems(filterItems(e.target.value)) // Deferred
  })
}
```

## Hooks

```tsx
// BAD - Violates Rules of Hooks
if (shouldFetch) {
  const data = useFetch('/api')  // CRASH!
}

// GOOD - Always call, conditionally use
const data = useFetch(shouldFetch ? '/api' : null)
```

```tsx
// BAD - Missing userId dependency
useEffect(() => {
  fetchUser(userId).then(setUser)
}, [])

// GOOD - Include all dependencies
useEffect(() => {
  fetchUser(userId).then(setUser)
}, [userId])
```

## Keys

```tsx
// BAD - Index as key (bugs with reordering)
{items.map((item, i) => <Item key={i} />)}

// GOOD - Stable unique ID
{items.map(item => <Item key={item.id} />)}
```

## Rendering

```tsx
// BAD - Renders "0" when count is 0
{count && <Items count={count} />}

// GOOD - Explicit boolean
{count > 0 && <Items count={count} />}
```

## Tailwind in React

```tsx
// BAD - Classes in constants
const cardStyles = "flex items-center p-4"
<div className={cardStyles}>

// GOOD - Inline always
<div className="flex items-center p-4">

// EXCEPTION - cva for variants
const buttonVariants = cva("px-4 py-2", { variants: { ... } })
```

```tsx
// BAD - Template literals
<div className={`flex ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// GOOD - cn() merges and dedupes
<div className={cn("flex", isActive ? "bg-blue-500" : "bg-gray-200")}>
```

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| God components | Split by responsibility |
| Prop drilling | Context or state management |
| Derived state | Compute on render / useMemo |
| State mutation | New objects/arrays |
| Inline functions | useCallback |
| Conditional hooks | Always call, conditionally use |
| Missing deps | Include all in dependency array |
| Index as key | Stable unique ID |
| Direct setState | Functional update |
| `count && <C />` | `count > 0 && <C />` |
