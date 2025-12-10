# React & Frontend Anti-Patterns

React, component, and frontend-specific anti-patterns and common mistakes to avoid.

---

## Tailwind CSS Anti-Patterns

### ⛔ Storing Tailwind Classes in Constants

**Anti-Pattern**:
```tsx
const cardStyles = "flex items-center p-4 bg-white rounded-lg"
const buttonStyles = "px-4 py-2 bg-blue-500 text-white rounded"

function Card() {
  return <div className={cardStyles}>Content</div>
}
```

**Why It's Wrong**:
- Defeats Tailwind's utility-first philosophy
- Harder to scan and modify
- Can't see styles at component usage
- Prevents tailwind-merge from working properly

**✅ Correct Approach**:
```tsx
function Card() {
  return (
    <div className="flex items-center p-4 bg-white rounded-lg">
      Content
    </div>
  )
}

// OR with cn() for conditional logic
function Card({ isActive }: { isActive: boolean }) {
  return (
    <div className={cn(
      "flex items-center p-4 bg-white rounded-lg",
      isActive && "border-2 border-blue-500"
    )}>
      Content
    </div>
  )
}

// ONLY exception: cva for component variants
const buttonVariants = cva(
  "px-4 py-2 rounded font-medium",
  {
    variants: {
      variant: {
        primary: "bg-blue-500 text-white",
        secondary: "bg-gray-500 text-white",
      }
    }
  }
)
```

**Rule**: Inline Tailwind classes always, except when using `cva` for component variants.

---

### ⛔ Not Using cn() When Available

**Anti-Pattern**:
```tsx
<div className={`flex items-center ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// OR
<div className={clsx('flex items-center', isActive && 'bg-blue-500')}>
```

**Why It's Wrong**:
- Missing tailwind-merge functionality
- Tailwind class conflicts not resolved
- Inconsistent with project patterns
- Both `bg-blue-500` and `bg-gray-200` might be applied

**✅ Correct Approach**:
```tsx
<div className={cn(
  'flex items-center',
  isActive ? 'bg-blue-500' : 'bg-gray-200'
)}>
```

**Rule**: When `cn()` utility exists in project, it's MANDATORY to use it.

---

### ⛔ Mixing Inline Styles with Tailwind

**Anti-Pattern**:
```tsx
<div className="flex items-center" style={{ padding: '16px', color: 'red' }}>
  Content
</div>
```

**Why It's Wrong**:
- Defeats Tailwind's utility-first approach
- Can't use responsive/hover/dark variants on inline styles
- Harder to maintain consistency
- Inline styles have higher specificity (can cause issues)

**✅ Correct Approach**:
```tsx
<div className="flex items-center p-4 text-red-500">
  Content
</div>

// If dynamic values needed
<div
  className="flex items-center p-4"
  style={{
    '--dynamic-color': color,
    backgroundColor: 'var(--dynamic-color)'
  } as React.CSSProperties}
>
  Content
</div>
```

**Rule**: Use Tailwind utilities for all static styling. Only use inline styles for truly dynamic values.

---

## Component Architecture Anti-Patterns

### ⛔ God Components

**Anti-Pattern**:
```tsx
function Dashboard() {
  // 500+ lines of code
  // Handles auth, data fetching, rendering, state management
  // Multiple responsibilities
  const [user, setUser] = useState()
  const [posts, setPosts] = useState()
  const [settings, setSettings] = useState()

  useEffect(() => { /* fetch user */ }, [])
  useEffect(() => { /* fetch posts */ }, [])
  useEffect(() => { /* fetch settings */ }, [])

  const handleLogin = () => { /* ... */ }
  const handleLogout = () => { /* ... */ }
  const handlePostCreate = () => { /* ... */ }
  const handleSettingsUpdate = () => { /* ... */ }

  return (
    <div>
      {/* 300+ lines of JSX */}
    </div>
  )
}
```

**Why It's Wrong**:
- Hard to test
- Difficult to maintain
- Impossible to reuse parts
- Violates Single Responsibility Principle
- Slow re-renders (everything re-renders on any state change)

**✅ Correct Approach**:
```tsx
function Dashboard() {
  return (
    <DashboardLayout>
      <UserProfile />
      <StatisticsPanel />
      <ActivityFeed />
      <SettingsPanel />
    </DashboardLayout>
  )
}

