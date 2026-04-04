# Jotai — Preferred State Management

Jotai is the preferred solution for shared state beyond simple prop passing. Use it whenever state needs to be shared across distant components.

## Mental Model

**Atoms are configs, not containers.** `atom()` creates an immutable blueprint. Values live in a store (internally a WeakMap). Atoms are identified by **referential equality**, not string keys.

**Bottom-up.** Build state from small independent atoms composed upward. Each atom triggers re-renders **only** in components that subscribe to it.

**Dependencies are automatic.** When a derived atom's `read` calls `get(otherAtom)`, Jotai registers the dependency.

## When to Use What

- Local UI state (toggle, form input) --> `useState`
- Complex local state (multi-field, many handlers) --> `useReducer`
- Sub-tree scoped state (form, theme section) --> Context (rare)
- Shared state across distant components --> **Jotai atoms**

---

## Atom Types

### Primitive — independent leaf state
```tsx
const countAtom = atom(0)
const nameAtom = atom("hello")
```

### Derived (read-only) — computed from other atoms
```tsx
const doubledAtom = atom((get) => get(countAtom) * 2)
```

### Action (write-only) — encapsulate mutations
```tsx
const incrementAtom = atom(null, (_get, set) => {
  set(countAtom, (prev) => prev + 1)
})
```

Prefer **separate action atoms** over a single reducer with switch. Better code splitting, clearer intent.

### Read-Write — bidirectional derived state
```tsx
const celsiusAtom = atom(0)
const fahrenheitAtom = atom(
  (get) => get(celsiusAtom) * 1.8 + 32,
  (_get, set, newF: number) => set(celsiusAtom, (newF - 32) / 1.8),
)
```

---

## Encapsulation — Hide Base Atoms

```tsx
// NOT exported — internal
const baseAtom = atom(0)

// Exported — controlled interface
export const countAtom = atom((get) => get(baseAtom))
export const incAtom = atom(null, (_get, set) => set(baseAtom, (p) => p + 1))
export const decAtom = atom(null, (_get, set) => set(baseAtom, (p) => p - 1))
```

Consumers cannot mutate base state directly. This is the Jotai equivalent of a module boundary.

---

## Performance Rules

### Use `useSetAtom` for write-only components

```tsx
// BAD — subscribes to reads, re-renders on every change
const [, setValue] = useAtom(valueAtom)

// GOOD — no subscription, no re-render
const setValue = useSetAtom(valueAtom)
```

### Use `useAtomValue` for read-only components

```tsx
const count = useAtomValue(countAtom)
```

### Keep atoms granular

Prefer multiple small atoms over one big object atom. Each change only re-renders subscribers of that specific atom.

### `selectAtom` for sub-object subscription

```tsx
import { selectAtom } from "jotai/utils"

const nameAtom = selectAtom(personAtom, (person) => person.name)
```

Only re-renders when the selected slice changes. Use `deepEqual` as third arg when the parent is frequently replaced with structurally identical copies.

### `splitAtom` for list optimization

```tsx
import { splitAtom } from "jotai/utils"

const todosAtom = atom(initialTodos)
const todoAtomsAtom = splitAtom(todosAtom)
```

Editing one item only re-renders that item's component.

### When NOT to optimize

If all properties change together frequently, `selectAtom`/`focusAtom` adds overhead for nothing. Keep the monolithic atom.

---

## Async Atoms

```tsx
const userAtom = atom(async (get, { signal }) => {
  const res = await fetch(`/api/users/${get(userIdAtom)}`, { signal })
  return res.json()
})
```

- Async atoms **suspend** by default — needs `<Suspense>` boundary
- Use `signal` for automatic cancellation of stale requests
- Use `loadable()` to avoid Suspense: returns `{ state, data?, error? }`
- Use `unwrap()` for sync fallback with "show stale while loading"

---

## Persistence

```tsx
import { atomWithStorage } from "jotai/utils"

const themeAtom = atomWithStorage("theme", "light")
```

Cross-tab sync is built in. Supports `localStorage`, `sessionStorage`, custom storage.

---

## TypeScript

- **Let types be inferred** — `atom(0)` infers `PrimitiveAtom<number>`
- **Annotate write params explicitly** when inference is insufficient
- **Explicit type when nullable:** `atom<number | null>(null)`
- **Functions in atoms must be wrapped:** `atom({ callback: (n: number) => n * 2 })` (Jotai can't distinguish stored functions from getters)
- Requires `strictNullChecks: true`

---

## FORBIDDEN Patterns

| Pattern | Problem | Instead |
|---|---|---|
| `useAtom(atom(0))` inside render | New atom every render, infinite loop | Define outside or `useMemo` |
| `const [, set] = useAtom(x)` | Subscribes to reads unnecessarily | `useSetAtom(x)` |
| One component reading 5+ unrelated atoms | Re-renders on any change | Split into focused sub-components |
| Heavy computation in derived read | Recomputes on every dep change | Compute in action atom, store result |
| Forgetting `atomFamily` cleanup | Memory leak — cached params persist | Call `.remove(param)` |
| `set()` on `atomWithDefault` then expecting dep updates | Getter stops running after override | Call `RESET` to restore computed behavior |

---

## Testing

```tsx
import { Provider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"

function TestProvider({ initialValues, children }) {
  return (
    <Provider>
      <HydrateAtoms initialValues={initialValues}>{children}</HydrateAtoms>
    </Provider>
  )
}

// In test
render(
  <TestProvider initialValues={[[countAtom, 100]]}>
    <Counter />
  </TestProvider>
)
```

Always wrap in `<Provider>` in tests for isolated state. Use `useHydrateAtoms` to inject initial values.

## Debugging

- `countAtom.debugLabel = "count"` — use SWC plugin `@swc-jotai/debug-label` to auto-label
- `useAtomsDevtools()` for Redux DevTools integration (values, deps, time-travel)
- `freezeAtom()` in dev to catch accidental mutations via `Object.freeze`
