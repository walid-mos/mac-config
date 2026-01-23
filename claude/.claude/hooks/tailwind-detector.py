#!/usr/bin/env python3
"""Tailwind CSS guidelines detection hook.

Detects Tailwind-related keywords in user prompts and injects
condensed guidelines summary with skill reference.

Runs on UserPromptSubmit hook trigger.
"""
import json
import sys

# Keywords that trigger Tailwind guidelines
TRIGGER_KEYWORDS = [
    "tailwind",
    "classname",
    "cn(",
    "className",
    "utility class",
    "dark:",
    "hover:",
    "md:",
    "lg:",
]

# Condensed enforcement message
ENFORCEMENT_MESSAGE = """[TAILWIND RULES ACTIVATED]
Core rules:
- Inline utility classes ALWAYS (never store in constants)
- Use cn() when available (mandatory for conditionals)
- Group dark: variants WITH base state: `bg-white dark:bg-gray-800`
- One line per responsive breakpoint
- ONLY cva() can store classes in constants (for variants)

Organization domains:
1. Base/Global (structure, colors, typography)
2. Responsive (md:, lg:, xl: per line)
3. Variants/States (hover:, focus:, dark:)
4. Conditional logic (ternaries, booleans)

Forbidden:
- `const styles = "..."` (except cva)
- Separated dark variants
- Template literals without cn()
- Inline styles with Tailwind

Full details: run /tailwind"""


def should_enforce(prompt: str) -> bool:
    """Check if Tailwind enforcement is needed."""
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
