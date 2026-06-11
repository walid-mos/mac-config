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

**Presentational** - data/callbacks via props, zero business logic, zero fetching. Trivially testable.

**Container** - fetches data, manages state, passes results down. Integration-tested.

## The "5 Props" Signal

If a component has >5 props and growing, one of these is wrong:
- Does too much --> Split
- Needs composition --> Use `children`/slots
- Distant shared state --> Jotai atoms

## Keys on Lists

```tsx
// FORBIDDEN - index as key on dynamic list
items.map((item, i) => <Item key={i} {...item} />)

// MANDATORY - stable unique ID
items.map(item => <Item key={item.id} {...item} />)
```

Index as key ONLY for static lists that never reorder, filter, or mutate.

## RULE 6 Example - Render Components, Don't Call Them

```tsx
// FORBIDDEN - component called as a function; routing leaks into the shell
const renderMainContent = (pathname: string, projectPath: string | null): JSX.Element => {
  if (matchTasksRoute(pathname)) return <TasksView repoPath={projectPath} />
  return <PlanView />
}
function App() {
  return <section>{renderMainContent(usePathname(), projectPath)}</section>
}

// MANDATORY - real component owns its routing concern, mounted as JSX
function MainContent({ projectPath }: { projectPath: string | null }) {
  const pathname = usePathname()
  if (matchTasksRoute(pathname)) return <TasksView repoPath={projectPath} />
  return <PlanView />
}
function App() {
  return <section><MainContent projectPath={projectPath} /></section>
}
```

ALLOWED exception: a small pure function returning *child fragments*, consumed in ONE spot inside its owner's render (a `renderState` switch producing the `<li>` children of the owner's own element) - no props, no page-level dispatch, no new concern.

## RULE 7 Example - React 19 Refs Are Plain Props

```tsx
// FORBIDDEN - forwardRef shim in a React 19 codebase
const Input = forwardRef<HTMLInputElement, Props>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, className)} {...props} />
))

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

RHF compatibility: `register('email', ...)` returns `{ name, onChange, onBlur, ref }`; spreading it onto `<Input {...register('email')} />` passes the `ref` through as a plain prop - identical effect to a `forwardRef` wrapper, without the legacy shim.

## Context - Almost Never

Context has structural problems: **every consumer re-renders when the value changes** (no granular selection), it pushes toward god-contexts, and providers create rigid hierarchies.

**Jotai atoms are strictly superior** for shared state: granular re-renders, no provider needed, no hierarchy coupling.

**The only legitimate Context use case:** scoping state to a **sub-tree** - a `<ThemeProvider>` that wraps one section with a different theme, or a `<FormProvider>` that scopes form state. This is the one thing Jotai atoms (global by default) don't do natively.

For everything else (auth, locale, feature flags, shared state across distant components) - use Jotai atoms. See [jotai.md](jotai.md).
