#!/bin/bash
# Hook: PostToolUse - log-commands.sh
# Description: Logs all bash commands executed by Claude Code with timestamp and context

# Load common library
source "$(dirname "$0")/../lib/common.sh"

HOOK_EVENT="$1"
TOOL_NAME="$2"
TOOL_INPUT="$3"

# Only log Bash tool usage
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

# Parse tool input efficiently (single jq call)
parse_tool_input "$TOOL_INPUT"

# Skip if no command found
if [ -z "$COMMAND" ]; then
    exit 0
fi

# Get git context efficiently
get_git_context

# Get current working directory
CURRENT_DIR=$(pwd)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Log file location
LOG_FILE="$HOME/.claude/command-history.log"

# Create log entry
LOG_ENTRY="[$TIMESTAMP] [$GIT_BRANCH] [$CURRENT_DIR] $COMMAND - $DESCRIPTION"

# Use safe atomic logging
safe_log "$LOG_FILE" "$LOG_ENTRY"