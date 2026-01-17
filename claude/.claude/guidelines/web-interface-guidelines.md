---
triggers:
  project: ["react", "next", "vue", "solid", "astro"]
description: Web interface best practices for accessibility, UX, and performance
---

# Web Interface Guidelines

Comprehensive rules for building accessible, performant, and user-friendly web interfaces.

---

## Accessibility

### Semantic HTML

```tsx
// BAD - div soup
<div onClick={handleClick}>Click me</div>
<div className="heading">Title</div>

// GOOD - Semantic elements
<button onClick={handleClick}>Click me</button>
<h2>Title</h2>
```

### ARIA Labels

```tsx
// Icon-only buttons MUST have aria-label
<button aria-label="Close dialog" onClick={onClose}>
  <XIcon />
</button>

// Links with icons
<a href="/settings" aria-label="Account settings">
  <SettingsIcon />
</a>

// Form inputs
<input
  type="search"
  aria-label="Search products"
  placeholder="Search..."
/>
```

### Keyboard Navigation

```tsx
// Interactive elements MUST be keyboard accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }}
>
  Custom Button
</div>

// Better: just use a button
<button onClick={handleClick}>Custom Button</button>
```

### Screen Reader Content

```tsx
// Visually hidden but accessible
<span className="sr-only">Currently selected:</span>
<span>{selectedItem.name}</span>

// CSS for sr-only
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

---

## Focus States

### Never Remove Outlines Without Replacement

```css
/* BAD - Removes accessibility */
button:focus {
  outline: none;
}

/* GOOD - Custom focus style */
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* GOOD - Tailwind */
className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Use focus-visible Over focus

```css
/* BAD - Shows focus ring on mouse click */
button:focus {
  ring: 2px;
}

/* GOOD - Only keyboard focus */
button:focus-visible {
  ring: 2px;
}
```

### Focus Trap in Modals

```tsx
// Modals MUST trap focus
import { FocusTrap } from '@headlessui/react'

<Dialog open={isOpen}>
  <FocusTrap>
    <DialogContent>
      {/* Focus stays within modal */}
    </DialogContent>
  </FocusTrap>
</Dialog>
```

---

## Forms

### Input Attributes

```tsx
// Email input
<input
  type="email"
  autoComplete="email"
  inputMode="email"
  autoCapitalize="none"
/>

// Phone input
<input
  type="tel"
  autoComplete="tel"
  inputMode="tel"
/>

// Search input
<input
  type="search"
  inputMode="search"
  enterKeyHint="search"
/>

// Numeric input (NOT type="number" for codes)
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  autoComplete="one-time-code"
/>
```

### Labels and Descriptions

```tsx
// ALWAYS associate labels
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-describedby="email-hint" />
<p id="email-hint" className="text-muted-foreground">
  We'll never share your email
</p>

// Error states
<input
  id="password"
  type="password"
  aria-invalid={!!error}
  aria-describedby={error ? "password-error" : undefined}
/>
{error && <p id="password-error" role="alert">{error}</p>}
```

### Form Submission

```tsx
// Disable submit during loading
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Saving...' : 'Save'}
</button>

// Prevent double submission
const handleSubmit = async (e) => {
  e.preventDefault()
  if (isSubmitting) return
  setIsSubmitting(true)
  try {
    await submitForm()
  } finally {
    setIsSubmitting(false)
  }
}
```

---

## Animation & Motion

### Respect User Preferences

```css
/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// In React
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
/>
```

### Loading States

```tsx
// Skeleton over spinner for content areas
<Suspense fallback={<ArticleSkeleton />}>
  <Article />
</Suspense>

// Spinner for actions
<button disabled={isLoading}>
  {isLoading && <Spinner className="mr-2" />}
  Save
</button>
```

---

## Typography

### Proper Characters

```tsx
// BAD - Straight quotes
<p>He said "Hello"</p>

// GOOD - Curly quotes
<p>He said "Hello"</p>

// BAD - Three dots
<span>Loading...</span>

// GOOD - Ellipsis character
<span>Loading&hellip;</span>

// BAD - Hyphen for ranges
<span>10-20</span>

// GOOD - En dash for ranges
<span>10&ndash;20</span>
```

### Numbers

```tsx
// Tabular numbers for data columns
<td className="tabular-nums">{price}</td>

// Format large numbers
<span>{number.toLocaleString()}</span>

// Currency
<span>{new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(amount)}</span>
```

### Text Overflow

```tsx
// Single line truncation
<p className="truncate">{longText}</p>

// Multi-line truncation
<p className="line-clamp-3">{longText}</p>

// Always add title for truncated text
<p className="truncate" title={longText}>{longText}</p>
```

---

## Content & Overflow

### Handle Long Content

