# Deep modules

From Ousterhout's *A Philosophy of Software Design*:

**Deep module** = small interface + lots of implementation. Few public methods with simple params; complex logic hidden inside.

**Shallow module** = large interface + thin implementation. Many methods, complex params, little hidden — usually a pass-through.

## Why this matters for TDD

Deep modules are naturally testable:
- Small interface → fewer tests cover the contract.
- Deep implementation → each test exercises a lot of real logic (high value per test).
- Simple params → simple test setup.

Shallow modules produce test suites that are large and brittle: many tests, each covering almost nothing, all coupled to the shape of the interface.

## When designing, ask

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?
- Does this module do one thing deeply, or many things shallowly?
