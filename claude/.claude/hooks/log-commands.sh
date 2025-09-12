#!/bin/bash
# Hook: PostToolUse - log-commands.sh
# Description: Logs all bash commands executed by Claude Code with timestamp and context

HOOK_EVENT="$1"
TOOL_NAME="$2"
TOOL_INPUT="$3"

# Only log Bash tool usage
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

# Extract command and description from tool input
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty')
DESCRIPTION=$(echo "$TOOL_INPUT" | jq -r '.description // "No description"')

# Skip if no command found
if [ -z "$COMMAND" ]; then
    exit 0
fi

# Get current working directory and git info
CURRENT_DIR=$(pwd)
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "no-git")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Log file location
LOG_FILE="$HOME/.claude/command-history.log"

# Create log entry
LOG_ENTRY="[$TIMESTAMP] [$GIT_BRANCH] [$CURRENT_DIR] $COMMAND - $DESCRIPTION"

# Append to log file
echo "$LOG_ENTRY" >> "$LOG_FILE"

# Keep only last 1000 entries to prevent log file from growing too large
tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"