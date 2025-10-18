#!/bin/zsh
# Git Worktree Manager - Centralized worktree management
#
# Manages git worktrees in a centralized location (~/development/worktrees)
# with organized naming and easy navigation

# Remove any existing aliases to avoid conflicts
unalias wt 2>/dev/null
unalias wtn 2>/dev/null
unalias wts 2>/dev/null
unalias wtl 2>/dev/null
unalias wtd 2>/dev/null
unalias wtc 2>/dev/null

# ============================================================================
# CONSTANTS AND CONFIGURATION
# ============================================================================

# Worktrees base directory
[[ -z "$WORKTREES_BASE" ]] && readonly WORKTREES_BASE="$HOME/development/worktrees"

# State file for tracking worktrees
[[ -z "$WORKTREE_STATE_FILE" ]] && readonly WORKTREE_STATE_FILE="$HOME/.config/worktree-state.json"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check if we're in a git repository
is_git_repo() {
    git rev-parse --git-dir > /dev/null 2>&1
}

# Validate dependencies
validate_dependencies() {
    if ! is_git_repo; then
        echo "❌ Not in a git repository"
        return 1
    fi

    if ! command_exists fzf; then
        echo "❌ fzf is required for interactive selection. Install it with: brew install fzf"
        return 1
    fi

    return 0
}

# Get current project name from git remote or directory
get_project_name() {
    local project_name

    # Try to get from git remote first
    local remote_url=$(git config --get remote.origin.url 2>/dev/null)

    if [ -n "$remote_url" ]; then
        # Extract project name from URL
        project_name=$(echo "$remote_url" | sed -E 's#.*/([^/]+)(\.git)?$#\1#' | sed 's/\.git$//')
    else
        # Fallback to directory name
        project_name=$(basename "$(git rev-parse --show-toplevel)")
    fi

    echo "$project_name"
}

# Get git root directory
get_git_root() {
    git rev-parse --show-toplevel
}

# Normalize name for worktree directory (only alphanumeric and dashes)
normalize_name() {
    echo "$1" | sed -E 's/[^a-zA-Z0-9-]/-/g' | sed -E 's/-+/-/g' | sed -E 's/^-+|-+$//g'
}

# Initialize state file if it doesn't exist
init_state_file() {
    if [ ! -f "$WORKTREE_STATE_FILE" ]; then
        mkdir -p "$(dirname "$WORKTREE_STATE_FILE")"
        echo '{"worktrees": {}, "created": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' > "$WORKTREE_STATE_FILE"
    fi
}

# Add worktree to state
add_to_state() {
    local project="$1"
    local branch="$2"
    local wt_path="$3"
    local git_root="$4"

    init_state_file

    # Use jq to update the JSON, or fallback to manual update
    if command_exists jq; then
        local temp_file=$(mktemp)
        jq --arg proj "$project" \
           --arg br "$branch" \
           --arg p "$wt_path" \
           --arg gr "$git_root" \
           '.worktrees[$proj + "/" + $br] = {
               "path": $p,
               "branch": $br,
               "project": $proj,
               "git_root": $gr,
               "created": (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
           }' "$WORKTREE_STATE_FILE" > "$temp_file"
        mv "$temp_file" "$WORKTREE_STATE_FILE"
    fi
}

# Remove worktree from state
remove_from_state() {
    local project="$1"
    local branch="$2"

    if [ -f "$WORKTREE_STATE_FILE" ] && command_exists jq; then
        local temp_file=$(mktemp)
        jq --arg proj "$project" \
           --arg br "$branch" \
           'del(.worktrees[$proj + "/" + $br])' "$WORKTREE_STATE_FILE" > "$temp_file"
        mv "$temp_file" "$WORKTREE_STATE_FILE"
    fi
}

