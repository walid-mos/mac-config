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

> **Ce skill EST la doctrine.** Charge-le directement (avec `coding` + `javascript`/`typescript`) **avant** d'écrire du React — pas via un agent dédié. L'enforcement est garanti par le hook `react-ts-gate` qui s'exécute à chaque Write/Edit d'un `.ts(x)/.js(x)` : il bloque `any`/`as` et alerte sur `useEffect` + taille de fichier. Si tu délègues du React à un subagent, son prompt doit lui faire charger ces skills en premier.

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

## RULE 6 - RENDER COMPONENTS, DON'T CALL THEM

If a function takes props-like inputs **or** returns whole component / view / page subtrees, it **is** a component. Give it a `PascalCase` name, put it in its own scope, and mount it as `<Name ... />`. **Never invoke it as a plain function** (`renderName(...)`).

Calling a component as a function inlines its output into the **caller's** fiber: no own identity, no own hooks, no reconciliation or memo boundary, invisible as a node in DevTools, and any state/effects it "owns" silently become the caller's. When that function also *selects which view to show* (a route/page dispatcher) and is called from a layout shell, it drags the routing concern into the shell — an SRP violation (RULE 0 / S). The shell must not know the route table.

**Where the line is** (so this is never rationalized away):

- **Inline fragment-helper — ALLOWED.** A small pure function returning *child fragments* consumed in ONE spot inside its owner's render (e.g. a `renderState` switch producing the `<p>`/`<li>` children of the owner's own element). It takes no props, dispatches no page-level components, and pulls no new concern into the host.
- **Disguised component — FORBIDDEN.** A function that takes props, and/or returns page/view-level components chosen by a condition. Extract it into a real named component and mount it as JSX.

```tsx
// FORBIDDEN - component called as a function; the routing concern leaks into the shell
const renderMainContent = (
  pathname: string,
  projectPath: string | null,
): JSX.Element => {
  if (matchTasksRoute(pathname)) return <TasksView repoPath={projectPath} />
  return <PlanView />
}
function App() {
  const pathname = usePathname()
  return <section>{renderMainContent(pathname, projectPath)}</section>
}

// MANDATORY - real component owns its own routing concern, mounted as JSX
function MainContent({ projectPath }: { projectPath: string | null }) {
  const pathname = usePathname()
  if (matchTasksRoute(pathname)) return <TasksView repoPath={projectPath} />
  return <PlanView />
}
function App() {
  return <section><MainContent projectPath={projectPath} /></section>
}
```

---

## RULE 7 - REACT 19 REFS ARE PLAIN PROPS (NO forwardRef)

In React 19, `ref` is a **regular prop**. `forwardRef` is deprecated legacy boilerplate - do NOT wrap components in it, even when forwarding a ref to a DOM node (e.g. a styled `<input>` / `<button>` primitive).

Type the props with `ComponentPropsWithRef<'element'>` and spread `{...props}` straight onto the native element - `ref` flows through unchanged.

```tsx
// FORBIDDEN - forwardRef shim in a React 19 codebase
const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, className)} {...props} />
  ),
)

// MANDATORY - ref is just a prop, spread it
type Props = ComponentPropsWithRef<'input'> & { invalid?: boolean }

export const Input = ({ invalid = false, className, ...props }: Props): JSX.Element => (
  <input
    aria-invalid={invalid}
    className={cn(base, invalid && 'border-red-600/50', className)}
    {...props}
  />
)
```

**Why this is the RHF-compatible form:** `react-hook-form`'s `register('email', …)` returns `{ name, onChange, onBlur, ref }`. Spreading it onto `<Input {...register('email')} />` passes the `ref` through as a plain prop - identical effect to a `forwardRef` wrapper, without the legacy shim. This is also consistent with the greenfield rule: no back-compat scaffolding the runtime no longer needs.

---

## RULE 8 - ONE COMPONENT PER FILE

Each component lives in **its own file**, named after the component (`UserCard.tsx` exports `UserCard`). One file = one public component. This keeps imports obvious, diffs surgical, and each component independently testable and movable.

**The only exception:** a **truly tiny, private** sub-component used by **exactly one** component, **co-located in that same file**, never exported, never reused elsewhere. A 3-line presentational helper (a `<StatusDot />`, a single list-row) sitting next to its sole consumer is fine. The moment it grows state/effects, gains a second caller, or wants its own test → extract it to its own file.

- **FORBIDDEN:** two exported components in one file; a grab-bag file (`components.tsx` exporting five unrelated components); a sub-component large enough to own state / effects / a real props surface kept inline "for convenience".
- **MANDATORY:** one exported component per file. A private mini-helper stays inline only when it is tiny **and** single-use **and** unexported.

