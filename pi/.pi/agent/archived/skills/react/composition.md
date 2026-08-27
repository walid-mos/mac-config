# Composition & SOLID in React

## Compose, Don't Configure

```tsx
// FORBIDDEN - god-component with prop explosion
function Card({ title, subtitle, icon, iconSize, iconColor, body,
  footer, footerAlign, variant, bordered, ... }) { ... }

// MANDATORY - composable building blocks
function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>
}
function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>
}

// Consumer decides structure
<Card>
  <CardHeader><Icon name="star" /><h2>Title</h2></CardHeader>
  <CardBody><p>Content</p></CardBody>
</Card>
```

## Children Over Config Props

```tsx
// FORBIDDEN
<Modal header="Confirm" body="Are you sure?" footer={<Button>OK</Button>} />

// MANDATORY
<Modal onClose={handleClose}>
  <ModalHeader>Confirm</ModalHeader>
  <ModalBody>Are you sure?</ModalBody>
  <ModalFooter><Button>OK</Button></ModalFooter>
</Modal>
```

## Composition Eliminates Prop Drilling

Compose at the top (pass `<Avatar>` through `children`) instead of threading data through intermediate layers. See [patterns.md](patterns.md) for the data-flow rules.

---

## SOLID Applied to React

### S - Single Responsibility: One Component = One Job

```tsx
// FORBIDDEN - fetches data AND renders list AND handles pagination
function UserDashboard() {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  useEffect(() => { fetch(`/api/users?page=${page}`).then(...) }, [page])
  return (
    <div>
      <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
      <button onClick={() => setPage(p => p + 1)}>Next</button>
    </div>
  )
}

// MANDATORY - separated concerns
function UserDashboard() {
  const { users, page, nextPage } = useUsers()
  return (
    <div>
      <UserList users={users} />
      <Pagination page={page} onNext={nextPage} />
    </div>
  )
}
```

**Imperative components are NOT exempt.** A canvas / WebGL / terminal / chart component that subscribes to an event source AND paints AND coordinates with a backend is doing THREE jobs — "it's imperative" is not a license to fuse them. Split along the same SRP line:

- **Pure render/measure logic** (no React) → a plain module (`fooRenderer.ts`).
- **The external-system glue** (subscriptions, observers, refs, the effects) → a custom hook (`useFoo`).
- **The component** → presentational shell: call the hook, return JSX.

```tsx
// FORBIDDEN - one component fuses Tauri subscription + canvas drawing + resize/backend coordination
function TerminalPane({ sessionId }) {
  const canvasRef = useRef(null)
  useEffect(() => { /* listen(...) + draw 6 lines */ }, [sessionId])
  useEffect(() => { /* ResizeObserver + 20 lines of sizing/redraw/propagate */ }, [sessionId])
  return <div><canvas ref={canvasRef} /></div>
}

// MANDATORY - renderer module (pure) + use* hook (glue) + presentational shell
const TerminalPane = ({ sessionId }) => {
  const { containerRef, canvasRef } = useTerminalCanvas(sessionId) // hook owns refs + effects
  return <div ref={containerRef}><canvas ref={canvasRef} /></div>
}
```

**Effects follow from this.** An effect body is **wiring + cleanup only**: subscribe/observe → delegate to a named handler → return teardown. A 20-line anonymous function inside `useEffect` is the smell. Extract the pure part to a module function (parameterized, so it stays stable per RULE 4.4) and leave only the thin reactive binding (which closes over props/refs) inside the effect.

### O - Open/Closed: Extend via composition

```tsx
// BAD - every variant requires modifying this component
function Button({ variant }: { variant: "primary" | "danger" | "ghost" }) { ... }

// GOOD - compose specialized buttons
function Button({ className, children, ...props }: ButtonProps) {
  return <button className={`btn ${className}`} {...props}>{children}</button>
}
function DangerButton(props: ButtonProps) {
  return <Button className="btn-danger" {...props} />
}
```

### I - Interface Segregation: Minimal props

```tsx
// FORBIDDEN - receives entire User but only uses name
function ListItem({ user }: { user: User }) { return <li>{user.name}</li> }

// MANDATORY - only what it needs
function ListItem({ name }: { name: string }) { return <li>{name}</li> }
```

### D - Dependency Inversion: Data via props, not hard-coupled fetches

```tsx
// BAD - hard-coupled to a specific fetch strategy
function UserProfile({ userId }: { userId: string }) {
  const user = useSWR(`/api/users/${userId}`, fetcher)
  // rendering + fetching coupled
}

// GOOD - pure rendering, data is the caller's concern
function UserProfile({ user }: { user: User }) { ... }
```