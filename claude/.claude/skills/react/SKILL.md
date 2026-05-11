---
name: react
user-invocable: false
description: >-
  React best practices and strict component design rules. This skill MUST be
  loaded whenever writing or modifying React components (*.jsx, *.tsx files
  that import React or use JSX). Enforces composition over inheritance,
  SOLID principles, correct useEffect usage, derived state, component purity,
  and proper data flow. Must be used alongside the language-agnostic "coding"
  skill and the appropriate language skill (javascript or typescript).
---

# React Best Practices - Mandatory Rules

These rules apply to ALL React code you write or modify.

---

## RULE 0 - COMPOSITION IS EVERYTHING (HIGHEST PRIORITY)

This is the single most important rule in React. **Composition over inheritance. Composition over configuration. Composition over prop drilling.**

React's power comes from composing small, focused pieces. Every time you reach for inheritance, a god-component, or a prop explosion - you're fighting the framework.

- Use `children` and render slots, NOT config props
- Reduce prop drilling with composition BEFORE reaching for Jotai or Context
- Class inheritance for components is FORBIDDEN - always compose
- SOLID principles apply to components - see [composition.md](composition.md) for rules and examples

---

## RULE 1 - YOU DO NOT NEED useEffect (Most of the Time)

Effects are an **escape hatch** to synchronize with **external systems** (browser APIs, third-party widgets, network subscriptions). If there's no external system, you almost certainly don't need an Effect.

**The decision rule - ask: "Why does this code run?"**
- User interaction happened --> **Event handler**
- Component displayed --> **Effect** (maybe)
- Computed value from state/props --> **Calculate during render**

All cases with FORBIDDEN/MANDATORY examples in [effects.md](effects.md).

**When Effects ARE correct:** subscribing to external events (WebSocket, ResizeObserver), synchronizing with non-React DOM widgets, fetching data on mount (with cleanup). Always provide a cleanup function.

---

## RULE 2 - COMPONENT PURITY

React assumes every component is a **pure function**: same props + state + context = same JSX.

**During render, FORBIDDEN:** mutating external variables, mutating props, mutating state directly, direct DOM manipulation, side effects (network, timers, logging).

**During render, ALLOWED:** local mutation (creating and mutating objects within the same render).

```tsx
// ALLOWED - new array, not mutating props
const sorted = [...todos].sort((a, b) => a.date - b.date)

// FORBIDDEN - mutates the input
todos.sort((a, b) => a.date - b.date)
```

---

## RULE 3 - STATE DESIGN

For each piece of data, if ANY is true it's NOT state:
1. Unchanged over time --> Constant
2. Passed from parent --> Prop
3. Computable from existing state/props --> **Derived value** (compute during render)

