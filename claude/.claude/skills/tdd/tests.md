# Good and Bad Tests

## Good Tests

**Integration-style**: Test through real interfaces, not mocks of internal parts.

Characteristics:
- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test
- Reads like a specification

```
// GOOD — describes behavior through the public interface
it("rejects checkout when cart is empty", async () => {
  const cart = createCart()
  const result = await checkout(cart)
  expect(result.error).toBe("Cart is empty")
})

// GOOD — doesn't care HOW discount is calculated
it("applies 10% discount for orders over 100", () => {
  const order = createOrder({ total: 150 })
  const discounted = applyDiscount(order)
  expect(discounted.total).toBe(135)
})
```

## Bad Tests

**Implementation-detail tests**: Coupled to internal structure.

Red flags:
- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order of internal functions
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface

```
// BAD — coupled to implementation details
it("calls calculateDiscount then applyTax", () => {
  const calcSpy = vi.spyOn(internals, "calculateDiscount")
  const taxSpy = vi.spyOn(internals, "applyTax")
  processOrder(order)
  expect(calcSpy).toHaveBeenCalledBefore(taxSpy)
})

// BAD — testing private method
it("_validateFields returns error for missing email", () => {
  expect(form._validateFields({ name: "Alice" })).toContain("email")
})

// BAD — verifying through external means instead of interface
it("saves user to database", async () => {
  await createUser({ name: "Alice" })
  const rows = await db.query("SELECT * FROM users WHERE name = 'Alice'")
  expect(rows).toHaveLength(1)
})

// GOOD — same behavior, tested through public interface
it("created user is retrievable", async () => {
  await createUser({ name: "Alice" })
  const user = await getUser("Alice")
  expect(user.name).toBe("Alice")
})
```
