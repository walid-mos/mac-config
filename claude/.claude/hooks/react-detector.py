#!/usr/bin/env python3
"""React guidelines detection hook.

Detects React-related keywords in user prompts and injects
condensed guidelines summary with skill reference.

Runs on UserPromptSubmit hook trigger.
"""
import json
import sys

# Keywords that trigger React guidelines
TRIGGER_KEYWORDS = [
    "react",
    "component",
    "hook",
    "useState",
    "useEffect",
    "useMemo",
    "useCallback",
    "jsx",
    "tsx component",
]

# Condensed enforcement message
ENFORCEMENT_MESSAGE = """[REACT RULES ACTIVATED]
Core rules:
- Split god components (500+ lines) by responsibility
- Use Context for prop drilling (4+ levels)
- Compute derived data on render (no state for computed values)
- Immutable state updates (spread, map, filter)
- Functional setState for closures: `setCount(prev => prev + 1)`

Anti-patterns to avoid:
- Index as key -> use stable unique ID
- Conditional hooks -> always call, conditionally use
- Missing useEffect deps -> include all dependencies
- Inline functions in lists -> useCallback
- `count && <C />` -> `count > 0 && <C />`

Full details: run /react"""


def should_enforce(prompt: str) -> bool:
    """Check if React enforcement is needed."""
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
