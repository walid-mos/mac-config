#!/usr/bin/env bash
# SubagentStart hook — records the agent type for the session
# Used by guard-orchestrator-writes.sh to identify orchestrator agents

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

[ -z "$SESSION_ID" ] || [ -z "$AGENT_TYPE" ] && exit 0

echo "$AGENT_TYPE" > "/tmp/claude/agent-type-${SESSION_ID}"
exit 0
