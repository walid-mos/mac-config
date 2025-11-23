#!/usr/bin/env python3
"""
PreToolUse Hook: Auto-approve && command chains when all commands are allowed

This hook intelligently handles Bash command chains (&&) by:
1. Reading allowed patterns from settings.json
2. Extracting individual commands from && chains
3. Verifying each command is individually allowed
4. Auto-approving if all commands pass verification

Example:
- settings.json has: Bash(git :*), Bash(npm :*)
- Command: "git add . && npm install"
- Hook extracts: ["git", "npm"]
- Both allowed → auto-approve
"""

import json
import sys
import os


def load_allowed_patterns():
    """Load allowed Bash patterns from settings.json"""
    settings_path = os.path.expanduser("~/.claude/settings.json")

    try:
        with open(settings_path) as f:
            settings = json.load(f)
        return settings.get("permissions", {}).get("allow", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def extract_commands(chained_command):
    """
    Extract individual commands from && chain

    Example:
        "cd dir && npm start" → ["cd", "npm"]
        "git add . && git commit -m 'msg'" → ["git", "git"]
    """
    commands = []
    for part in chained_command.split(" && "):
        # Get first word (the actual command)
        cmd = part.strip().split()[0] if part.strip() else ""
        if cmd:
            commands.append(cmd)
    return commands


def command_is_allowed(command, patterns):
    """
    Check if a command matches any allowed Bash pattern

    Patterns can be:
        - "Bash(git :*)" → matches "git"
        - "Bash(npm run :*)" → matches "npm"
        - "Bash(cd:*)" → matches "cd"
    """
    for pattern in patterns:
        if not pattern.startswith("Bash("):
            continue

        # Extract command from pattern: "Bash(git :*)" → "git :*"
        cmd_pattern = pattern[5:-1]  # Remove "Bash(" and ")"

        # Get base command: "git :*" → "git", "npm run :*" → "npm"
        base_cmd = cmd_pattern.split()[0].rstrip(':')

        if command == base_cmd:
            return True

    return False


def main():
    """Main hook logic"""
    input_data = json.load(sys.stdin)

    # Only process Bash tool calls
    if input_data.get("tool_name") != "Bash":
        sys.exit(0)

    command = input_data.get("tool_input", {}).get("command", "")

    # Check if it's a && chain
    if " && " not in command:
        # Not a chain, let normal permissions handle it
        sys.exit(0)

    # Load allowed patterns from settings.json
    allowed_patterns = load_allowed_patterns()

    if not allowed_patterns:
        # No patterns configured, let normal permissions handle it
        sys.exit(0)

    # Extract individual commands from chain
    commands = extract_commands(command)

    # Check if ALL commands in chain are individually allowed
    all_allowed = all(
        command_is_allowed(cmd, allowed_patterns)
        for cmd in commands
    )

    if all_allowed:
        # All commands are allowed individually, auto-approve chain
        sys.exit(0)

    # Not all commands allowed, let normal permissions system decide
    sys.exit(0)


if __name__ == "__main__":
    main()
