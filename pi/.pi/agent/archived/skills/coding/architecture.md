# Architectural Rules - Project-Level

These rules complement the line-level rules in `SKILL.md`: how code is structured *across files and over time*. AI assistants optimize for the immediate prompt; each addition feels fine in isolation, and aggregated over months that produces god objects, 100-branch dispatch chains, races, and modules that change on every addition. When a task touches structure, scan for these patterns first; if one is forming, surface it to the user instead of silently extending it.

**Lint tripwires** near these failure modes: `import/max-dependencies` (warn > 20 - god-module forming), `complexity` <= 15 and `max-depth` <= 2 (switch chains, nesting), `max-lines` <= 250 (file doing too much). A tripwire firing means the architectural question below must be answered - these rules are the answer, not the threshold.

---

## ARCH 0 - Deep Modules Over Shallow (HIGHEST PRIORITY)

The best modules are **deep**: a lot of behaviour behind a small interface. The *interface* is everything a caller must know to use the module correctly - invariants, ordering, error modes, required config - not just the type signature. **Depth = leverage:** capability gained per unit of interface learned.

- **Shallow module = smell.** When the interface is nearly as complex as the implementation (a one-line pass-through, a wrapper that just forwards args, a "manager" re-exposing every internal), it adds cost without hiding complexity. Inline it or deepen it.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through - delete it. If the same complexity reappears duplicated across N callers, it was earning its keep - keep it.
- **The interface is the test surface.** Callers and tests cross the same seam. If a test must reach *past* the interface (poke private state, stub internals) to verify behaviour, the module is the wrong shape - redesign it, don't add a back door.
- **Dependency direction.** High-level policy (business rules) must not import low-level mechanism (DB, HTTP, FS) directly - invert via an interface/parameter and inject the concrete adapter at the edge. Stable things must not depend on volatile things.
- **Seams: one adapter is hypothetical, two are real.** A *seam* is a place you can change behaviour without editing in place. Don't introduce one (interface, strategy, plugin point) until something *actually* varies across it - a speculative seam is a shallow module in disguise.

Vocabulary, used consistently: **module** (interface + implementation), **interface** (all a caller must know), **depth** (behaviour per unit of interface), **seam** (where behaviour can be swapped), **adapter** (a concrete thing at a seam), **leverage** (what callers gain), **locality** (change, bugs, and knowledge concentrated in one place).

Shallow: `fetchThenParse(url) = fetch(url).then(r => r.json())` - every caller could inline it; deleting it changes nothing. Deep: `getJson(url, { signal })` hiding `res.ok` checks, retry on 5xx, shape validation, and typed errors behind the same-size signature.

---

## ARCH 1 - No God Objects

A struct/class holding state for unrelated concerns is a god object in formation. Signals:

- More than ~15 heterogeneous fields
- A central `Update()` / `Reduce()` / `Handle()` method branching by type
- Methods grouped by what they touch (this field, that field), not by responsibility

Split by ownership: an `App` of 30 mixed fields becomes `ui: UiState`, `kube: KubeClient`, `views: ViewRegistry` (owning its sub-states), `nav: NavHistory`. When asked to add a 3rd unrelated concern to an existing struct, propose a sub-struct or separate module BEFORE adding the field.

---

## ARCH 2 - Typed Structures Over Positional Data

`[]string`, `map[string]any`, tuples of more than 2 elements, and positional indexing into arrays are FORBIDDEN as a domain representation - `row[3] == "ready"` breaks silently when columns are reordered or added. Use named, typed structs. Exception: serialization boundaries (CSV, wire frames) - decode into typed structs immediately on the inside of the boundary.

---

## ARCH 3 - Dispatch Tables, Not Switch Chains

When a switch / if-chain reaches ~10 branches, it stops being control flow and becomes a registry expressed badly. Convert to a dispatch table (map of key -> handler). This extends `SKILL.md` RULE 9 with the architectural angle: the table is also the *extension point* - new cases register themselves instead of editing the central dispatch.

**Trigger:** if the 3rd feature in a row touches the same dispatch site, that site MUST become a table before the 4th.

---

## ARCH 4 - Explicit Invariants and Ownership

For any non-trivial state, the project MUST be able to answer:

- **Who owns it?** Which module is allowed to construct/mutate it.
- **When is it mutated?** Event loop only, request handler only, init only.
- **What enforces it?** Visibility, type wrappers, or assertions where the language can't express it.

Without these answers, mutations leak everywhere and races appear - a background task mutating UI state without routing through the main event loop is the canonical failure. **MANDATORY:** at the start of any non-trivial project, document the answers in `CLAUDE.md` or `ARCHITECTURE.md` at the project root. When asked to introduce concurrency, ALWAYS ask "how does this task signal the main loop?" before writing code.

---

## ARCH 5 - Centralize Cross-Cutting Namespaces

Some namespaces are global by nature and conflicts surface late: TUI/CLI keybindings, pub/sub event names, error codes, URL routes, DB migration IDs, feature-flag keys. FORBIDDEN: scattering registrations across files where each module declares its own binding without coordination. MANDATORY: one registry file/module that owns the namespace; new entries are added there, with conflict detection (compile-time enum, lint rule, or runtime assertion at startup).

---

## ARCH 6 - Velocity Is Not Progress

Before adding feature N, ask: does this make N+1 easier or harder? If harder, the feature is paying for itself with future debt. Signals that velocity is masking decay:

- The same file appears in every recent commit
- Each new feature requires touching 5+ existing files
- Tests are increasingly hard to set up because of shared state
- "Just one more branch" in a switch has been said more than 3 times

When detected, STOP feature work and propose a refactor BEFORE the next addition. Do NOT silently agree to the next "add X" prompt if the structure is decaying - surface the cost first and let the user decide.
