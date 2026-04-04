# When to Mock

Mock at **system boundaries** only:
- External APIs (payment, email, etc.)
- Databases (sometimes — prefer test DB when possible)
- Time/randomness
- File system (sometimes)

**Never mock:**
- Your own classes/modules
- Internal collaborators
- Anything you control

The test for whether to mock: "Is this thing I'm about to mock something I own and control?" If yes, don't mock it — use the real thing.

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

### 1. Use Dependency Injection

Pass external dependencies in rather than creating them internally.

```
// TESTABLE — dependency is injected
function processOrder(order, paymentGateway) {
  const result = paymentGateway.charge(order.total)
  return result
}

// HARD TO TEST — dependency is created internally
function processOrder(order) {
  const gateway = new StripeGateway()
  return gateway.charge(order.total)
}
```

### 2. Prefer SDK-Style Interfaces Over Generic Fetchers

Create specific functions for each external operation instead of one generic function with conditional logic.

```
// GOOD — each function has one shape, easy to mock
async function fetchUser(id) { ... }
async function createOrder(data) { ... }
async function chargeCard(amount) { ... }

// BAD — generic fetcher with conditional logic
async function apiCall(method, path, data) { ... }
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint

### 3. Every Mock Must Be Justified

If you add a mock, you must be able to answer: "What side effect does this prevent?" If you can't answer that clearly, don't mock it.
