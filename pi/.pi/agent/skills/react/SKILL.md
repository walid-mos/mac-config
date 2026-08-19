---
name: react
user-invocable: false
description: >-
    React component design judgment: composition, effect discipline, derived
    state, data flow, Jotai. MUST be loaded whenever writing or modifying React
    components (*.jsx, *.tsx), alongside "coding" and the language skill
    (typescript). Mechanical rules are linted by
    @nextnode-solutions/standards; this skill covers what the linter cannot judge.
---

# React - Mandatory Rules

References: [effects.md](effects.md) (how to fix every `no-use-effect` / `exhaustive-deps` warning), [composition.md](composition.md) (SOLID for components), [patterns.md](patterns.md) (data flow, RULE 6/7 examples), [jotai.md](jotai.md) (shared state).

## RULE 0 - Composition is everything (highest priority)

Composition over inheritance, over configuration, over prop drilling.

- `children` and render slots, NOT config props.
- Reduce prop drilling with composition BEFORE reaching for Jotai or Context.
- Class inheritance for components is FORBIDDEN.
- SOLID applied to components: [composition.md](composition.md).

## RULE 1 - You do not need useEffect (most of the time)

Effects are an escape hatch to synchronize with **external systems** (browser APIs, third-party widgets, subscriptions). No external system: no Effect. Ask "why does this code run?":

- User interaction happened --> event handler.
- Component displayed --> Effect (maybe), always with a cleanup function.
- Computed value from state/props --> calculate during render.

All FORBIDDEN/MANDATORY cases, plus the list of legitimate Effects, in [effects.md](effects.md).

## RULE 2 - Component purity

During render, FORBIDDEN: mutating props, state, or external variables; direct DOM manipulation; side effects (network, timers, logging). ALLOWED: local mutation of objects created within the same render - `[...todos].sort(...)` yes, `todos.sort(...)` no.

## RULE 3 - State design

NOT state if any is true: unchanged over time (constant), passed from parent (prop), computable from existing state/props (derive during render). Never mirror a derived value into `useState`; derive it: `const selectedItem = items.find(i => i.id === selectedId) ?? null`.

## RULE 4 - Hooks discipline

- **Never suppress `exhaustive-deps`** - a warning is a design problem; work the dependency-removal checklist in [effects.md](effects.md).
- Lifecycle wrappers (`useMount`, `useEffectOnce`, `useUpdateEffect`) are FORBIDDEN - they mimic class lifecycles and bypass dependency linting.
- Custom hooks share **stateful logic**, not state - each call gets independent state. Names start with `use` ONLY if they call hooks; otherwise `get`/`create`/`calculate`. Extract when logic is duplicated or an Effect's intent becomes clearer when named.

## RULE 5 - Data flow

- Data flows **down** via props; events flow **up** via callbacks. Non-negotiable.
- The >5-props warning is a design signal; the fix is a choice: split the component, compose with `children`/slots, or move distant shared state to Jotai - [patterns.md](patterns.md).
- **Jotai atoms** for shared state across distant components - [jotai.md](jotai.md). Context only for sub-tree scoping (a themed section, a scoped form).

## RULE 6 - Render components, don't call them

A function that takes props-like inputs **or** returns whole view/page subtrees IS a component: give it a `PascalCase` name, own scope, mount it as `<Name />`. Never invoke it as `renderThing(...)` - it gets no identity, no hooks/memo boundary, and drags its concern (e.g. routing) into the caller. ALLOWED exception: a small pure helper returning _child fragments_, consumed in ONE spot of its owner's render, no props, no page-level dispatch. Example pair in [patterns.md](patterns.md).

## RULE 7 - React 19 refs are plain props (no forwardRef)

`forwardRef` is obsolete - do NOT use it, even to forward a ref to a DOM node. Type props with `ComponentPropsWithRef<'element'>` and spread `{...props}` onto the native element; `ref` flows through. This is also the `react-hook-form`-compatible form (`{...register('email')}` passes its `ref` as a plain prop). Example in [patterns.md](patterns.md).

## RULE 8 - One component per file: the exception

A truly tiny, private sub-component used by exactly one component may co-locate in its consumer's file - never exported, never reused (a 3-line `<StatusDot />`). The moment it grows state/effects, gains a second caller, or wants its own test --> own file.

