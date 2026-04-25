#!/usr/bin/env bash
# Activate the Ghostty window/tab whose focused terminal has the given TTY.
# Usage: ghostty-focus.sh /dev/ttysNNN

set -euo pipefail

target_tty="${1:-}"
[ -z "$target_tty" ] && { echo "usage: $0 <tty>" >&2; exit 1; }

osascript <<APPLESCRIPT
tell application "Ghostty"
  repeat with w in windows
    repeat with t in tabs of w
      set termList to terminals of t
      repeat with i from 1 to count of termList
        set thisTerm to item i of termList
        if tty of thisTerm is "$target_tty" then
          focus thisTerm
          return
        end if
      end repeat
    end repeat
  end repeat
end tell
APPLESCRIPT
