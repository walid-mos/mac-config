#!/usr/bin/env python3
"""Context7 availability reminder hook.

Instead of detecting specific libraries (which causes false positives like "next task"),
this hook simply reminds Claude that Context7 is available. Claude (Opus 4.5) is smart
enough to decide based on conversation context whether documentation would help.

Benefits:
- Zero false positives (no detection = no false detection)
- Works for ALL libraries, not just hardcoded ones
- Claude understands context far better than regex
- Simpler, more maintainable code

Runs on UserPromptSubmit hook trigger.
"""
import sys


def main() -> None:
    """Add Context7 availability reminder to prompt."""
    prompt = sys.stdin.read()

    # Simple reminder - Claude decides when to use Context7 based on context
    print(f"[Context7 available for library/framework documentation]\n{prompt}")


if __name__ == "__main__":
    main()
