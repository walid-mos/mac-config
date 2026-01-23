#!/usr/bin/env python3
"""TypeScript guidelines detection hook.

Detects TypeScript-related keywords in user prompts and injects
condensed guidelines summary with skill reference.

Runs on UserPromptSubmit hook trigger.
"""
import json
import sys

# Keywords that trigger TypeScript guidelines
TRIGGER_KEYWORDS = [
    ".ts",
    ".tsx",
    "typescript",
    "type safety",
    "types",
    "interface",
    "generic",
    "type guard",
]

# Condensed enforcement message
ENFORCEMENT_MESSAGE = """[TYPESCRIPT RULES ACTIVATED]
Core rules:
- Strong typing ONLY (no `any`, use `unknown` as last resort)
- Arrow functions: `const fn = () => {}` (no function declarations)
- ES6 imports only (never require())
- Separate import and import type
- Early returns, no else
- Type guards over `as` casting

Anti-patterns to avoid:
- `any` type -> use proper types or unknown
- require() -> import
- Untyped catch -> instanceof Error
- Deep nesting -> early returns
- Throwing errors in APIs -> return Result tuples

Full details: run /typescript"""


def should_enforce(prompt: str) -> bool:
    """Check if TypeScript enforcement is needed."""
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
