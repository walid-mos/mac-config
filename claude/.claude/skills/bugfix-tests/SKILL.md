---
name: bugfix-tests
description: Use when a bug is reported - write reproducing test BEFORE attempting any fix, then delegate fix to subagent
---

# Bugfix Tests

## Overview

When a bug is reported, don't start by trying to fix it. Start by writing a test that reproduces the bug. Then, have subagents try to fix the bug and prove it with a passing test.

## The Iron Law

```
NO FIX ATTEMPTS WITHOUT A REPRODUCING TEST FIRST
```

The test IS the investigation. If you can write a test that fails, you understand the bug.

## Workflow

```
Bug reported → Write reproducing test → Watch it fail → Dispatch subagent for fix → Verify test passes
```

1. **Write test** - Capture the bug as a failing test
2. **Verify failure** - Run test, confirm it fails for the right reason
3. **Delegate fix** - Use subagent to implement fix (you own the spec, they own the implementation)
4. **Verify pass** - Test must pass. No "I think I fixed it" - evidence required.

## Why Subagent Delegation

Separation prevents "test to fit my fix" bias:
- Test author specifies behavior
- Fix implementer delivers solution
- Test proves correctness objectively

## Common Rationalizations

| Excuse | Counter |
|--------|---------|
| "Let me understand the bug first" | The test IS understanding. Can't write test = don't understand bug. |
| "I already know the fix" | Then writing the test takes 30 seconds. Do it anyway. |
| "Test is too hard to write" | If you can't test it, you can't prove you fixed it. |
| "I'll write test after to verify" | Post-fix tests are biased toward your implementation. |
| "Subagent might write bad fix" | Test catches bad fixes. That's the point. |

## Red Flags

If you catch yourself:
- Investigating root cause before writing test
- Proposing a fix without a failing test
- Writing test after implementing fix
- Keeping fix attempt as "reference"

**STOP. Write the test first.**

## Related Skills

- `superpowers:systematic-debugging` - For deep investigation after test exists
- `superpowers:test-driven-development` - TDD cycle for the fix implementation
- `superpowers:dispatching-parallel-agents` - For subagent delegation patterns
