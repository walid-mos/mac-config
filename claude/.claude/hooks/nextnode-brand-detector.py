#!/usr/bin/env python3
"""NextNode brand guidelines detection hook.

Detects Nextnode-related keywords in user prompts and prepends strict
brand guidelines enforcement instructions.

Runs on UserPromptSubmit hook trigger.
"""
import json
import sys

# Keywords that trigger brand guidelines enforcement
TRIGGER_KEYWORDS = [
    "nextnode",
    "brand guidelines",
    "nextnode brand",
    "nextnode style",
    "nextnode design",
    "nn brand",
    "nextnode.fr",
]

# Strict enforcement message for Claude
ENFORCEMENT_MESSAGE = """[NEXTNODE BRAND GUIDELINES - STRICT MODE ACTIVATED]

You are working on a NextNode project. Follow these rules STRICTLY:

1. COLORS: Use semantic tokens ONLY
   - Primary: Teal #0D9488 (light) / #14B8A6 (dark)
   - Accent: Orange #F97316 (light) / #FB923C (dark)
   - ALWAYS: bg-primary, text-foreground, bg-card, etc.
   - NEVER: bg-white, text-black, bg-[#hex], bg-slate-*

2. TYPOGRAPHY: 3 font families ONLY
   - font-display (Plus Jakarta Sans) -> H1, H2, Hero
   - font-body (DM Sans) -> Body, H3, H4, UI
   - font-mono (JetBrains Mono) -> Code only

3. TAILWIND v4: No tailwind.config.ts for colors/fonts
   - Everything in globals.css with @theme {}
   - Dark mode: @custom-variant dark

4. DARK MODE: ALL components must support light AND dark
   - Class-based: .dark on root element
   - Test BOTH modes

Full guidelines: ~/.claude/guidelines/nextnode-brand.md"""


def should_enforce_brand(prompt: str) -> bool:
    """Check if Nextnode brand enforcement is needed."""
    prompt_lower = prompt.lower()
    return any(kw in prompt_lower for kw in TRIGGER_KEYWORDS)


def main() -> None:
    """Read prompt from stdin, detect keywords, output JSON response."""
    prompt = sys.stdin.read()

    if should_enforce_brand(prompt):
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
