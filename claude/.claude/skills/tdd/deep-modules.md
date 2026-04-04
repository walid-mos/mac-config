# Deep Modules

From "A Philosophy of Software Design" (John Ousterhout):

**Deep module** = small interface + lots of implementation

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (AVOID)

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

## Why This Matters for TDD

Deep modules are naturally testable:
- Small interface = fewer tests needed to cover the contract
- Deep implementation = high value per test (each test exercises a lot of real logic)
- Simple params = simple test setup

Shallow modules produce test suites that are large, shallow, and brittle — many tests, each covering almost nothing.

## When Designing Interfaces, Ask:

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?
- Does this module do one thing deeply, or many things shallowly?
