# Interface Design for Testability

Good interfaces make testing natural:

## 1. Accept dependencies, don't create them

```typescript
// Testable
function processOrder(order: Order, paymentGateway: PaymentGateway) {}

// Hard to test
function processOrder(order: Order) {
  const gateway = new StripeGateway()
}
```

## 2. Return results, don't produce side effects

```typescript
// Testable
function calculateDiscount(cart: Cart): Discount {}

// Hard to test
function applyDiscount(cart: Cart): void {
  cart.total -= discount
}
```

## 3. Small surface area

- Fewer methods = fewer tests needed
- Fewer params = simpler test setup
- One responsibility = one reason to test
