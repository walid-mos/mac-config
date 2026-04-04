# Component Patterns & Data Flow

## Data Flow is Top-Down

Data flows **down** via props. Events flow **up** via callbacks. Non-negotiable.

**FORBIDDEN patterns:**
- Child fetches data and pushes it up to parent via callback-in-Effect
- Sibling-to-sibling communication via shared refs or global mutable state
- Imperatively calling methods on child refs (except DOM focus/scroll)

**Correct patterns:**
- Parent owns data, passes down
- Parent passes event handlers, child calls them
- Shared state in closest common parent
- Distant shared state via Jotai atoms (see [jotai.md](jotai.md))

## Presentational vs Container

**Presentational** — data/callbacks via props, zero business logic, zero fetching. Trivially testable.

**Container** — fetches data, manages state, passes results down. Integration-tested.

## The "5 Props" Signal

If a component has >5 props and growing, one of these is wrong:
- Does too much --> Split
- Needs composition --> Use `children`/slots
- Distant shared state --> Jotai atoms

## Keys on Lists

```tsx
// FORBIDDEN — index as key on dynamic list
items.map((item, i) => <Item key={i} {...item} />)

// MANDATORY — stable unique ID
items.map(item => <Item key={item.id} {...item} />)
```

Index as key ONLY for static lists that never reorder, filter, or mutate.

## Memoization — When It Matters

**Don't prematurely memoize.** Only memoize when:
- Child is wrapped in `React.memo`
- Value is a hook dependency
- Computation is genuinely expensive (>1ms)

```tsx
// AVOID — new object every render breaks memoized children
<Map center={{ lat: 0, lng: 0 }} />

// PREFERRED — stable reference when child is React.memo'd
const center = useMemo(() => ({ lat: 0, lng: 0 }), [])
```

## Context — Almost Never

Context has structural problems: **every consumer re-renders when the value changes** (no granular selection), it pushes toward god-contexts, and providers create rigid hierarchies.

**Jotai atoms are strictly superior** for shared state: granular re-renders, no provider needed, no hierarchy coupling.

**The only legitimate Context use case:** scoping state to a **sub-tree** — a `<ThemeProvider>` that wraps one section with a different theme, or a `<FormProvider>` that scopes form state. This is the one thing Jotai atoms (global by default) don't do natively.

For everything else (auth, locale, feature flags, shared state across distant components) — use Jotai atoms. See [jotai.md](jotai.md).
