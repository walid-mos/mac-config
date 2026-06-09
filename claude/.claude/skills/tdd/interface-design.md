# Interface Design for Testability

Good interfaces make testing natural. Bad interfaces force you to mock, stub, and fight the code to test it.

## Principles

### 1. Accept Dependencies, Don't Create Them

```
// TESTABLE - dependency is injected
function processOrder(order, paymentGateway) {
  return paymentGateway.charge(order.total)
}

// HARD TO TEST - dependency is created internally
function processOrder(order) {
  const gateway = new StripeGateway()
  return gateway.charge(order.total)
}
```

### 2. Return Results, Don't Produce Side Effects

```
// TESTABLE - pure input/output
function calculateDiscount(cart): Discount {
  return { amount: cart.total * 0.1, reason: "loyalty" }
}

// HARD TO TEST - mutates input, no return value
function applyDiscount(cart): void {
  cart.total -= cart.total * 0.1
}
```

### 3. Small Surface Area

- Fewer methods = fewer tests needed
- Fewer params = simpler test setup
- Deep modules > shallow modules (see below)

### 4. Separate Decisions from Effects

```
// GOOD - decision is pure, effect is at the edge
function decideAction(state): Action {
  if (state.retries > 3) return { type: "abort", reason: "max retries" }
  return { type: "retry", delay: state.retries * 1000 }
}

// The caller applies the effect
const action = decideAction(state)
if (action.type === "retry") await sleep(action.delay)
```

This pattern makes the decision trivially testable - no mocking needed.

## Deep vs Shallow Modules

From Ousterhout's *A Philosophy of Software Design*:

**Deep module** = small interface + lots of implementation. Few public methods with simple params; complex logic hidden inside.

**Shallow module** = large interface + thin implementation. Many methods, complex params, little hidden — usually a pass-through.

### Why this matters for TDD

Deep modules are naturally testable:
- Small interface → fewer tests cover the contract.
- Deep implementation → each test exercises a lot of real logic (high value per test).
- Simple params → simple test setup.

Shallow modules produce test suites that are large and brittle: many tests, each covering almost nothing, all coupled to the shape of the interface.

### When designing, ask

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?
- Does this module do one thing deeply, or many things shallowly?
