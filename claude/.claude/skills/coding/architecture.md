# Architectural Rules - Project-Level

These rules complement the line-level rules in `SKILL.md`. They concern how code is *structured across files and over time*, not how a single function is written.

**Premise.** AI assistants (this one included) optimize for the immediate prompt. Each addition feels fine in isolation. Aggregated over months, this produces god objects, dispatch chains with 100+ branches, race conditions, and modules that change every time anyone adds anything. These rules exist to catch those failure modes BEFORE the next addition.

When working on a task that touches structure, scan for these patterns first. If one is forming, surface it to the user instead of silently extending it.

---

## ARCH 0 - Deep Modules Over Shallow (HIGHEST PRIORITY)

The best modules are **deep**: a lot of behaviour behind a small interface. The *interface* is everything a caller must know to use the module correctly - not just the type signature, but invariants, ordering, error modes, and required config. **Depth = leverage:** how much capability a caller gets per unit of interface they have to learn.

- **Shallow module = smell.** When the interface is nearly as complex as the implementation (a one-line pass-through, a wrapper that just forwards args, a "manager" that re-exposes every internal), it adds cost without hiding complexity. Inline it or deepen it.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through - delete it. If the same complexity reappears duplicated across N callers, the module was earning its keep - keep it.
- **The interface is the test surface.** Callers and tests cross the same seam. If a test must reach *past* the interface (poke private state, stub internals) to verify behaviour, the module is the wrong shape - redesign it, don't add a back door.
- **Dependency direction.** Depend on abstractions, not details. High-level policy (business rules) must not import low-level mechanism (DB, HTTP, FS) directly - invert via an interface/parameter and inject the concrete adapter at the edge. Stable things must not depend on volatile things.
- **Seams: one adapter is hypothetical, two are real.** A *seam* is a place you can change behaviour without editing in place. Don't introduce one (an interface, a strategy, a plugin point) until something *actually* varies across it - a speculative seam is a shallow module in disguise.

Vocabulary, used consistently: **module** (interface + implementation), **interface** (all a caller must know), **depth** (behaviour per unit of interface), **seam** (where behaviour can be swapped), **adapter** (a concrete thing at a seam), **leverage** (what callers gain), **locality** (change, bugs, and knowledge concentrated in one place).

```
// SHALLOW - the interface is as wide as the implementation; deleting it changes nothing
function fetchThenParse(url) {
  return fetch(url).then(r => r.json())   // every caller could just do this
}

// DEEP - small interface, real behaviour hidden behind it (retry, status check, typed result, abort)
async function getJson(url, { signal }) {
  // checks res.ok, retries on 5xx, validates the shape, throws a typed error
}
```

---

## ARCH 1 - No God Objects

A struct/class that holds state for unrelated concerns is a god object in formation.

**Signals:**
- More than ~15 heterogeneous fields
- A central `Update()` / `Reduce()` / `Handle()` method branching by type
- Methods grouped by what they touch (this field, that field), not by responsibility

```
// FORBIDDEN
struct App {
    ui_widgets, k8s_client, logs_state, fleet_state,
    nav_history, cache, mouse_state, /* 30 more fields */
}

// MANDATORY - split by ownership
struct App {
    ui: UiState,
    kube: KubeClient,
    views: ViewRegistry,  // owns logs/fleet/describe sub-states
    nav: NavHistory,
}
```

When asked to add a 3rd unrelated concern to an existing struct, propose a sub-struct or a separate module BEFORE adding the field.

---

## ARCH 2 - Typed Structures Over Positional Data

`[]string`, `map[string]any`, tuples of more than 2 elements, and positional indexing into arrays are FORBIDDEN as a domain representation. They produce silent bugs when fields are reordered or added.

```
// FORBIDDEN - what does row[3] mean?
rows := [][]string{}
for _, pod := range pods {
    rows = append(rows, []string{pod.Name, pod.Namespace, pod.Status, pod.Node})
}
if row[3] == "ready" { ... }  // breaks if column order changes

// MANDATORY - named, typed
type PodRow struct {
    Name      string
    Namespace string
    Status    string
    Node      string
}
```

Exception: serialization boundaries (CSV, wire frames). Decode into typed structs immediately on the inside of the boundary.