// Each component handles one responsibility
function UserProfile() {
  const [user, setUser] = useState()
  useEffect(() => { /* fetch user */ }, [])

  return (
    <div className="user-profile">
      {/* User-specific UI */}
    </div>
  )
}
```

**Rule**: Break large components into smaller, focused ones. Each component should have one clear responsibility.

---

### ⛔ Prop Drilling

**Anti-Pattern**:
```tsx
<App user={user}>
  <Layout user={user}>
    <Header user={user}>
      <UserMenu user={user} />
    </Header>
  </Layout>
</App>
```

**Why It's Wrong**:
- Components become tightly coupled
- Hard to refactor component tree
- Many components receive props they don't use
- Difficult to maintain

**✅ Correct Approach**:
```tsx
// Use Context
const UserContext = createContext()

function App() {
  const [user, setUser] = useState()

  return (
    <UserContext.Provider value={user}>
      <Layout>
        <Header>
          <UserMenu />
        </Header>
      </Layout>
    </UserContext.Provider>
  )
}

function UserMenu() {
  const user = useContext(UserContext)
  // Use user directly
}

// OR use state management (Zustand, Redux, etc.)
```

**Rule**: Use Context, state management, or composition to avoid prop drilling beyond 2-3 levels.

---

### ⛔ File-Based Router Wrapper Files

**Anti-Pattern**:
```tsx
// app/profile.tsx - Just re-exports from features
import ProfileScreen from '@/features/profile/ProfileScreen'
export default ProfileScreen

// OR even worse - wrapper component
export default function Profile() {
  return <ProfileScreen />
}
```

**Why It's Wrong**:
- Adds unnecessary indirection layer
- Extra file to maintain with no value
- Violates KISS principle
- File-based routing already provides the organization

**✅ Correct Approach**:
```tsx
// app/profile.tsx - Contains the actual screen implementation
export default function ProfileScreen() {
  const { data } = useProfile()

  return (
    <View>
      <ProfileHeader user={data} />
      <ProfileContent />
    </View>
  )
}
```

**Rule**: In file-based routing (Expo Router, Next.js App Router), put screen logic directly in route files. Don't create wrapper files that just import/re-export from `/features` or `/screens`.

---

## State Management Anti-Patterns

### ⛔ Unnecessary State

**Anti-Pattern**:
```tsx
function UserCard({ user }) {
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    setFullName(`${user.firstName} ${user.lastName}`)
  }, [user])

  return <div>{fullName}</div>
}
```

**Why It's Wrong**:
- Derived data stored in state
- Unnecessary re-renders
- State can get out of sync
- More complex to maintain

**✅ Correct Approach**:
```tsx
function UserCard({ user }) {
  // Compute on each render (cheap operation)
  const fullName = `${user.firstName} ${user.lastName}`

  return <div>{fullName}</div>
}

