#!/usr/bin/env python3
"""
PreToolUse Hook: Block commits with ERROR-MASKING fallback patterns.

Intelligently distinguishes between:
- BAD fallbacks: Mask errors with fake data (BLOCK)
- GOOD fallbacks: Type conversion, env defaults, booleans (ALLOW)

Based on user's No Fallbacks rule from CLAUDE.md.
"""

import json
import sys
import subprocess
import re


# =============================================================================
# BAD FALLBACKS - These mask errors and should be BLOCKED
# =============================================================================
BAD_PATTERNS = [
    # Masks missing data with fake string
    (re.compile(r'\?\?\s*[\'"][^\'"]+[\'"]'), 'Masking with fake string'),

    # Returns empty collection instead of handling error
    (re.compile(r'\?\?\s*\[\]'), 'Silently returns empty array'),
    (re.compile(r'\?\?\s*\{\}'), 'Silently returns empty object'),

    # OR with fake values
    (re.compile(r'\|\|\s*[\'"][^\'"]+[\'"]'), 'OR with fake string'),
    (re.compile(r'\|\|\s*\[\]'), 'OR returns empty array'),
    (re.compile(r'\|\|\s*\{\}'), 'OR returns empty object'),

    # Boolean defaults - can mask missing boolean data
    (re.compile(r'\?\?\s*(true|false)\b'), 'Boolean fallback masks missing data'),
    (re.compile(r'\|\|\s*(true|false)\b'), 'OR with boolean masks missing data'),

    # Numeric defaults - can mask missing numeric data
    (re.compile(r'\?\?\s*\d+'), 'Numeric fallback masks missing data'),
    (re.compile(r'\|\|\s*\d+'), 'OR with number masks missing data'),

    # Environment variable defaults - should crash if missing
    (re.compile(r'process\.env\.\w+\s*\|\|'), 'Env var should crash if missing'),
    (re.compile(r'import\.meta\.env\.\w+\s*\|\|'), 'Env var should crash if missing'),

    # UI fallback strings that hide errors from users
    (re.compile(r'[\'"](?:No data|Unknown|N\/A|Not found|Loading failed|Error occurred)[\'"]', re.I),
     'UI error masking'),

    # Creating fake objects to avoid null checks
    (re.compile(r'\?\?\s*\{\s*\w+\s*:'), 'Creates fake object'),
]


# =============================================================================
# ALLOWED FALLBACKS - ONLY truly safe patterns
# =============================================================================
ALLOWED_PATTERNS = [
    # Type conversion (null -> undefined) - the ONLY truly safe fallback
    re.compile(r'\?\?\s*undefined'),

    # Intentional fallback with explicit comment (user acknowledged)
    re.compile(r'//.*intentional', re.I),
    re.compile(r'//.*fallback.*ok', re.I),
]


# =============================================================================
# EXCLUSION PATTERNS - Skip these lines entirely
# =============================================================================
COMMENT_PATTERNS = [
    re.compile(r'^\s*//'),      # Single-line comment
    re.compile(r'^\s*\*'),      # Multi-line comment content
    re.compile(r'^\s*/\*'),     # Multi-line comment start
    re.compile(r'^\s*#'),       # Hash comment (Python, shell)
]

# Only scan these file types
CODE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}

# Skip test files
SKIP_PATTERNS = [
    re.compile(r'\.test\.[tj]sx?$'),
    re.compile(r'\.spec\.[tj]sx?$'),
    re.compile(r'\.d\.ts$'),
    re.compile(r'__tests__'),
    re.compile(r'__mocks__'),
]


def should_check_file(filepath):
    """Check if file should be scanned for fallback patterns."""
    # Must be a code file
    if not any(filepath.endswith(ext) for ext in CODE_EXTENSIONS):
        return False

    # Skip test files
    if any(pattern.search(filepath) for pattern in SKIP_PATTERNS):
        return False

    return True


def is_allowed(line):
    """Check if line matches any allowed pattern."""
    return any(pattern.search(line) for pattern in ALLOWED_PATTERNS)


def is_comment(line):
    """Check if line is a comment."""
    return any(pattern.match(line) for pattern in COMMENT_PATTERNS)


def check_line(line):
    """
    Check line for bad fallback patterns.

    Returns:
        Tuple of (pattern_str, reason) if violation found, None otherwise.
    """
    # Skip comments
    if is_comment(line):
        return None

    # Skip allowed patterns (legitimate fallbacks)
    if is_allowed(line):
        return None

    # Check against bad patterns
    for pattern, reason in BAD_PATTERNS:
        if pattern.search(line):
            return (pattern.pattern, reason)

    return None


def scan_staged_files():
    """Scan staged files for bad fallback patterns."""
    # Get list of staged files
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []  # Git command failed, don't block

    files = [f for f in result.stdout.strip().split('\n')
             if f and should_check_file(f)]

    violations = []

    for filepath in files:
        # Get diff for this file with no context lines
        diff_result = subprocess.run(
            ["git", "diff", "--cached", "-U0", filepath],
            capture_output=True,
            text=True
        )

        if diff_result.returncode != 0:
            continue

        line_num = 0

        for line in diff_result.stdout.split('\n'):
            # Track line numbers from @@ -a,b +c,d @@ headers
            if line.startswith('@@'):
                match = re.search(r'\+(\d+)', line)
                if match:
                    line_num = int(match.group(1)) - 1
                continue

            # Only check added lines (not removed or context)
            if line.startswith('+') and not line.startswith('+++'):
                line_num += 1
                content = line[1:]  # Remove + prefix

                result = check_line(content)
                if result:
                    violations.append({
                        'file': filepath,
                        'line': line_num,
                        'code': content.strip()[:80],  # Truncate long lines
                        'reason': result[1]
                    })

    return violations


def deny_commit(violations):
    """Output JSON to block the commit with violation details."""
    msg = "BLOCKED: Error-masking fallback patterns detected\n\n"

    for v in violations:
        msg += f"{v['file']}:{v['line']}: {v['code']}\n"
        msg += f"  -> {v['reason']}\n\n"

    msg += "These fallbacks mask real errors. Fix them by:\n"
    msg += "- Let it fail explicitly with proper error handling\n"
    msg += "- Or add comment '// intentional fallback' if truly needed\n\n"
    msg += "Allowed: ?? undefined, ?? 0, ?? false, process.env defaults"

    result = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": msg
        },
        "continue": False
    }
    print(json.dumps(result))
    sys.exit(0)


def main():
    """Main hook logic."""
    input_data = json.load(sys.stdin)

    # Only process Bash tool calls
    if input_data.get("tool_name") != "Bash":
        return  # No opinion

    command = input_data.get("tool_input", {}).get("command", "")

    # Only process git commit commands
    if not command.strip().startswith("git commit"):
        return  # No opinion

    # Scan staged files for violations
    violations = scan_staged_files()

    if violations:
        deny_commit(violations)

    # No violations found - let commit proceed (output nothing)


if __name__ == "__main__":
    main()
