#!/usr/bin/env bash
# PreToolUse hook — auto-approve Bash commands that trigger known
# false-positive security heuristics in Claude Code.
#
# Two conditions must BOTH be true for auto-approval:
#   1. The command triggers a pattern in heuristic-patterns.txt
#   2. The first command in the chain starts with a tool already in
#      settings.json permissions.allow  (reads it live — no sync needed)
#
# Only the leading command is checked — subsequent segments in compound
# commands go through the normal permission flow if not already allowed.
#
# Evolutionary: /allow adds Bash(tool:*) → hook picks it up automatically.
#               New heuristic patterns → add a line to heuristic-patterns.txt.

set -euo pipefail

HOOKS_DIR="$HOME/.claude/hooks"
HEURISTICS="$HOOKS_DIR/heuristic-patterns.txt"
SETTINGS="$HOME/.claude/settings.json"

INPUT=$(cat)

TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
test "$TOOL" = "Bash" || exit 0

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
test -n "$CMD" || exit 0

# --- 1. Does the command trigger a known false-positive heuristic? --------
test -f "$HEURISTICS" || exit 0

hit=false
while IFS= read -r pat; do
  case "$pat" in "" | \#*) continue ;; esac
  if printf '%s' "$CMD" | perl -0777 -ne "exit(/$pat/ ? 0 : 1)" 2>/dev/null; then
    hit=true
    break
  fi
done < "$HEURISTICS"
$hit || exit 0

# --- 2. Extract allowed tool prefixes from settings.json -----------------
test -f "$SETTINGS" || exit 0

ALLOWED=$(jq -r '
  .permissions.allow // [] | .[] |
  if . == "Bash" then "__ALLOW_ALL__"
  elif startswith("Bash(") then
    ltrimstr("Bash(") | split(":")[0] | split(" ")[0]
  else empty end
' "$SETTINGS" 2>/dev/null)

test -n "$ALLOWED" || exit 0

# If "Bash" (bare) is in the allowlist, approve everything
if printf '%s\n' "$ALLOWED" | grep -qxF "__ALLOW_ALL__"; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'
  exit 0
fi

# --- 3. Check that the leading command is in the allowlist ----------------
FIRST=$(printf '%s' "$CMD" | awk '{print $1}')
if printf '%s\n' "$ALLOWED" | grep -qxF "$FIRST"; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'
fi
