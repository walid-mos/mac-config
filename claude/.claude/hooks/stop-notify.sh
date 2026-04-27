#!/usr/bin/env bash
# Stop hook: notify when Claude finishes; click focuses the originating Ghostty tab.
# Only fires when Claude's pty is owned by a Ghostty surface — skips nested
# terminals like cmux/tmux whose inner pty isn't in Ghostty's surface list.

set -euo pipefail

input=$(cat)

session_id=$(printf '%s' "$input" | jq -r '.session_id // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

claude_pid="$PPID"
tty_short=$(ps -o tty= -p "$claude_pid" 2>/dev/null | tr -d ' \n' || true)

# Bail out silently if we can't resolve a TTY (not running inside a real terminal).
[ -z "$tty_short" ] || [ "$tty_short" = "??" ] && exit 0
target_tty="/dev/$tty_short"

ghostty_info=$(osascript <<'APPLESCRIPT' 2>/dev/null || true
if application "Ghostty" is running then
  tell application "Ghostty"
    set frontTty to ""
    try
      if frontmost then set frontTty to tty of (focused terminal of selected tab of front window)
    end try
    set allTtys to ""
    try
      repeat with w in windows
        repeat with t in tabs of w
          repeat with term in terminals of t
            set allTtys to allTtys & (tty of term) & "|"
          end repeat
        end repeat
      end repeat
    end try
    return frontTty & "###" & allTtys
  end tell
end if
APPLESCRIPT
)

front_tty="${ghostty_info%%###*}"
all_ttys="${ghostty_info##*###}"

# Skip if Claude's pty isn't a Ghostty surface (e.g. running inside cmux/tmux).
case "|$all_ttys" in
  *"|$target_tty|"*) ;;
  *) exit 0 ;;
esac

# Skip if Ghostty is already frontmost on the originating tab — no need to interrupt.
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
