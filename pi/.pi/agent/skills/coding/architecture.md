# Architecture — Evidence Before Indirection

Load this file only when a requested change alters ownership, responsibilities,
or dependencies across files. Architecture should make the current system easier
to understand and change; it is not permission to redesign adjacent code.

Repository architecture, ADRs, and configured quality gates are authoritative.
Surface conflicts instead of silently replacing established decisions.

## 1. Prefer deep modules

A useful module hides meaningful behavior behind a smaller interface. Count as
interface cost everything callers must know: ordering, invariants, configuration,
error modes, and lifecycle—not only parameters.

Apply the deletion test: if removing a module makes complexity disappear, it was
probably a pass-through. If the same knowledge would reappear in several callers,
the module is earning its place.

Do not expose internals merely for tests. Tests should exercise the same contract
as callers; redesign only when the current behavior cannot be proved otherwise.

## 2. Add seams only where variation is real

A seam is a place where behavior can be substituted. One adapter is usually
hypothetical; two current implementations or a genuinely volatile external
boundary are evidence.

When a seam is justified, prefer the narrowest mechanism the language provides:
a function parameter or small existing contract before a new interface, factory,
registry, and adapter family.

Keep pure policy separate from side-effect mechanisms when doing so simplifies
the current change. Do not manufacture layers solely to satisfy dependency
inversion terminology.

## 3. Organize by ownership and cohesion

Each mutable state and invariant needs one clear owner. Split a module where
unrelated concerns change for different reasons. When a hard size gate requires a
split, simplify first, then choose a real ownership boundary rather than creating
pass-through fragments at an arbitrary line.

Use named typed structures for domain data. Decode positional or untrusted wire
formats at the boundary. Do not leak database, HTTP, or serialization shapes into
the domain unless they are genuinely the same contract.

Centralize a cross-cutting namespace—routes, keybindings, event names, error
codes—only when coordination or collision detection is a current requirement.
Avoid both scattered duplicate ownership and a speculative global registry.

## 4. Choose dispatch from current variants

Use direct conditionals while they remain the clearest representation. Move to a
lookup or dispatch table when existing variants are data-like, share a stable
contract, and the table reduces branching or repeated edits today.

A dispatch table may become an extension point, but future extensibility alone is
not sufficient reason to create it.

## 5. Preserve locality

A behavior change should touch the fewest natural owners. Repeatedly editing many
unrelated files or one central branch-heavy file is a signal to investigate, not
a mandate to refactor during the current task.

If structural decay blocks the requested change, explain the smallest necessary
refactor and keep it separable. If it does not block the change, finish the
requested work and report the concern rather than expanding scope.

## 6. Validate an architectural change

Before keeping a new boundary, answer:

- What current complexity does it hide or ownership does it clarify?
- Which acceptance criterion requires it now?
- Is its public surface smaller than the behavior behind it?
- Could a direct edit or function parameter solve the requirement more locally?
- Does deleting it simplify the system without duplicating knowledge?

If the boundary has no evidence-based answer, remove it.
