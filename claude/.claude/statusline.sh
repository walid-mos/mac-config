#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
COST_RAW=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
LINES_ADDED=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
LINES_REMOVED=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')

# Format cost to 2 decimals
COST=$(printf "%.2f" "$COST_RAW")

# Format duration as Xh Ym Zs
TOTAL_SECS=$((DURATION_MS / 1000))
HOURS=$((TOTAL_SECS / 3600))
MINS=$(((TOTAL_SECS % 3600) / 60))
SECS=$((TOTAL_SECS % 60))

DURATION=""
[ "$HOURS" -gt 0 ] && DURATION="${HOURS}h"
[ "$MINS" -gt 0 ] && DURATION="${DURATION}${MINS}m"
[ "$SECS" -gt 0 ] || [ -z "$DURATION" ] && DURATION="${DURATION}${SECS}s"

# Build git status
GIT_STATUS=""
if git -C "$DIR" rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
    [ -z "$BRANCH" ] && BRANCH="HEAD"

    # Count modified, staged, untracked
    MODIFIED=$(git -C "$DIR" diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    STAGED=$(git -C "$DIR" diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
    UNTRACKED=$(git -C "$DIR" ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

    # Ahead/behind
    AHEAD=$(git -C "$DIR" rev-list --count @{upstream}..HEAD 2>/dev/null || echo 0)
    BEHIND=$(git -C "$DIR" rev-list --count HEAD..@{upstream} 2>/dev/null || echo 0)

    # Stash count
    STASH=$(git -C "$DIR" stash list 2>/dev/null | wc -l | tr -d ' ')

    # Build git indicators with symbols and spacing
    INDICATORS=""
    [ "$MODIFIED" -gt 0 ] && INDICATORS="${INDICATORS}~${MODIFIED} "
    [ "$STAGED" -gt 0 ] && INDICATORS="${INDICATORS}+${STAGED} "
    [ "$UNTRACKED" -gt 0 ] && INDICATORS="${INDICATORS}?${UNTRACKED} "
    [ "$STASH" -gt 0 ] && INDICATORS="${INDICATORS}*${STASH} "
    [ "$AHEAD" -gt 0 ] && INDICATORS="${INDICATORS}^${AHEAD} "
    [ "$BEHIND" -gt 0 ] && INDICATORS="${INDICATORS}v${BEHIND} "

    # Trim trailing space and wrap in brackets
    INDICATORS=$(echo "$INDICATORS" | sed 's/ $//')

    # Build final git status
    GIT_STATUS="$BRANCH"
    [ -n "$INDICATORS" ] && GIT_STATUS="$BRANCH [$INDICATORS]"
fi

# Build segments
LEFT="$MODEL"
CENTER="${DIR##*/}"
[ -n "$GIT_STATUS" ] && CENTER="$CENTER | $GIT_STATUS"
RIGHT="\$${COST} | ${DURATION} | +${LINES_ADDED} -${LINES_REMOVED}"

# Get terminal width: CLAUDE_STATUS_WIDTH > COLUMNS > default 140
# (tput cols returns 80 without TTY which is too narrow for Claude Code)
if [ -n "$CLAUDE_STATUS_WIDTH" ] && [ "$CLAUDE_STATUS_WIDTH" -gt 0 ] 2>/dev/null; then
    WIDTH="$CLAUDE_STATUS_WIDTH"
elif [ -n "$COLUMNS" ] && [ "$COLUMNS" -gt 0 ] 2>/dev/null; then
    WIDTH="$COLUMNS"
else
    WIDTH=140
fi

# Calculate padding
LEFT_LEN=${#LEFT}
CENTER_LEN=${#CENTER}
RIGHT_LEN=${#RIGHT}
TOTAL_LEN=$((LEFT_LEN + CENTER_LEN + RIGHT_LEN))

# Calculate spaces needed
REMAINING=$((WIDTH - TOTAL_LEN))
if [ "$REMAINING" -gt 2 ]; then
    HALF=$((REMAINING / 2))
    PAD_LEFT=$(printf '%*s' "$HALF" '')
    PAD_RIGHT=$(printf '%*s' "$((REMAINING - HALF))" '')
    echo "${LEFT}${PAD_LEFT}${CENTER}${PAD_RIGHT}${RIGHT}"
else
    # Fallback if too narrow
    echo "$LEFT | $CENTER | $RIGHT"
fi
