#!/usr/bin/env bash
# Stop hook: notify when Claude finishes; click focuses the originating Ghostty tab.
# Identifies the source terminal via the parent process TTY and matches it against
# Ghostty's AppleScript surface list.

set -euo pipefail

input=$(cat)

session_id=$(printf '%s' "$input" | jq -r '.session_id // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

claude_pid="$PPID"
tty_short=$(ps -o tty= -p "$claude_pid" 2>/dev/null | tr -d ' \n' || true)

# Bail out silently if we can't resolve a TTY (not running inside a real terminal).
[ -z "$tty_short" ] || [ "$tty_short" = "??" ] && exit 0
target_tty="/dev/$tty_short"

# Skip if Ghostty is already frontmost on the originating tab — no need to interrupt.
front_tty=$(osascript <<'APPLESCRIPT' 2>/dev/null || true
tell application "Ghostty"
  if not frontmost then return ""
  try
    return tty of (focused terminal of selected tab of front window)
  on error
    return ""
  end try
end tell
APPLESCRIPT
)
[ "$front_tty" = "$target_tty" ] && exit 0

folder=""
[ -n "$cwd" ] && folder=$(basename "$cwd")

branch=""
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null || true)
fi

subtitle="$folder"
[ -n "$branch" ] && subtitle="$folder · $branch"
[ -z "$subtitle" ] && subtitle="Claude"

group="claude-${session_id:-$tty_short}"

terminal-notifier \
  -title "Claude terminé" \
  -subtitle "$subtitle" \
  -message "Cliquer pour revenir à la fenêtre" \
  -group "$group" \
  -sound default \
  -execute "$HOME/.claude/hooks/ghostty-focus.sh $target_tty" \
  >/dev/null 2>&1 &

exit 0
