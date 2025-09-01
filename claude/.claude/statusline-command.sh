#!/bin/bash

# Read JSON input from Claude Code
input=$(cat)

# Extract basic info from JSON
model_name=$(echo "$input" | jq -r '.model.display_name')
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir')

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
    
    # Build git info string
    git_info=" | git: ${git_branch} (${time_since_commit}, ${commit_status})"
fi

# Build the complete status line
printf "%s | %s → %s%s" "$model_name" "$project_folder" "$current_folder" "$git_info"