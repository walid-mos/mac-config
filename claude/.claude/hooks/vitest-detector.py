#!/usr/bin/env python3
"""Vitest guidelines detection hook.

Detects testing-related keywords in user prompts and injects
condensed guidelines summary with skill reference.

Runs on UserPromptSubmit hook trigger.
"""
import json
import sys

# Keywords that trigger Vitest guidelines
TRIGGER_KEYWORDS = [
    "test",
    "vitest",
    "describe",
    "it(",
    "expect",
    "mock",
    "spy",
    "vi.fn",
    "vi.mock",
    "beforeEach",
    "afterEach",
]

# Condensed enforcement message
ENFORCEMENT_MESSAGE = """[VITEST RULES ACTIVATED]
Core rules:
- Test behavior, not implementation
- Mock external dependencies only (I/O, side effects)
- Keep pure functions and business logic real
- ALWAYS clean up mocks (afterEach or config)

Mock cleanup (CRITICAL):
```typescript
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
```

Patterns:
- vi.fn() for standalone mocks
- vi.spyOn() to observe existing functions
- vi.hoisted() for shared mock references
- vi.stubGlobal() for environment mocking

Anti-patterns:
- Testing private methods
- Over-mocking everything
- Manual mock.calls inspection (use toHaveBeenCalledWith)
- Forgetting to restore timers

Full details: run /vitest"""


def should_enforce(prompt: str) -> bool:
    """Check if Vitest enforcement is needed."""
    prompt_lower = prompt.lower()
    return any(kw in prompt_lower for kw in TRIGGER_KEYWORDS)


def main() -> None:
    """Read prompt from stdin, detect keywords, output JSON response."""
    input_data = json.load(sys.stdin)
    prompt = input_data.get("user_prompt", "")

    if should_enforce(prompt):
        output = {
            "continue": True,
            "suppressOutput": True,
            "systemMessage": ENFORCEMENT_MESSAGE,
        }
    else:
        output = {"continue": True, "suppressOutput": True}

    print(json.dumps(output))


if __name__ == "__main__":
    main()
