#!/bin/bash

# Read JSON input from Claude Code
input=$(cat)

# Extract basic info from JSON
model_name=$(echo "$input" | jq -r '.model.display_name')
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir')

# Debug: Save input to file for debugging (comment out when not needed)
# echo "$input" > /tmp/claude_statusline_debug.json

# Extract cost and performance info
total_cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
exceeds_200k=$(echo "$input" | jq -r '.exceeds_200k_tokens // false')
lines_added=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
lines_removed=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')

# Extract session info and try to get token usage from transcript
session_id=$(echo "$input" | jq -r '.session_id // ""')
transcript_path=$(echo "$input" | jq -r '.transcript_path // ""')

# Get token info from the latest message in transcript
last_message_tokens=0
total_input_tokens=0
total_output_tokens=0

if [ -f "$transcript_path" ]; then
    # Get tokens from last message
    last_message_tokens=$(tail -1 "$transcript_path" | jq -r '.message.usage.input_tokens + .message.usage.output_tokens // 0' 2>/dev/null)
    
    # Calculate total tokens from entire conversation
    total_input_tokens=$(jq -s 'map(.message.usage.input_tokens // 0) | add' "$transcript_path" 2>/dev/null || echo 0)
    total_output_tokens=$(jq -s 'map(.message.usage.output_tokens // 0) | add' "$transcript_path" 2>/dev/null || echo 0)
fi

total_tokens=$((total_input_tokens + total_output_tokens))

# Get directory information
current_folder=$(basename "$current_dir")
project_folder=$(basename "$project_dir")

# Initialize git info variables
git_branch=""
commit_status=""
time_since_commit=""
git_info=""

# Check if we're in a git repository
cd "$current_dir" 2>/dev/null
if git rev-parse --git-dir >/dev/null 2>&1; then
    # Get current branch name
    git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    # Get time since last commit
    if git log -1 --format=%ct >/dev/null 2>&1; then
        last_commit_timestamp=$(git log -1 --format=%ct 2>/dev/null)
        current_timestamp=$(date +%s)
        seconds_diff=$((current_timestamp - last_commit_timestamp))
        
        # Convert to human readable format
        if [ $seconds_diff -lt 60 ]; then
            time_since_commit="${seconds_diff}s ago"
        elif [ $seconds_diff -lt 3600 ]; then
            minutes=$((seconds_diff / 60))
            time_since_commit="${minutes}m ago"
        elif [ $seconds_diff -lt 86400 ]; then
            hours=$((seconds_diff / 3600))
            time_since_commit="${hours}h ago"
        else
            days=$((seconds_diff / 86400))
            time_since_commit="${days}d ago"
        fi
    else
        time_since_commit="no commits"
    fi
    
    # Check commit status (pushed vs local)
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
        # Get the upstream branch
        upstream=$(git rev-parse --abbrev-ref @{upstream} 2>/dev/null)
        if [ $? -eq 0 ]; then
            # Compare local and remote commits
            local_commit=$(git rev-parse HEAD 2>/dev/null)
            remote_commit=$(git rev-parse "$upstream" 2>/dev/null)
            
            if [ "$local_commit" = "$remote_commit" ]; then
                commit_status="✓ synced"
            else
                # Check if local is ahead
                ahead=$(git rev-list --count "$upstream"..HEAD 2>/dev/null)
                behind=$(git rev-list --count HEAD.."$upstream" 2>/dev/null)
                
                if [ "$ahead" -gt 0 ] && [ "$behind" -eq 0 ]; then
                    commit_status="↑ ${ahead} ahead"
                elif [ "$ahead" -eq 0 ] && [ "$behind" -gt 0 ]; then
                    commit_status="↓ ${behind} behind"
                elif [ "$ahead" -gt 0 ] && [ "$behind" -gt 0 ]; then
                    commit_status="↕ ${ahead}↑${behind}↓"
                else
                    commit_status="? diverged"
                fi
            fi
        else
            commit_status="⚠ no upstream"
        fi
    else
        commit_status="⚠ no commits"
    fi
    
    # Build git info string with changes info
    changes_summary=""
    if [ "$lines_added" -gt 0 ] || [ "$lines_removed" -gt 0 ]; then
        changes_summary=", +${lines_added}/-${lines_removed}"
    fi
    git_info=" | git: ${git_branch} (${time_since_commit}, ${commit_status}${changes_summary})"
fi

# Build cost and stats info
cost_formatted=$(printf "%.3f" "$total_cost")
token_warning=""
if [ "$exceeds_200k" = "true" ]; then
    token_warning="⚠ 200K+ | "
fi

# Format token info (changes info now in git section)
token_info=""
if [ "$total_tokens" -gt 0 ]; then
    if [ "$last_message_tokens" -gt 0 ]; then
        token_info="Last: ${last_message_tokens}T | Total: ${total_tokens}T | "
    else
        token_info="Total: ${total_tokens}T | "
    fi
fi

stats_info="${token_warning}${token_info}\$${cost_formatted}"

# Get terminal width
term_width=$(tput cols 2>/dev/null || echo 80)

# Build left side of status line
left_status="${model_name} | ${project_folder} → ${current_folder}${git_info}"

# Calculate padding needed for right alignment
left_length=${#left_status}
stats_length=${#stats_info}
padding=$((term_width - left_length - stats_length))

# Ensure we have at least some space
if [ $padding -lt 3 ]; then
    padding=3
fi

# Check if we have enough space for proper justify-between
min_padding=10
needs_two_lines=$((left_length + stats_length + min_padding > term_width))

if [ $needs_two_lines -eq 1 ]; then
    # Two-line layout for narrow terminals with separator line
    printf "%s\n%*s%s\n" "$left_status" "$((term_width - stats_length))" "" "$stats_info"
else
    # Single line with better spacing
    available_space=$((term_width - left_length - stats_length))
    if [ $available_space -lt 3 ]; then
        available_space=3
    fi
    printf "%s%*s%s" "$left_status" "$available_space" "" "$stats_info"
fi