Full state-management rules (minimal state, immutable updates, reducers, controlled vs uncontrolled, when to reach for Jotai) live in [`## State management`](#state-management) below.

---

## RULE 4 - HOOKS DISCIPLINE

- Only call hooks at the **top level** - never inside loops, conditions, or nested functions
- **Never suppress `exhaustive-deps` linter** - fix the code, not the linter
- Lifecycle wrappers (`useMount`, `useEffectOnce`) are FORBIDDEN
- Custom hooks share **stateful logic**, not state - each call gets independent state

Full rules and dependency removal checklist in [`## Hooks`](#hooks) below.

---

## RULE 5 - COMPONENT DESIGN AND DATA FLOW

- Data flows **down** via props. Events flow **up** via callbacks. Non-negotiable.
- >5 props and growing = split the component or use composition
- Lists must have **stable, unique keys** (no index on dynamic lists)
- **Jotai atoms** for shared state across distant components - see [jotai.md](jotai.md)
- Context is almost never needed - only for sub-tree scoping (e.g. theme section). Jotai is preferred for everything else.

Full patterns in [patterns.md](patterns.md).

---

## State management

### Minimal state - if derivable, not state

For each piece of data, if ANY is true it's NOT state:
1. Unchanged over time --> Constant
2. Passed from parent --> Prop
3. Computable from state/props --> Derived value

```tsx
// FORBIDDEN - redundant state
const [items, setItems] = useState<Item[]>([])
const [itemCount, setItemCount] = useState(0)
const [hasItems, setHasItems] = useState(false)
const [selectedItem, setSelectedItem] = useState<Item | null>(null)

// MANDATORY - single source of truth
const [items, setItems] = useState<Item[]>([])
const [selectedId, setSelectedId] = useState<string | null>(null)

const itemCount = items.length
const hasItems = items.length > 0
const selectedItem = items.find(i => i.id === selectedId) ?? null
```

### Immutable updates - always

```tsx
// FORBIDDEN - mutates state
items.push(item)
setItems(items) // same reference, React skips re-render

// MANDATORY
setItems([...items, item])

// FORBIDDEN - mutates nested state
const user = users.find(u => u.id === id)
user.name = newName
setUsers([...users])

// MANDATORY
setUsers(users.map(u => u.id === id ? { ...u, name: newName } : u))
```

### Group related state

```tsx
// AVOID
const [x, setX] = useState(0)
const [y, setY] = useState(0)

// PREFERRED
const [position, setPosition] = useState({ x: 0, y: 0 })
```

### Controlled > uncontrolled

When the parent needs to coordinate behavior, make the component fully controlled (state + setter from parent). Uncontrolled is fine for leaf UI that no parent cares about.

### Reducers for complex state

Use `useReducer` when state updates span multiple fields across multiple handlers. Actions describe **what the user did**:

```tsx
// GOOD
dispatch({ type: "item_added", item })
dispatch({ type: "filter_changed", filter })

// BAD - actions are just setters
dispatch({ type: "SET_ITEMS", payload: newItems })
```

Reducer rules:
- Must be pure - no side effects
- One action = one user interaction
- Default case must throw: `default: throw new Error(\`Unknown action: ${action.type}\`)`

### When to use what

This is the single authoritative decision table for state management:

| Need | Use |
|---|---|
| Local UI state (toggle, form input) | `useState` |
| Complex local state (multi-field, many handlers) | `useReducer` |
| Cross-cutting concerns (theme, auth, locale) | Context |
| Shared state across distant components | **Jotai atoms** - see [jotai.md](jotai.md) |
| Server state (fetch, cache, sync, invalidation) | A server-state library (React Query / SWR / RSC) - never `useState` + `useEffect` |

State lives in the **closest common parent** when using `useState`/`useReducer`. Jotai atoms are the escape hatch when lifting would require drilling through too many layers.

---

## Hooks

### Rules of hooks (non-negotiable)

1. Only call hooks at the **top level** - never inside loops, conditions, or nested functions
2. Only call hooks from React function components or custom hooks

### Never suppress exhaustive-deps

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

### Dependency removal checklist

When an Effect has too many dependencies, work through this in order:

1. **Should it be an event handler?** Move to handler
2. **Does it do multiple unrelated things?** Split into separate Effects
3. **Updating state based on previous state?** Use updater: `setCount(c => c + 1)` (removes `count` from deps)
4. **Object/function dep changes every render?** Move creation inside the Effect, or destructure props to primitives
5. **Need to read a value without reacting to it?** Use `useEffectEvent`

### Custom hooks

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

### Lifecycle wrappers - FORBIDDEN

```tsx
// FORBIDDEN - all of these
function useMount(fn: () => void) { useEffect(fn, []) }
function useEffectOnce(fn: () => void) { useEffect(fn, []) }
function useUpdateEffect(fn, deps) { /* skip first render */ }
```

These mimic class lifecycle methods, bypass dependency linting, and prevent proper synchronization. Do not create them, do not use them.

---

## Quick Reference - Forbidden vs Mandatory

| Pattern | Verdict | Instead |
|---|---|---|
| Computed value stored in state | FORBIDDEN | Compute during render |
| `useEffect` to sync derived state | FORBIDDEN | Inline or `useMemo` |
| `useEffect` to respond to user action | FORBIDDEN | Event handler |
| `useEffect` to notify parent | FORBIDDEN | Callback in event handler |
| Chain of Effects triggering each other | FORBIDDEN | Consolidate in handler |
| Reset state via `useEffect` on prop change | FORBIDDEN | `key` prop to remount |
| `useMount` / `useEffectOnce` wrappers | FORBIDDEN | Proper `useEffect` with deps |
| Suppressing `exhaustive-deps` | FORBIDDEN | Fix the code |
| Mutating props or state directly | FORBIDDEN | New references |
| Class inheritance for components | FORBIDDEN | Composition |
| God-components with config props | FORBIDDEN | `children` / slots |
| Index as key on dynamic lists | FORBIDDEN | Stable unique IDs |
| Context for shared state | AVOID | Jotai atoms |
| Context for local state | AVOID | Props, children, lift state |
| Prop drilling through 3+ layers | AVOID | Compose with children, then Jotai |
