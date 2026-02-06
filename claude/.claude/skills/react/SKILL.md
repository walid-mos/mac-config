---
name: react
description: React code standards. Use when writing or reviewing React components, hooks, and JSX/TSX code.
user-invocable: false
---

# React Standards

## Components

- Split god components (500+ lines) by responsibility
- One component per file — colocate small helpers only if tightly coupled
- Prefer composition over prop drilling (4+ levels = use Context or state management)
- NEVER use `React.FC` — type props directly: `const Comp = ({ title }: CompProps) => {}`

## State

- Derived data = compute at render, NEVER store in state
- NEVER mutate state — create new arrays/objects
- Functional updates: `setCount(prev => prev + 1)`
- Lazy initialization: `useState(() => expensiveCalc())`
- Colocate state as close to usage as possible — lift only when shared

## Hooks

- ALWAYS call hooks unconditionally — use the result conditionally
- `useCallback` for functions passed to list items or memoized children
- `useMemo` only when computation is genuinely expensive — profile first
- `startTransition` for non-urgent updates (search, filtering)
- Custom hooks = `use` + verb: `useAuth`, `useFetchUsers`

## JSX

- `count > 0 &&` NOT `count &&` (avoids rendering `0`)
- Keys = unique stable IDs, NEVER array index
- Fragment `<>` over wrapping `<div>` when no DOM node needed
- Self-close components without children: `<Button />`

## Styling

- Tailwind inline classes, ALWAYS
- `cn()` utility mandatory for conditional classes — NEVER template literals
- `cva` is the ONLY exception for extracting class variants

## Data Fetching

- Result pattern `[error, data]` — NEVER throw in components
- Loading/error/success states: always handle all three
- Prefer server components for initial data when using RSC frameworks