// OR with useMemo for expensive calculations
function UserCard({ user, complexData }) {
  const processedData = useMemo(() => {
    return expensiveCalculation(complexData)
  }, [complexData])

  return <div>{processedData}</div>
}
```

**Rule**: Don't store derived/computed data in state. Calculate on render or use `useMemo` for expensive operations.

---

### ⛔ State Mutations

**Anti-Pattern**:
```tsx
function TodoList() {
  const [todos, setTodos] = useState([])

  const addTodo = (text) => {
    todos.push({ id: Date.now(), text })  // Mutating state!
    setTodos(todos)
  }

  const updateTodo = (id, text) => {
    const todo = todos.find(t => t.id === id)
    todo.text = text  // Mutating state!
    setTodos(todos)
  }

  return <div>{/* ... */}</div>
}
```

**Why It's Wrong**:
- React won't detect the change
- Component won't re-render
- Breaks React's state update mechanism
- Causes bugs and inconsistent UI

**✅ Correct Approach**:
```tsx
function TodoList() {
  const [todos, setTodos] = useState([])

  const addTodo = (text) => {
    setTodos([...todos, { id: Date.now(), text }])
  }

  const updateTodo = (id, text) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text } : todo
    ))
  }

  return <div>{/* ... */}</div>
}
```

**Rule**: Never mutate state. Always create new objects/arrays when updating state.

---

## Performance Anti-Patterns

### ⛔ Unnecessary Re-renders

**Anti-Pattern**:
```tsx
function Parent() {
  const [count, setCount] = useState(0)

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <ExpensiveComponent data={heavyData} />  {/* Re-renders on every count change! */}
    </>
  )
}
```

**Why It's Wrong**:
- Wastes CPU cycles
- Causes UI lag
- Poor user experience
- Unnecessary component updates

**✅ Correct Approach**:
```tsx
function Parent() {
  const [count, setCount] = useState(0)

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <MemoizedExpensiveComponent data={heavyData} />
    </>
  )
}

const MemoizedExpensiveComponent = React.memo(ExpensiveComponent)

// OR split into separate components
function Parent() {
  return (
    <>
      <Counter />
      <ExpensiveComponent data={heavyData} />
    </>
  )
}

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**Rule**: Optimize re-renders with `React.memo`, `useMemo`, `useCallback`, or component splitting.

---

### ⛔ Inline Function Definitions

**Anti-Pattern**:
```tsx
function List({ items }) {
  return (
    <>
      {items.map(item => (
        <ExpensiveItem
          key={item.id}
          data={item}
          onClick={() => handleClick(item.id)}  // New function every render!
        />
      ))}
    </>
  )
}
```

**Why It's Wrong**:
- Creates new function on every render
- Causes child component re-renders
- Breaks memoization
- Performance impact with large lists

**✅ Correct Approach**:
```tsx
function List({ items }) {
  const handleClick = useCallback((id) => {
    // Handle click
  }, [])

  return (
    <>
      {items.map(item => (
        <ExpensiveItem
          key={item.id}
          data={item}
          onClick={handleClick}
          id={item.id}
        />
      ))}
    </>
  )
}

const ExpensiveItem = React.memo(({ data, onClick, id }) => {
  return <div onClick={() => onClick(id)}>{data.name}</div>
})
```

**Rule**: Use `useCallback` for functions passed to child components, especially in lists.

---

## Testing Anti-Patterns

### ⛔ Testing Implementation Details

**Anti-Pattern**:
```tsx
it('should update internal state correctly', () => {
  const wrapper = mount(<Counter />)
  wrapper.instance().setState({ count: 5 })
  expect(wrapper.state('count')).toBe(5)
})
```

**Why It's Wrong**:
- Tests break when refactoring (even if behavior unchanged)
- Doesn't test user-facing functionality
- Couples tests to implementation
- Provides false confidence

**✅ Correct Approach**:
```tsx
it('should increment counter when button clicked', () => {
  render(<Counter />)
  const button = screen.getByRole('button', { name: /increment/i })

  fireEvent.click(button)

  expect(screen.getByText(/count: 1/i)).toBeInTheDocument()
})
```

**Rule**: Test behavior and user interactions, not implementation details (state, methods, lifecycle).

---

### ⛔ Not Cleaning Up Mocks

**Anti-Pattern**:
```tsx
describe('API tests', () => {
  it('should fetch user data', () => {
    vi.mock('./api')
    // test code
  })

  it('should fetch post data', () => {
    // Previous mock still active! Can cause issues
  })
})
```

