# Interface Design for Testability

Good interfaces make testing natural. Bad interfaces force you to mock, stub, and fight the code to test it.

## Principles

### 1. Accept Dependencies, Don't Create Them

```
// TESTABLE — dependency is injected
function processOrder(order, paymentGateway) {
  return paymentGateway.charge(order.total)
}

// HARD TO TEST — dependency is created internally
function processOrder(order) {
  const gateway = new StripeGateway()
  return gateway.charge(order.total)
}
```

### 2. Return Results, Don't Produce Side Effects

```
// TESTABLE — pure input/output
function calculateDiscount(cart): Discount {
  return { amount: cart.total * 0.1, reason: "loyalty" }
}

// HARD TO TEST — mutates input, no return value
function applyDiscount(cart): void {
  cart.total -= cart.total * 0.1
}
```

### 3. Small Surface Area

- Fewer methods = fewer tests needed
- Fewer params = simpler test setup
- Deep modules > shallow modules (see [deep-modules.md](deep-modules.md))

### 4. Separate Decisions from Effects

```
// GOOD — decision is pure, effect is at the edge
function decideAction(state): Action {
  if (state.retries > 3) return { type: "abort", reason: "max retries" }
  return { type: "retry", delay: state.retries * 1000 }
}

// The caller applies the effect
const action = decideAction(state)
if (action.type === "retry") await sleep(action.delay)
```

This pattern makes the decision trivially testable — no mocking needed.
