---
allowed-tools: Read
description: React and frontend anti-patterns to avoid
---

# /react

React and frontend anti-patterns with correct patterns.

---

## Component Architecture

### God Components
**Problem**: 500+ lines, multiple responsibilities, slow re-renders

```tsx
// GOOD - Split by responsibility
function Dashboard() {
  return (
    <DashboardLayout>
      <UserProfile />
      <StatisticsPanel />
      <ActivityFeed />
    </DashboardLayout>
  )
}
```

### Prop Drilling
```tsx
// BAD - Props through 4+ levels
<App user={user}><Layout user={user}><Header user={user}>

// GOOD - Context or state management
const UserContext = createContext()
<UserContext.Provider value={user}>
  <Layout><Header><UserMenu /></Header></Layout>
</UserContext.Provider>
```

### Wrapper Files in File-Based Routing
```tsx
// BAD - Pointless indirection
export default ProfileScreen  // Just re-exports

// GOOD - Put logic directly in route file
export default function ProfileScreen() {
  return <View>...</View>
}
```

---

## State Management

### Unnecessary State (Derived Data)
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

### State Mutations
```tsx
// BAD - React won't detect change
todos.push(newTodo)
setTodos(todos)

// GOOD - Create new array
setTodos([...todos, newTodo])
setTodos(todos.map(t => t.id === id ? { ...t, text } : t))
```

### Direct setState (Stale Closure Risk)
```tsx
// BAD - Can use stale count in rapid clicks
const handleClick = () => setCount(count + 1)

// GOOD - Functional update always uses latest
const handleClick = () => setCount(prev => prev + 1)
```

### Eager State Initialization
```tsx
// BAD - expensiveCalc runs every render
const [data, setData] = useState(expensiveCalc())

// GOOD - Lazy initialization (runs once)
const [data, setData] = useState(() => expensiveCalc())
```

---

## Performance

### Unnecessary Re-renders
```tsx
// BAD - ExpensiveComponent re-renders on count change
function Parent() {
  const [count, setCount] = useState(0)
  return <ExpensiveComponent data={heavyData} />
}

// GOOD - Memoize or split components
const MemoizedExpensive = React.memo(ExpensiveComponent)
```

### Inline Functions in Lists
```tsx
// BAD - New function every render
{items.map(item => (
  <Item onClick={() => handleClick(item.id)} />
))}

// GOOD - useCallback + pass id
const handleClick = useCallback((id) => { ... }, [])
{items.map(item => (
  <MemoizedItem onClick={handleClick} id={item.id} />
))}
```

### Blocking Updates for Non-Urgent State
```tsx
// BAD - Blocks input while filtering large list
const handleChange = (e) => {
  setQuery(e.target.value)
  setFilteredItems(filterItems(e.target.value)) // Expensive
}

// GOOD - startTransition for non-urgent updates
import { startTransition } from 'react'

const handleChange = (e) => {
  setQuery(e.target.value) // Urgent
  startTransition(() => {
    setFilteredItems(filterItems(e.target.value)) // Deferred
  })
}
```

### Subscribing to Raw Store Values
```tsx
// BAD - Re-renders on any cart change
const cart = useStore(state => state.cart)
const hasItems = cart.length > 0

// GOOD - Subscribe to derived boolean
const hasItems = useStore(state => state.cart.length > 0)
```

---

## Hooks

### Conditional Hooks
```tsx
// BAD - Violates Rules of Hooks
if (shouldFetch) {
  const data = useFetch('/api')  // CRASH!
}

// GOOD - Always call, conditionally use
const data = useFetch(shouldFetch ? '/api' : null)
```

### Missing Dependencies
```tsx
// BAD - Effect won't re-run when userId changes
useEffect(() => {
  fetchUser(userId).then(setUser)
}, [])  // Missing userId!

// GOOD - Include all dependencies
useEffect(() => {
  fetchUser(userId).then(setUser)
}, [userId])
```

---

## Keys

### Index as Key
```tsx
// BAD - Causes bugs with reordering/deletion
{items.map((item, i) => <Item key={i} />)}

// GOOD - Stable unique ID
{items.map(item => <Item key={item.id} />)}
```

---

## Rendering Patterns

### Logical AND (&&) with Numbers
```tsx
// BAD - Renders "0" when count is 0
{count && <Items count={count} />}

// GOOD - Explicit boolean conversion
{count > 0 && <Items count={count} />}
{count > 0 ? <Items count={count} /> : null}
```

### Unmounting for Show/Hide
```tsx
// BAD - Loses state on hide
{isVisible && <ExpensiveComponent />}

// GOOD - CSS hide preserves state
<div style={{ display: isVisible ? 'block' : 'none' }}>
  <ExpensiveComponent />
</div>

// React 19+
<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <ExpensiveComponent />
</Activity>
```

---

## Tailwind in React

### Storing Classes in Constants
```tsx
// BAD
const cardStyles = "flex items-center p-4"
<div className={cardStyles}>

// GOOD - Inline always
<div className="flex items-center p-4">

// EXCEPTION - cva for variants
const buttonVariants = cva("px-4 py-2", { variants: { ... } })
```

### Not Using cn() When Available
```tsx
// BAD - Template literals don't merge classes
<div className={`flex ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// GOOD - cn() merges and dedupes
<div className={cn("flex", isActive ? "bg-blue-500" : "bg-gray-200")}>
```

---

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
| Direct setState | Functional update `prev => prev + 1` |
| Eager state init | Lazy init `useState(() => calc())` |
| Blocking updates | `startTransition` for non-urgent |
| Raw store values | Subscribe to derived boolean |
| `count && <C />` | `count > 0 && <C />` or ternary |
| Unmount to hide | CSS display or Activity component |
| Classes in constants | Inline always (except cva) |
| No cn() | Mandatory when available |
