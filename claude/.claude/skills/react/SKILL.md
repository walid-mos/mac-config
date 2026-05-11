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

These rules apply to ALL React code you write or modify. No exceptions. React is deceptively simple - writing correct, maintainable React requires discipline.

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

Full rules on minimal state, immutable updates, reducers, and controlled components in [state.md](state.md).

---

## RULE 4 - HOOKS DISCIPLINE

- Only call hooks at the **top level** - never inside loops, conditions, or nested functions
- **Never suppress `exhaustive-deps` linter** - fix the code, not the linter
- Lifecycle wrappers (`useMount`, `useEffectOnce`) are FORBIDDEN
- Custom hooks share **stateful logic**, not state - each call gets independent state

Full rules and dependency removal checklist in [hooks.md](hooks.md).

---

## RULE 5 - COMPONENT DESIGN AND DATA FLOW

- Data flows **down** via props. Events flow **up** via callbacks. Non-negotiable.
- >5 props and growing = split the component or use composition
- Lists must have **stable, unique keys** (no index on dynamic lists)
- **Jotai atoms** for shared state across distant components - see [jotai.md](jotai.md)
- Context is almost never needed - only for sub-tree scoping (e.g. theme section). Jotai is preferred for everything else.

Full patterns in [patterns.md](patterns.md).

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
