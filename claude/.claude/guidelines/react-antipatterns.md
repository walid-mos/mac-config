---
triggers:
  project: ["react", "next", "solid", "vue"]
description: React and frontend anti-patterns
---

# React & Frontend Anti-Patterns

## Tailwind CSS

### ⛔ Storing Classes in Constants
```tsx
// BAD
const cardStyles = "flex items-center p-4"
<div className={cardStyles}>

// GOOD - Inline always
<div className="flex items-center p-4">

// EXCEPTION - cva for variants
const buttonVariants = cva("px-4 py-2", { variants: { ... } })
```

### ⛔ Not Using cn() When Available
```tsx
// BAD - Template literals don't merge classes
<div className={`flex ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// GOOD - cn() merges and dedupes
<div className={cn("flex", isActive ? "bg-blue-500" : "bg-gray-200")}>
```

### ⛔ Mixing Inline Styles with Tailwind
```tsx
// BAD
<div className="flex" style={{ padding: '16px' }}>

// GOOD - Use Tailwind utilities
<div className="flex p-4">
```

---

## Component Architecture

### ⛔ God Components
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

### ⛔ Prop Drilling
**Problem**: Tight coupling, hard to refactor

```tsx
// BAD - Props passed through 4+ levels
<App user={user}><Layout user={user}><Header user={user}>

// GOOD - Use Context or state management
const UserContext = createContext()
<UserContext.Provider value={user}>
  <Layout><Header><UserMenu /></Header></Layout>
</UserContext.Provider>

function UserMenu() {
  const user = useContext(UserContext)
}
```

### ⛔ Wrapper Files in File-Based Routing
```tsx
// BAD - Pointless indirection
// app/profile.tsx
export default ProfileScreen  // Just re-exports

// GOOD - Put logic in route file directly
// app/profile.tsx
export default function ProfileScreen() {
  return <View>...</View>
}
```

---

## State Management

### ⛔ Unnecessary State (Derived Data)
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

### ⛔ State Mutations
```tsx
// BAD - React won't detect change
todos.push(newTodo)
setTodos(todos)

// GOOD - Create new array
setTodos([...todos, newTodo])

// GOOD - Update item
setTodos(todos.map(t => t.id === id ? { ...t, text } : t))
```

---

## Performance

### ⛔ Unnecessary Re-renders
```tsx
// BAD - ExpensiveComponent re-renders on count change
function Parent() {
  const [count, setCount] = useState(0)
  return <ExpensiveComponent data={heavyData} />
}

// GOOD - Memoize or split components
const MemoizedExpensive = React.memo(ExpensiveComponent)

// OR move state to child
function Counter() {
  const [count, setCount] = useState(0)
  return <button>{count}</button>
}
```

### ⛔ Inline Functions in Lists
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

---

## Hooks

### ⛔ Conditional Hooks
```tsx
// BAD - Violates Rules of Hooks
if (shouldFetch) {
  const data = useFetch('/api')  // CRASH!
}

// GOOD - Always call, conditionally use
const data = useFetch(shouldFetch ? '/api' : null)
```

### ⛔ Missing Dependencies
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

## Testing

### ⛔ Testing Implementation Details
```tsx
// BAD - Tests internal state
expect(wrapper.state('count')).toBe(5)

// GOOD - Test user-facing behavior
fireEvent.click(screen.getByRole('button'))
expect(screen.getByText(/count: 1/)).toBeInTheDocument()
```

### ⛔ Not Cleaning Mocks
```tsx
// GOOD - Always clean up
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
```

---

## Keys

### ⛔ Index as Key
```tsx
// BAD - Causes bugs with reordering/deletion
{items.map((item, i) => <Item key={i} />)}

// GOOD - Stable unique ID
{items.map(item => <Item key={item.id} />)}
```

---

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| Classes in constants | Inline always (except cva) |
| No cn() | Mandatory when available |
| God components | Split by responsibility |
| Prop drilling | Context or state management |
| Derived state | Compute on render / useMemo |
| State mutation | New objects/arrays |
| Inline functions | useCallback |
| Conditional hooks | Always call, conditionally use |
| Missing deps | Include all in dependency array |
| Index as key | Stable unique ID |
