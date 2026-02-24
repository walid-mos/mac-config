#!/usr/bin/env bash
# SubagentStop hook — cleans up the agent type marker

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

[ -z "$SESSION_ID" ] && exit 0

rm -f "/tmp/claude/agent-type-${SESSION_ID}"
exit 0