# Get all worktrees for current project from git
get_project_worktrees() {
    local git_root=$(get_git_root)
    git worktree list --porcelain | awk -v root="$git_root" '
        /^worktree / { path = substr($0, 10) }
        /^branch / {
            branch = substr($0, 8)
            gsub(/^refs\/heads\//, "", branch)
            if (path != root) {
                print path "|" branch
            }
            path = ""
            branch = ""
        }
    '
}

# Check if branch exists
branch_exists() {
    git show-ref --verify --quiet "refs/heads/$1"
}

# ============================================================================
# WORKTREE COMMANDS
# ============================================================================

# Create new worktree
wt_new() {
    local branch_name="$1"

    if [ -z "$branch_name" ]; then
        echo "❌ Branch name required"
        echo "Usage: wt new <branch-name>"
        return 1
    fi

    local project=$(get_project_name)
    local git_root=$(get_git_root)
    local normalized_project=$(normalize_name "$project")
    local normalized_branch=$(normalize_name "$branch_name")
    local worktree_name="${normalized_project}-${normalized_branch}"
    local worktree_path="${WORKTREES_BASE}/${worktree_name}"

    # Check if worktree already exists
    if [ -d "$worktree_path" ]; then
        echo "⚠️  Worktree already exists at: $worktree_path"
        echo -n "📂 Navigate to it? (Y/n): "
        read -r response
        case $response in
            [Nn]|no)
                return 0
                ;;
            *)
                if cd "$worktree_path" 2>/dev/null; then
                    echo "✅ Switched to worktree: $worktree_path"
                else
                    echo "❌ Failed to switch to worktree: $worktree_path"
                fi
                return 0
                ;;
        esac
    fi

    # Create base directory if it doesn't exist
    mkdir -p "$WORKTREES_BASE"

    echo "📦 Project: $project"
    echo "🌿 Branch: $branch_name"
    echo "📂 Path: $worktree_path"
    echo ""

    # Check if branch exists
    if branch_exists "$branch_name"; then
        echo "✅ Branch exists, creating worktree..."
        if git worktree add "$worktree_path" "$branch_name"; then
            add_to_state "$project" "$branch_name" "$worktree_path" "$git_root"
            if cd "$worktree_path" 2>/dev/null; then
                echo ""
                echo "✅ Worktree created and switched!"
                echo "📍 You are now in: $worktree_path"
            else
                echo ""
                echo "⚠️  Worktree created but failed to switch to: $worktree_path"
            fi
        else
            echo "❌ Failed to create worktree"
            return 1
        fi
    else
        echo "⚠️  Branch does not exist"
        echo -n "📝 Create new branch from current HEAD? (Y/n): "
        read -r response
        case $response in
            [Nn]|no)
                echo "❌ Operation cancelled"
                return 0
                ;;
            *)
                if git worktree add -b "$branch_name" "$worktree_path"; then
                    add_to_state "$project" "$branch_name" "$worktree_path" "$git_root"
                    if cd "$worktree_path" 2>/dev/null; then
                        echo ""
                        echo "✅ Branch and worktree created and switched!"
                        echo "📍 You are now in: $worktree_path"
                    else
                        echo ""
                        echo "⚠️  Worktree created but failed to switch to: $worktree_path"
                    fi
                else
                    echo "❌ Failed to create worktree"
                    return 1
                fi
                ;;
        esac
    fi
}

