#!/usr/bin/env python3
"""
PreToolUse Hook: Auto-approve && and | command chains when all commands are allowed

This hook intelligently handles Bash command chains (&&, |) by:
1. Reading allowed patterns from settings.json
2. Extracting individual commands from && and | chains (respecting quotes)
3. Verifying each command is individually allowed
4. Auto-approving if all commands pass verification

Example:
- settings.json has: Bash(git :*), Bash(grep :*)
- Command: "git status | grep 'foo|bar'"
- Hook extracts: ["git status", "grep 'foo|bar'"]
- Both allowed → auto-approve
- Note: The | in 'foo|bar' is NOT treated as pipe operator (inside quotes)
"""

import json
import sys
import os
import shlex


def load_permission_patterns():
    """Load both allowed and denied Bash patterns from settings.json"""
    settings_path = os.path.expanduser("~/.claude/settings.json")

    try:
        with open(settings_path) as f:
            settings = json.load(f)
        permissions = settings.get("permissions", {})
        return {
            "allow": permissions.get("allow", []),
            "deny": permissions.get("deny", [])
        }
    except (FileNotFoundError, json.JSONDecodeError):
        return {"allow": [], "deny": []}


def extract_commands(chained_command):
    """
    Extract individual commands from && and | chains, respecting quotes

    Uses shlex to tokenize while respecting quotes, then identifies
    && and | as operators (not part of quoted strings or regex).

    Example:
        "git status | grep 'test'" → [("git", "git status"), ("grep", "grep 'test'")]
        "grep 'foo|bar' | cat" → [("grep", "grep 'foo|bar'"), ("cat", "cat")]
        "cd dir && npm start" → [("cd", "cd dir"), ("npm", "npm start")]

    Returns:
        List of tuples: (base_command, full_command_part)
    """
    commands = []
    current_tokens = []

    # Use shlex to tokenize while respecting quotes
    lexer = shlex.shlex(chained_command, posix=True)
    lexer.whitespace_split = False

    try:
        for token in lexer:
            # Check if token is an operator
            if token in ('&&', '|'):
                # Save current command
                if current_tokens:
                    cmd_str = ' '.join(current_tokens)
                    base_cmd = current_tokens[0]
                    commands.append((base_cmd, cmd_str))
                    current_tokens = []
            else:
                current_tokens.append(token)

        # Add last command
        if current_tokens:
            cmd_str = ' '.join(current_tokens)
            base_cmd = current_tokens[0]
            commands.append((base_cmd, cmd_str))

    except ValueError:
        # If shlex parsing fails (malformed quotes), fall back to original behavior
        # This ensures the hook doesn't break on edge cases
        pass

    return commands


def command_matches_pattern(command, full_command, pattern):
    """
    Check if a command matches a Bash pattern

    Args:
        command: Base command (e.g., "curl")
        full_command: Full command string (e.g., "curl -X POST https://...")
        pattern: Pattern like "Bash(curl -X POST:*)"

    Returns:
        True if matches, False otherwise
    """
    if not pattern.startswith("Bash("):
        return False

    # Extract command from pattern: "Bash(curl -X POST:*)" → "curl -X POST:*"
    cmd_pattern = pattern[5:-1]  # Remove "Bash(" and ")"

    # Remove the :* suffix if present
    if cmd_pattern.endswith(":*"):
        cmd_pattern = cmd_pattern[:-2]

    # Check if full command starts with the pattern
    # This handles both simple (curl:*) and complex (curl -X POST:*) patterns
    return full_command.startswith(cmd_pattern)


def command_is_allowed(command, full_command, patterns):
    """Check if a command matches any allowed Bash pattern"""
    for pattern in patterns:
        if command_matches_pattern(command, full_command, pattern):
            return True
    return False


def command_is_denied(command, full_command, patterns):
    """Check if a command matches any denied Bash pattern"""
    for pattern in patterns:
        if command_matches_pattern(command, full_command, pattern):
            return True
    return False


def no_opinion():
    """Exit with no opinion, suppressing output to avoid visual noise"""
    print(json.dumps({"suppressOutput": True, "continue": True}))
    sys.exit(0)


def main():
    """Main hook logic"""
    input_data = json.load(sys.stdin)

    # Only process Bash tool calls
    if input_data.get("tool_name") != "Bash":
        no_opinion()

    command = input_data.get("tool_input", {}).get("command", "")

    # Check if it's a && or | chain
    if " && " not in command and " | " not in command:
        # Not a chain, let normal permissions handle it
        no_opinion()

    # Load permission patterns from settings.json
    patterns = load_permission_patterns()
    allowed_patterns = patterns["allow"]
    denied_patterns = patterns["deny"]

    if not allowed_patterns:
        # No patterns configured, let normal permissions handle it
        no_opinion()

    # Extract individual commands from chain
    commands = extract_commands(command)

    # Check if ANY command is explicitly denied
    for base_cmd, full_cmd in commands:
        is_denied = command_is_denied(base_cmd, full_cmd, denied_patterns)
        if is_denied:
            # At least one command is denied - DO NOT approve
            # Let the normal permission system block it
            no_opinion()

    # Check if ALL commands in chain are individually allowed
    all_allowed = all(
        command_is_allowed(base_cmd, full_cmd, allowed_patterns)
        for base_cmd, full_cmd in commands
    )

    if all_allowed:
        # All commands are allowed individually AND none are denied
        # Output JSON to explicitly approve the chain
        result = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "permissionDecisionReason": "All commands in chain are individually allowed"
            },
            "continue": True
        }
        print(json.dumps(result))
        sys.exit(0)

    # Not all commands allowed - do NOT approve, let permissions system decide
    no_opinion()


if __name__ == "__main__":
    main()
