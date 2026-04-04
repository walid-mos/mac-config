# Refactor Candidates

After each TDD cycle (or after all tests pass), look for these opportunities:

## Code Smells to Fix

- **Duplication** — Same logic in multiple places → extract function/class
- **Long methods** — Break into private helpers (keep tests on public interface)
- **Shallow modules** — Combine or deepen (see [deep-modules.md](deep-modules.md))
- **Feature envy** — Logic that uses another module's data more than its own → move it there
- **Primitive obsession** — Strings/numbers carrying domain meaning → introduce value objects
- **Long parameter lists** — Group related params into an options object or dedicated type

## What New Code Reveals

Each TDD cycle changes the codebase. After going green, look at the code with fresh eyes:

- Does the new code make an existing abstraction obsolete?
- Does the new code reveal a missing abstraction?
- Does an existing function now do two things because of the new behavior?
- Are there naming inconsistencies between old and new code?

## Refactoring Rules

- **Never refactor while RED.** Get to green first.
- **Run tests after EVERY refactor step.** Not after all refactoring — after each individual change.
- **Refactoring does NOT change behavior.** If you're adding new behavior, that requires a new RED test.
- **Refactor test code too.** Extract shared setup, use parameterized tests, improve test names.