```tsx
// FORBIDDEN - two real components sharing a file
export function UserCard({ user }: { user: User }) { /* ... */ }
export function UserList({ users }: { users: User[] }) { /* ... */ } // → UserList.tsx

// ALLOWED - tiny, private, single-use helper co-located with its only consumer
function StatusDot({ online }: { online: boolean }): JSX.Element {
  return <span className={online ? 'bg-green-500' : 'bg-gray-400'} />
}

export function UserCard({ user }: { user: User }): JSX.Element {
  return (
    <article>
      <StatusDot online={user.online} /> {user.name}
    </article>
  )
}
```

---

## RULE 9 - DON'T REPEAT UI, KEEP COMPONENTS SHALLOW & TESTED

- **DRY for React.** Repeated markup or logic = extract. Duplicated JSX -> a component; duplicated stateful logic -> a custom hook (shares logic, not state - RULE 4). Rule of three: the third copy MUST be extracted; don't abstract on the first (you don't know the shape yet).
- **Shallow JSX.** Keep render trees flat: JSX nested >3 levels, or a component past ~150 lines, means extract a child component. Prefer fragments over wrapper `<div>`s.
- **Test behaviour, not internals.** Test components as a user does (React Testing Library: query by role/text, fire events, assert visible output). Never assert internal state, hook call order, or snapshot a tree you don't understand. Load the `test` skill (+ `vitest`) for component tests; `tdd` to drive them first.
- **Memoize only when measured.** `useMemo` / `useCallback` / `React.memo` are for proven hot paths or to stabilize a dependency/ref - not a default. Compute during render first (RULE 1/3); reach for memo when a profile says so.

---

## State management

### Minimal state - if derivable, not state

If a value is a constant, a prop, or computable from state/props, it is **not state** - compute it during render (RULE 3). Never mirror a derived value (`itemCount`, `hasItems`, `selectedItem`) into its own `useState`; derive it: `const selectedItem = items.find(i => i.id === selectedId) ?? null`.

### Immutable updates - always

Never mutate state; create new references: `setItems([...items, item])`, `setUsers(users.map(u => u.id === id ? { ...u, name: newName } : u))`. In-place `push`/`splice`/field assignment keeps the same reference and React skips the re-render. Full rule: `coding` RULE 7.

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
| Sub-tree scoping only (a themed section, a scoped form) | Context |
| Cross-cutting + shared state across distant components (auth, locale, flags) | **Jotai atoms** - see [jotai.md](jotai.md) |
| Server state (fetch, cache, sync, invalidation) | A server-state library (React Query / SWR / RSC) - never `useState` + `useEffect` |

State lives in the **closest common parent** when using `useState`/`useReducer`. Jotai atoms are the escape hatch when lifting would require drilling through too many layers.

---

## Hooks

### Rules of hooks (non-negotiable)

1. Only call hooks at the **top level** - never inside loops, conditions, or nested functions
2. Only call hooks from React function components or custom hooks

### Never suppress exhaustive-deps

Never add `// eslint-disable react-hooks/exhaustive-deps`. A linter complaint means a design problem - fix it via the dependency-removal checklist below, not by silencing the rule.

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
| `forwardRef` wrapper in a React 19 codebase | FORBIDDEN | `ref` is a plain prop - type with `ComponentPropsWithRef` and spread `{...props}` (RULE 7) |
| God-components with config props | FORBIDDEN | `children` / slots |
| Component-shaped function called as `renderThing(props)` instead of `<Thing/>` | FORBIDDEN | Extract & mount as JSX; route dispatch → own component (RULE 6) |
| Multiple exported components in one file / grab-bag `components.tsx` | FORBIDDEN | One component per file; only a tiny private single-use helper may co-locate (RULE 8) |
| Imperative component fusing subscription + render + backend coordination | FORBIDDEN | Renderer module + `use*` hook + presentational shell (composition.md S) |
| Effect body with inline logic beyond wiring + cleanup | FORBIDDEN | Extract pure logic to a module fn (RULE 4.4); keep the effect thin |
| Index as key on dynamic lists | FORBIDDEN | Stable unique IDs |
| Duplicated JSX / stateful logic (3rd copy) | FORBIDDEN | Extract a component / custom hook (RULE 9) |
| JSX nested >3 levels or component >150 lines | FORBIDDEN | Extract child components (RULE 9) |
| Asserting internal state / hook order / blind snapshots | FORBIDDEN | Test visible behaviour via RTL (RULE 9) |
| `useMemo`/`useCallback`/`memo` by default | AVOID | Memoize only proven hot paths / dep stability (RULE 9) |
| Context for shared state | AVOID | Jotai atoms |
| Context for local state | AVOID | Props, children, lift state |
| Prop drilling through 3+ layers | AVOID | Compose with children, then Jotai |