# Switch to existing worktree
wt_switch() {
    local target_branch="$1"
    local worktrees=$(get_project_worktrees)

    if [ -z "$worktrees" ]; then
        echo "❌ No worktrees found for this project"
        echo "💡 Create one with: wt new <branch-name>"
        return 1
    fi

    # If branch name provided, switch directly
    if [ -n "$target_branch" ]; then
        local target_path=""
        while IFS='|' read -r wt_path branch; do
            if [ "$branch" = "$target_branch" ]; then
                target_path="$wt_path"
                break
            fi
        done <<< "$worktrees"

        if [ -z "$target_path" ]; then
            echo "❌ No worktree found for branch: $target_branch"
            echo ""
            echo "Available branches:"
            while IFS='|' read -r wt_path branch; do
                echo "  - $branch"
            done <<< "$worktrees"
            return 1
        fi

        if [ -d "$target_path" ]; then
            if cd "$target_path" 2>/dev/null; then
                echo "✅ Switched to: $target_path"
                return 0
            else
                echo "❌ Failed to switch to: $target_path"
                return 1
            fi
        else
            echo "❌ Worktree path not found: $target_path"
            return 1
        fi
    fi

    # Interactive mode with fzf
    local current_dir=$(pwd)
    local selected=$(echo "$worktrees" | while IFS='|' read -r wt_path branch; do
        if [ "$wt_path" = "$current_dir" ]; then
            echo "✓ $branch → $wt_path"
        else
            echo "  $branch → $wt_path"
        fi
    done | fzf \
        --prompt="Switch to worktree: " \
        --height=40% \
        --border \
        --header="Select worktree to switch to (↑↓ to navigate, Enter to select)" \
        --preview-window=hidden)

    if [ -z "$selected" ]; then
        echo "❌ No worktree selected"
        return 1
    fi

    # Extract path from selection (remove prefix and extract after →)
    local target_path=$(echo "$selected" | sed -E 's/^[✓ ]+//' | sed -E 's/.* → //')

    if [ -d "$target_path" ]; then
        if cd "$target_path" 2>/dev/null; then
            echo "✅ Switched to: $target_path"
        else
            echo "❌ Failed to switch to: $target_path"
            return 1
        fi
    else
        echo "❌ Worktree path not found: $target_path"
        return 1
    fi
}

# List all worktrees
wt_list() {
    local worktrees=$(get_project_worktrees)

    if [ -z "$worktrees" ]; then
        echo "📋 No worktrees found for this project"
        echo "💡 Create one with: wt new <branch-name>"
        return 0
    fi

    local project=$(get_project_name)
    echo "📦 Project: $project"
    echo ""
    echo "🌿 Worktrees:"

    local current_dir=$(pwd)
    while IFS='|' read -r wt_path branch; do
        if [ "$wt_path" = "$current_dir" ]; then
            echo "  ✓ $branch"
        else
            echo "    $branch"
        fi
        echo "      📂 $wt_path"
    done <<< "$worktrees"
}

# Show status of all worktrees
wt_status() {
    local worktrees=$(get_project_worktrees)

    if [ -z "$worktrees" ]; then
        echo "📋 No worktrees found for this project"
        return 0
    fi

    local project=$(get_project_name)
    echo "📦 Project: $project"
    echo ""

    while IFS='|' read -r wt_path branch; do
        echo "🌿 $branch"
        echo "   📂 $wt_path"

        if [ -d "$wt_path" ]; then
            local status=$(cd "$wt_path" && git status --short)
            if [ -z "$status" ]; then
                echo "   ✅ Clean working tree"
            else
                echo "   📝 Changes:"
                echo "$status" | head -5 | sed 's/^/      /'
                local count=$(echo "$status" | wc -l | tr -d ' ')
                if [ "$count" -gt 5 ]; then
                    echo "      ... and $((count - 5)) more"
                fi
            fi
        else
            echo "   ❌ Path not found"
        fi
        echo ""
    done <<< "$worktrees"
}

