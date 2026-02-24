#!/usr/bin/env bash
# PreToolUse hook — blocks Edit/Write for orchestrator agents
# (lead-agent, iteration-runner) EXCEPT for deliverable files.
#
# Orchestrators spawn Code Agents for all implementation work.
# This hook enforces that boundary at the tool level.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# No session ID → allow (safety fallback)
[ -z "$SESSION_ID" ] && exit 0

# Read which agent type is active for this session
AGENT_FILE="/tmp/claude/agent-type-${SESSION_ID}"
[ ! -f "$AGENT_FILE" ] && exit 0

AGENT_TYPE=$(cat "$AGENT_FILE")

# Only block orchestrator agents
case "$AGENT_TYPE" in
	lead-agent|iteration-runner) ;;
	*) exit 0 ;;
esac

# Allow deliverable files that orchestrators legitimately write
case "$FILE_PATH" in
	*/docs/swarm/*) exit 0 ;;
	*/docs/troubleshooting*) exit 0 ;;
	*/swarm-*-state.json) exit 0 ;;
esac

# Block everything else
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "ORCHESTRATOR WRITE BLOCKED: ${AGENT_TYPE} cannot edit '${FILE_PATH}'. Delegate to Code Agents via Task(subagent_type: 'code-agent')."
  }
}
EOF
exit 0
