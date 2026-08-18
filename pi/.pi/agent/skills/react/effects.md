# You Don't Need useEffect - All Cases

## Case 1: Derived State

```tsx
// FORBIDDEN - redundant state + useless Effect
const [fullName, setFullName] = useState("")
useEffect(() => { setFullName(`${firstName} ${lastName}`) }, [firstName, lastName])

// MANDATORY - compute during render
const fullName = `${firstName} ${lastName}`
```

```tsx
// FORBIDDEN - filtering in Effect
const [filtered, setFiltered] = useState([])
useEffect(() => { setFiltered(items.filter(i => i.matches(query))) }, [items, query])

// MANDATORY - compute inline, memoize if >1ms
const filtered = useMemo(() => items.filter(i => i.matches(query)), [items, query])
```

## Case 2: Reset State on Prop Change - Use `key`

```tsx
// FORBIDDEN
function CommentForm({ postId }: { postId: string }) {
  const [text, setText] = useState("")
  useEffect(() => { setText("") }, [postId])
}

// MANDATORY - key forces remount
<CommentForm key={postId} postId={postId} />
```

## Case 3: Adjust State on Prop Change - Derive Instead

```tsx
// FORBIDDEN
const [selection, setSelection] = useState<Item | null>(null)
useEffect(() => { setSelection(null) }, [items])

// MANDATORY - store ID, derive object
const [selectedId, setSelectedId] = useState<string | null>(null)
const selection = items.find(i => i.id === selectedId) ?? null
```

## Case 4: Event Logic - Use Event Handlers

```tsx
// FORBIDDEN - responding to a user action via Effect
const [submitted, setSubmitted] = useState(false)
useEffect(() => {
  if (submitted) { post("/api/form", formData); setSubmitted(false) }
}, [submitted, formData])

// MANDATORY
function handleSubmit() { post("/api/form", formData) }
```

## Case 5: Notify Parent - Call in Handler

```tsx
// FORBIDDEN
useEffect(() => { onChange(isOn) }, [isOn, onChange])

// MANDATORY
function handleToggle() {
  const next = !isOn
  setIsOn(next)
  onChange(next)
}

// BEST - fully controlled
function Toggle({ isOn, onChange }: { isOn: boolean; onChange: (v: boolean) => void }) {
  return <button onClick={() => onChange(!isOn)}>{isOn ? "ON" : "OFF"}</button>
}
```

## Case 6: Effect Chains - Consolidate

```tsx
// FORBIDDEN - cascading Effects
useEffect(() => { if (card?.gold) setGoldCount(c => c + 1) }, [card])
useEffect(() => { if (goldCount > 3) { setRound(r => r + 1); setGoldCount(0) } }, [goldCount])

// MANDATORY - all state transitions in the event handler
const isGameOver = round > 5 // derived

function handlePlayCard(nextCard: Card) {
  setCard(nextCard)
  if (nextCard.gold) {
    if (goldCount < 3) { setGoldCount(goldCount + 1) }
    else { setGoldCount(0); setRound(round + 1) }
  }
}
```

## Case 7: Data Passed to Parent - Fetch in Parent

```tsx
// FORBIDDEN - child fetches and pushes up
function Child({ onData }: { onData: (d: Data) => void }) {
  useEffect(() => { fetchData().then(d => onData(d)) }, [onData])
}

// MANDATORY - parent owns fetch, passes data down
function Parent() {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => { fetchData().then(setData) }, [])
  return <Child data={data} />
}
```

---

## Dependency-Removal Checklist

When an Effect has too many dependencies (or `exhaustive-deps` warns), work through this in order - never suppress the rule:

1. **Should it be an event handler?** Move to handler
2. **Does it do multiple unrelated things?** Split into separate Effects
3. **Updating state based on previous state?** Use updater: `setCount(c => c + 1)` (removes `count` from deps)
4. **Object/function dep changes every render?** Move creation inside the Effect, or destructure props to primitives
5. **Need to read a value without reacting to it?** Use `useEffectEvent`

---

## When Effects ARE Correct

- Subscribing to external events (WebSocket, ResizeObserver, IntersectionObserver)
- Synchronizing with non-React DOM (maps, charts, video players)
- Fetching data on mount/dep change - **always with cleanup**:

```tsx
useEffect(() => {
  const controller = new AbortController()
  fetchData(url, { signal: controller.signal }).then(setData)
  return () => controller.abort()
}, [url])
```