## RULE 9 - DRY, shallow, tested, unmemoized

- Duplicated JSX --> extract a component; duplicated stateful logic --> a custom hook. Rule of three: the third copy MUST be extracted; don't abstract on the first.
- Aim much flatter than the linted depth-8: past ~3-4 levels, extract a child component. Fragments over wrapper `<div>`s.
- Test behaviour, not internals: RTL queries by role/text, fire events, assert visible output. Never assert internal state, hook call order, or blind snapshots. Write the failing test first, then the code.
- `useMemo`/`useCallback`/`React.memo` only for measured hot paths or to stabilize a dependency - never a default.

## State management

| Need                                             | Use                                                      |
| ------------------------------------------------ | -------------------------------------------------------- |
| Local UI state (toggle, form input)              | `useState`, in the closest common parent                 |
| Complex local state (multi-field, many handlers) | `useReducer`                                             |
| Sub-tree scoping only                            | Context                                                  |
| Distant shared state (auth, locale, flags)       | Jotai atoms - [jotai.md](jotai.md)                       |
| Server state (fetch, cache, sync, invalidation)  | React Query / SWR / RSC - never `useState` + `useEffect` |

- **Immutable updates always**: new references (`setItems([...items, item])`); in-place `push`/`splice`/field assignment keeps the reference and React skips the re-render (`coding` RULE 7).
- **Group state that changes together**: one `useState({ x: 0, y: 0 })` over two coupled `useState`.
- **Controlled** when a parent must coordinate behavior; uncontrolled is fine for leaf UI no parent cares about.
- **Reducers**: pure, no side effects; actions describe what the user did (`{ type: "item_added", item }`), not setters; one action = one interaction; default case throws `new Error(\`Unknown action: ${action.type}\`)`.
- Jotai is the escape hatch when lifting state would drill through too many layers.

## Quick Reference - Judgment Beyond the Linter

| Pattern                                                          | Verdict   | Instead                                                               |
| ---------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| Computed value stored in state                                   | FORBIDDEN | Compute during render                                                 |
| `useEffect` to sync derived state                                | FORBIDDEN | Inline or `useMemo` ([effects.md](effects.md))                        |
| `useEffect` to respond to user action                            | FORBIDDEN | Event handler                                                         |
| `useEffect` to notify parent                                     | FORBIDDEN | Callback in event handler                                             |
| Chain of Effects triggering each other                           | FORBIDDEN | Consolidate in handler                                                |
| Reset state via `useEffect` on prop change                       | FORBIDDEN | `key` prop to remount                                                 |
| `useMount` / `useEffectOnce` wrappers                            | FORBIDDEN | Proper `useEffect` with deps                                          |
| Suppressing `exhaustive-deps`                                    | FORBIDDEN | Dependency-removal checklist                                          |
| Class inheritance for components                                 | FORBIDDEN | Composition                                                           |
| `forwardRef` in a React 19 codebase                              | FORBIDDEN | `ref` is a plain prop (RULE 7)                                        |
| God-component with config props                                  | FORBIDDEN | `children` / slots ([composition.md](composition.md))                 |
| Component-shaped function called as `renderThing(props)`         | FORBIDDEN | Extract & mount as JSX (RULE 6)                                       |
| Sub-component with state/effects kept inline "for convenience"   | FORBIDDEN | Own file (RULE 8 exception is tiny+private+single-use)                |
| Imperative component fusing subscription + render + coordination | FORBIDDEN | Renderer module + `use*` hook + presentational shell (composition.md) |
| Effect body with inline logic beyond wiring + cleanup            | FORBIDDEN | Extract pure logic to a module fn; keep the effect thin               |
| Duplicated JSX / stateful logic (3rd copy)                       | FORBIDDEN | Extract a component / custom hook                                     |
| Asserting internal state / hook order / blind snapshots          | FORBIDDEN | Test visible behaviour via RTL                                        |
| `useMemo`/`useCallback`/`memo` by default                        | AVOID     | Memoize only proven hot paths                                         |
| Context for shared state                                         | AVOID     | Jotai atoms                                                           |
| Prop drilling through 3+ layers                                  | AVOID     | Compose with children, then Jotai                                     |