# Clean up worktrees
wt_clean() {
    local worktrees=$(get_project_worktrees)
    local project=$(get_project_name)

    if [ -z "$worktrees" ]; then
        echo "📋 No worktrees to clean"
        return 0
    fi

    echo "🧹 Cleanup mode for project: $project"
    echo ""
    echo "Select worktrees to remove (Space to select, Enter to confirm):"
    echo ""

    local selected=$(echo "$worktrees" | while IFS='|' read -r wt_path branch; do
        echo "$branch|$wt_path"
    done | fzf \
        --multi \
        --prompt="Select worktrees to remove: " \
        --height=60% \
        --border \
        --header="Space to select, Enter to confirm, Ctrl-C to cancel" \
        --preview='echo "Branch: {1}\nPath: {2}"' \
        --preview-window=up:3 \
        --delimiter='|')

    if [ -z "$selected" ]; then
        echo "❌ No worktrees selected"
        return 0
    fi

    echo ""
    echo "📋 Worktrees to remove:"
    while IFS='|' read -r branch wt_path; do
        echo "  - $branch ($wt_path)"
    done <<< "$selected"
    echo ""
    echo -n "⚠️  Remove these worktrees? (y/N): "
    read -r confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        return 0
    fi

    echo ""
    while IFS='|' read -r branch wt_path; do
        echo "🗑️  Removing worktree: $branch"
        if git worktree remove "$wt_path" --force 2>/dev/null; then
            echo "   ✅ Removed from git"
        else
            echo "   ⚠️  Failed to remove from git, removing directory..."
        fi

        if [ -d "$wt_path" ]; then
            rm -rf "$wt_path"
            echo "   ✅ Removed directory"
        fi

        remove_from_state "$project" "$branch"
    done <<< "$selected"

    echo ""
    echo "✅ Cleanup complete!"
}

# Show help
wt_help() {
    echo "Git Worktree Manager - Centralized worktree management"
    echo ""
    echo "USAGE:"
    echo "    wt <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "    new <branch>      Create new worktree for branch"
    echo "    switch            Switch to existing worktree (interactive)"
    echo "    list              List all worktrees for current project"
    echo "    status            Show git status for all worktrees"
    echo "    clean             Remove worktrees (interactive)"
    echo "    help              Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "    wt new feature-auth              Create worktree for branch 'feature-auth'"
    echo "    wt switch                        Interactive worktree selection"
    echo "    wt list                          List all worktrees"
    echo "    wt status                        Show status of all worktrees"
    echo "    wt clean                         Clean up worktrees"
    echo ""
    echo "WORKTREE LOCATION:"
    echo "    All worktrees are stored in: ~/development/worktrees"
    echo "    Format: {project-name}-{branch-name}"
    echo ""
    echo "ALIASES:"
    echo "    wtn    Alias for 'wt new'"
    echo "    wts    Alias for 'wt switch'"
    echo "    wtl    Alias for 'wt list'"
    echo "    wtd    Alias for 'wt status'"
    echo "    wtc    Alias for 'wt clean'"
    echo ""
    echo "REQUIREMENTS:"
    echo "    - Git repository"
    echo "    - fzf (fuzzy finder)"
    echo "    - jq (optional, for state management)"
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

# Main function
wt() {
    local command="$1"

    # Only shift if there are arguments
    if [ $# -gt 0 ]; then
        shift
    fi

    case "$command" in
        new)
            if ! validate_dependencies; then
                return 1
            fi
            wt_new "$@"
            ;;
        switch)
            if ! validate_dependencies; then
                return 1
            fi
            wt_switch "$@"
            ;;
        list)
            if ! is_git_repo; then
                echo "❌ Not in a git repository"
                return 1
            fi
            wt_list "$@"
            ;;
        status)
            if ! is_git_repo; then
                echo "❌ Not in a git repository"
                return 1
            fi
            wt_status "$@"
            ;;
        clean)
            if ! validate_dependencies; then
                return 1
            fi
            wt_clean "$@"
            ;;
        help|--help|-h|"")
            wt_help
            ;;
        *)
            echo "❌ Unknown command: $command"
            echo ""
            wt_help
            return 1
            ;;
    esac
}

# ============================================================================
# CONVENIENCE ALIASES (as functions)
# ============================================================================

wtn() { wt new "$@"; }
wts() { wt switch "$@"; }
wtl() { wt list "$@"; }
wtd() { wt status "$@"; }
wtc() { wt clean "$@"; }

