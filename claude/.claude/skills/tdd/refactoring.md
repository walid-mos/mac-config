# Refactor Candidates

After TDD cycle (all tests GREEN), look for:

- **Duplication** — Extract function/class
- **Long methods** — Break into private helpers (keep tests on public interface)
- **Shallow modules** — Combine or deepen
- **Feature envy** — Move logic to where data lives
- **Primitive obsession** — Introduce value objects
- **Existing code** the new code reveals as problematic

**Rules**:

- Never refactor while RED — get to GREEN first
- Run tests after each refactor step
- If a refactor breaks a test, the test was testing implementation, not behavior — fix or delete the test
