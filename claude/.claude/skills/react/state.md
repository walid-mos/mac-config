# State Design

## Minimal State — If Derivable, Not State

For each piece of data, if ANY is true it's NOT state:
1. Unchanged over time --> Constant
2. Passed from parent --> Prop
3. Computable from state/props --> Derived value

```tsx
// FORBIDDEN — redundant state
const [items, setItems] = useState<Item[]>([])
const [itemCount, setItemCount] = useState(0)
const [hasItems, setHasItems] = useState(false)
const [selectedItem, setSelectedItem] = useState<Item | null>(null)

// MANDATORY — single source of truth
const [items, setItems] = useState<Item[]>([])
const [selectedId, setSelectedId] = useState<string | null>(null)

const itemCount = items.length
const hasItems = items.length > 0
const selectedItem = items.find(i => i.id === selectedId) ?? null
```

## Immutable Updates — Always

```tsx
// FORBIDDEN — mutates state
items.push(item)
setItems(items) // same reference, React skips re-render

// MANDATORY
setItems([...items, item])

// FORBIDDEN — mutates nested state
const user = users.find(u => u.id === id)
user.name = newName
setUsers([...users])

// MANDATORY
setUsers(users.map(u => u.id === id ? { ...u, name: newName } : u))
```

## Group Related State

```tsx
// AVOID
const [x, setX] = useState(0)
const [y, setY] = useState(0)

// PREFERRED
const [position, setPosition] = useState({ x: 0, y: 0 })
```

## Controlled > Uncontrolled

When the parent needs to coordinate behavior, make the component fully controlled (state + setter from parent). Uncontrolled is fine for leaf UI that no parent cares about.

## Reducers for Complex State

Use `useReducer` when state updates span multiple fields across multiple handlers. Actions describe **what the user did**:

```tsx
// GOOD
dispatch({ type: "item_added", item })
dispatch({ type: "filter_changed", filter })

// BAD — actions are just setters
dispatch({ type: "SET_ITEMS", payload: newItems })
```

Reducer rules:
- Must be pure — no side effects
- One action = one user interaction
- Default case must throw: `default: throw new Error(`Unknown action: ${action.type}`)`

## State Management — Jotai is Preferred

For state that needs to be shared across distant components (beyond simple lifting), **Jotai** with atoms is the preferred solution. See [jotai.md](jotai.md) for patterns and best practices.

**When to use what:**
- Local UI state (toggle, form input) --> `useState`
- Complex local state (multi-field, many handlers) --> `useReducer`
- Cross-cutting concerns (theme, auth, locale) --> Context
- Shared state across distant components --> **Jotai atoms**

State lives in the **closest common parent** when using `useState`/`useReducer`. Jotai atoms are the escape hatch when lifting would require drilling through too many layers.