```tsx
// URLs and long words
<p className="break-words">{content}</p>

// Or break all
<p className="break-all">{url}</p>

// Prevent layout shift
<div className="min-w-0"> {/* Allows flex child to shrink */}
  <p className="truncate">{longTitle}</p>
</div>
```

### Empty States

```tsx
// ALWAYS handle empty states
{items.length === 0 ? (
  <EmptyState
    icon={<InboxIcon />}
    title="No items yet"
    description="Create your first item to get started"
    action={<Button>Create Item</Button>}
  />
) : (
  <ItemList items={items} />
)}
```

---

## Images

### Always Include Alt Text

```tsx
// Informative images
<img src={product.image} alt={product.name} />

// Decorative images
<img src={pattern.src} alt="" role="presentation" />

// Complex images
<figure>
  <img src={chart.src} alt="Sales chart" aria-describedby="chart-desc" />
  <figcaption id="chart-desc">
    Sales increased 25% from Q1 to Q2
  </figcaption>
</figure>
```

### Responsive Images

```tsx
// Next.js Image
import Image from 'next/image'

<Image
  src={src}
  alt={alt}
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 50vw"
  priority={isAboveFold}
/>
```

### Loading States

```tsx
// Blur placeholder
<Image
  src={src}
  alt={alt}
  placeholder="blur"
  blurDataURL={blurHash}
/>

// Skeleton placeholder
<div className="relative aspect-video bg-muted animate-pulse">
  <Image
    src={src}
    alt={alt}
    fill
    className="object-cover"
    onLoad={() => setLoaded(true)}
  />
</div>
```

---

## Performance

### Content Visibility

```css
/* Skip rendering off-screen content */
.below-fold {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* Estimated height */
}
```

### Virtualization for Long Lists

```tsx
// Use react-window or @tanstack/virtual for 100+ items
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              height: virtualItem.size,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Navigation & State

### Loading Indicators

```tsx
// Show loading state for navigation
import { useNavigation } from 'react-router-dom'
// or
import { useRouter } from 'next/navigation'

function NavLink({ href, children }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        startTransition(() => router.push(href))
      }}
      aria-busy={isPending}
    >
      {isPending && <Spinner className="mr-2" />}
      {children}
    </a>
  )
}
```

### URL State

```tsx
// Persist filter state in URL
import { useSearchParams } from 'next/navigation'

function Filters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category')

  const setCategory = (value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('category', value)
    setSearchParams(params)
  }
}
```

---

## Touch & Mobile

### Touch Targets

```css
/* Minimum 44x44px touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Tailwind */
className="min-h-11 min-w-11"
```

### Prevent Double-Tap Zoom

```css
/* On clickable elements */
button, a, [role="button"] {
  touch-action: manipulation;
}
```

### Safe Areas

```css
/* Account for notches and home indicators */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Dark Mode

### System Preference Detection

```tsx
// Respect system preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

// Listen for changes
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e) => setIsDark(e.matches)
  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}, [])
```

### Semantic Colors

```tsx
// GOOD - Uses semantic tokens that switch automatically
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click
  </button>
</div>

// BAD - Hardcoded colors
<div className="bg-white text-black dark:bg-gray-900 dark:text-white">
```

---

## Hydration Safety

### Avoid Hydration Mismatches

```tsx
// BAD - Different on server vs client
function Component() {
  return <p>{new Date().toLocaleString()}</p>
}

// GOOD - useEffect for client-only values
function Component() {
  const [date, setDate] = useState<string>()

  useEffect(() => {
    setDate(new Date().toLocaleString())
  }, [])

  return <p>{date}</p>
}

// GOOD - Suppress hydration warning when intentional
<time dateTime={isoDate} suppressHydrationWarning>
  {formattedDate}
</time>
```

### Client-Only Components

```tsx
// For components that can't SSR
'use client'

import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <MapSkeleton />,
})
```

---

## Anti-Pattern Checklist

Before shipping, verify:

### Accessibility
- [ ] All interactive elements are keyboard accessible
- [ ] Icon-only buttons have `aria-label`
- [ ] Form inputs have associated labels
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Focus states are visible

### Forms
- [ ] Inputs have appropriate `type`, `inputMode`, `autoComplete`
- [ ] Error messages are associated with inputs
- [ ] Submit buttons show loading state
- [ ] Form prevents double submission

### Performance
- [ ] Images have explicit dimensions
- [ ] Long lists are virtualized
- [ ] Heavy components are dynamically imported
- [ ] No layout shift on load

### UX
- [ ] Empty states are handled
- [ ] Loading states are shown
- [ ] Errors are displayed to user
- [ ] Touch targets are 44px minimum
- [ ] Motion respects `prefers-reduced-motion`

### Dark Mode
- [ ] Uses semantic color tokens
- [ ] Tested in both light and dark modes
- [ ] No hardcoded colors