---

## ARCH 3 - Dispatch Tables, Not Switch Chains

When a switch / if-chain reaches ~10 branches, it stops being control flow and becomes a registry expressed badly. Convert to a dispatch table (map of key -> handler). This extends `RULE 9` in `SKILL.md` with an architectural angle: the table is also the *extension point* - new cases register themselves instead of editing the central dispatch.

```
// FORBIDDEN - editing central code on every new view
fn handle(view: View, ev: Event) {
    match view {
        View::Pods => handle_pods(ev),
        View::Logs => handle_logs(ev),
        View::Fleet => handle_fleet(ev),
        // 20 more, growing every week
    }
}

// MANDATORY - registry
let registry: HashMap<View, Handler> = HashMap::from([
    (View::Pods, handle_pods),
    (View::Logs, handle_logs),
]);
registry.get(&view).map(|h| h(ev));
```

**Trigger:** if the 3rd feature in a row touches the same dispatch site, that site MUST become a table before the 4th.

---

## ARCH 4 - Explicit Invariants and Ownership

For any non-trivial state, the project MUST be able to answer:
- **Who owns it?** Which module is allowed to construct/mutate it.
- **When is it mutated?** Event loop only, request handler only, init only.
- **What enforces it?** Visibility, type wrappers, or assertions where the language can't express it.

When these answers don't exist, mutations leak everywhere and races appear. A background task that mutates UI state from a goroutine WITHOUT routing through the main event loop is a canonical failure.

**MANDATORY:** at the start of any non-trivial project, document the answers in `CLAUDE.md` or `ARCHITECTURE.md` at the project root. When asked to introduce concurrency, ALWAYS ask "how does this task signal the main loop?" before writing code.

---

## ARCH 5 - Centralize Cross-Cutting Namespaces

Some namespaces are global by nature and conflicts surface late:
- Keybindings in a TUI/CLI
- Event names in a pub/sub
- Error codes
- URL routes
- DB migration IDs
- Feature flag keys

**FORBIDDEN:** scattering registrations across files where each module declares its own binding without coordination.

**MANDATORY:** one registry file/module that owns the namespace. New entries are added there, with conflict detection (compile-time enum, lint rule, or runtime assertion at startup).

---

## ARCH 6 - Velocity Is Not Progress

Before adding feature N, ask: does this make N+1 easier or harder? If harder, the feature is paying for itself with future debt.

**Signals that velocity is masking decay:**
- The same file appears in every recent commit
- Each new feature requires touching 5+ existing files
- Tests are increasingly hard to set up because of shared state
- "Just one more branch" in a switch has been said more than 3 times

When detected, STOP feature work and propose a refactor BEFORE the next addition. Do NOT silently agree to the next "add X" prompt if the structure is decaying - surface the cost first and let the user decide.

---

## Quick Reference - Forbidden vs Mandatory (Architectural)

| Pattern | Verdict | Instead |
|---|---|---|
| Shallow module (interface ≈ implementation; pass-through) | FORBIDDEN | Inline it or deepen it (ARCH 0) |
| High-level policy importing low-level detail (DB/HTTP/FS) | FORBIDDEN | Depend on an abstraction, inject the adapter (ARCH 0) |
| Speculative seam with a single adapter | AVOID | Add the seam only when a 2nd variant appears (ARCH 0) |
| Test reaching past the interface (private state/internals) | FORBIDDEN | Test through the interface; reshape the module (ARCH 0) |
| Single struct with >15 heterogeneous fields | FORBIDDEN | Split by ownership |
| `[]string` or `map[string]any` as domain model | FORBIDDEN | Named typed structs |
| Switch/if-chain with >10 cases | FORBIDDEN | Dispatch table / registry |
| Background mutation of shared state without event-loop routing | FORBIDDEN | Message passing |
| Decentralized global namespaces (keybinds, events, routes) | FORBIDDEN | Single registry |
| 3rd similar change touching the same files | FORBIDDEN | Extract extension point |
| Undocumented state ownership / mutation rules | FORBIDDEN | `CLAUDE.md` or `ARCHITECTURE.md` |
| Adding features while structure is decaying | FORBIDDEN | Refactor first, then add |
