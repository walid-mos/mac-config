# Designing for Mockability

Core mocking rules (what to mock, what not to mock, justification) are in the **Testing Best Practices** skill. This file covers **design patterns** that make system boundaries easy to mock.

## Prefer SDK-Style Interfaces Over Generic Fetchers

Create specific functions for each external operation instead of one generic function with conditional logic.

```
// GOOD - each function has one shape, easy to mock
async function fetchUser(id) { ... }
async function createOrder(data) { ... }
async function chargeCard(amount) { ... }

// BAD - generic fetcher with conditional logic
async function apiCall(method, path, data) { ... }
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint

## Also See

- [interface-design.md](interface-design.md) - dependency injection, pure return values, small surface area
