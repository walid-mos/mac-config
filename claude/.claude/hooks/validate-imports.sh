#!/bin/bash
# Hook: PreToolUse - validate-imports.sh
# Description: Validates import statements before editing files to enforce coding standards

HOOK_EVENT="$1"
TOOL_NAME="$2"
TOOL_INPUT="$3"

# Only check Edit and MultiEdit operations
if [ "$TOOL_NAME" != "Edit" ] && [ "$TOOL_NAME" != "MultiEdit" ]; then
    exit 0
fi

# Extract file path from tool input
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')

# Skip if no file path found
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Only validate TypeScript/JavaScript files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
    exit 0
fi

# Extract new string content for validation
NEW_STRING=""
if [ "$TOOL_NAME" == "Edit" ]; then
    NEW_STRING=$(echo "$TOOL_INPUT" | jq -r '.new_string // empty')
elif [ "$TOOL_NAME" == "MultiEdit" ]; then
    NEW_STRING=$(echo "$TOOL_INPUT" | jq -r '.edits[].new_string // empty' | tr '\n' ' ')
fi

# Skip if no new content to validate
if [ -z "$NEW_STRING" ]; then
    exit 0
fi

# Check for forbidden patterns
VIOLATIONS=()

# Check for require() usage
if echo "$NEW_STRING" | grep -q "require("; then
    VIOLATIONS+=("❌ FORBIDDEN: Using require() instead of import statement")
fi

# Check for relative imports that should use TypeScript paths
if echo "$NEW_STRING" | grep -qE "from ['\"]\.\.\/\.\.\/\.\.\/"; then
    VIOLATIONS+=("❌ BAD PRACTICE: Use TypeScript paths (@/) instead of ../../../")
fi

# Check for React default import
if echo "$NEW_STRING" | grep -q "import React from"; then
    VIOLATIONS+=("❌ BAD PRACTICE: Import specific React hooks instead of entire React object")
fi

# Check for IIFE syntax
if echo "$NEW_STRING" | grep -q ";(function()"; then
    VIOLATIONS+=("❌ FORBIDDEN: IIFE syntax is not allowed")
fi

# Check for any usage in TypeScript
if [[ "$FILE_PATH" =~ \.(ts|tsx)$ ]] && echo "$NEW_STRING" | grep -qE ": any[^A-Za-z]"; then
    VIOLATIONS+=("❌ FORBIDDEN: 'any' type is completely forbidden in TypeScript")
fi

# If violations found, report them and exit with error
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
    echo "🚨 IMPORT/CODE VALIDATION FAILED for $FILE_PATH"
    echo ""
    for violation in "${VIOLATIONS[@]}"; do
        echo "  $violation"
    done
    echo ""
    echo "📖 Please fix these issues according to your CLAUDE.md guidelines:"
    echo "  - Always use import instead of require()"
    echo "  - Use TypeScript paths (@/) for deeply nested imports"
    echo "  - Import specific React functions instead of entire React object"
    echo "  - Never use 'any' type in TypeScript"
    echo "  - Avoid IIFE syntax"
    echo ""
    exit 1
fi

# All good, allow the operation
exit 0