**Why It's Wrong**:
- Mocks leak between tests
- Tests become order-dependent
- Hard to debug failures
- Unpredictable test results

**✅ Correct Approach**:
```tsx
describe('API tests', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should fetch user data', () => {
    vi.mock('./api')
    // test code
  })

  it('should fetch post data', () => {
    // Clean slate
  })
})
```

**Rule**: Always clean up mocks in `afterEach` hooks.

---

## Hooks Anti-Patterns

### ⛔ Conditional Hooks

**Anti-Pattern**:
```tsx
function MyComponent({ shouldFetch }) {
  if (shouldFetch) {
    const data = useFetch('/api/data')  // Conditional hook!
  }

  return <div>{/* ... */}</div>
}
```

**Why It's Wrong**:
- Violates Rules of Hooks
- React expects hooks in same order every render
- Can cause bugs and crashes

**✅ Correct Approach**:
```tsx
function MyComponent({ shouldFetch }) {
  const data = useFetch(shouldFetch ? '/api/data' : null)

  return <div>{/* ... */}</div>
}

// OR
function MyComponent({ shouldFetch }) {
  if (!shouldFetch) {
    return <div>Not fetching</div>
  }

  return <FetchingComponent />
}

function FetchingComponent() {
  const data = useFetch('/api/data')  // Always called
  return <div>{/* ... */}</div>
}
```

**Rule**: Never call hooks conditionally. Hooks must be called in the same order every render.

---

### ⛔ Missing Dependencies in useEffect

**Anti-Pattern**:
```tsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [])  // Missing userId!

  return <div>{user?.name}</div>
}
```

**Why It's Wrong**:
- Effect doesn't re-run when dependencies change
- Stale data
- Bugs and inconsistent UI
- ESLint warnings (that should never be ignored)

**✅ Correct Approach**:
```tsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId])  // Include all dependencies

  return <div>{user?.name}</div>
}
```

**Rule**: Always include all dependencies in `useEffect`/`useCallback`/`useMemo` dependency arrays.

---

## Key Injection Anti-Patterns

### ⛔ Using Index as Key

**Anti-Pattern**:
```tsx
{items.map((item, index) => (
  <ListItem key={index} data={item} />
))}
```

**Why It's Wrong**:
- Causes incorrect re-renders when list changes
- State can get mixed up between items
- Poor performance
- Can cause bugs with deletions/reordering

**✅ Correct Approach**:
```tsx
{items.map(item => (
  <ListItem key={item.id} data={item} />
))}

// If no stable ID exists, generate one when data is created
const itemsWithId = rawItems.map(item => ({
  ...item,
  _id: crypto.randomUUID()  // or nanoid, etc.
}))
```

**Rule**: Always use stable, unique IDs as keys. Never use array index unless list is static and never reordered.

---

## Summary

**Key React & Frontend Anti-Patterns to Avoid**:

**Tailwind CSS**:
1. ⛔ Storing classes in constants → Inline always (except cva)
2. ⛔ Not using cn() → Mandatory when available
3. ⛔ Mixing inline styles → Use Tailwind utilities

**Component Architecture**:
4. ⛔ God components → Break into focused components
5. ⛔ Prop drilling → Use Context or state management

**State Management**:
6. ⛔ Unnecessary state → Compute derived data
7. ⛔ State mutations → Always create new objects/arrays

**Performance**:
8. ⛔ Unnecessary re-renders → Use memo/useMemo/useCallback
9. ⛔ Inline function definitions → Use useCallback

**Testing**:
10. ⛔ Testing implementation → Test behavior
11. ⛔ Not cleaning mocks → Use afterEach

**Hooks**:
12. ⛔ Conditional hooks → Always call in same order
13. ⛔ Missing dependencies → Include all dependencies

**Keys**:
14. ⛔ Index as key → Use stable unique IDs

**Remember**: React optimizes for predictable, declarative code. Follow these patterns for maintainable, performant applications.
