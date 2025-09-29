#!/bin/zsh
# Git PR Create with automatic title and description generation

# ============================================================================
# CONSTANTS AND CONFIGURATION
# ============================================================================

# Default branches to check for (in order of preference)
[[ -z "$DEFAULT_BRANCHES" ]] && readonly DEFAULT_BRANCHES=("develop" "main" "master")

# Claude CLI path
[[ -z "$CLAUDE_CLI_PATH" ]] && readonly CLAUDE_CLI_PATH="/Users/walid/Library/pnpm/claude"

# Diff size thresholds
[[ -z "$MAX_LINES_CHANGED" ]] && readonly MAX_LINES_CHANGED=5000
[[ -z "$MAX_DIFF_SIZE" ]] && readonly MAX_DIFF_SIZE=100000
[[ -z "$MAX_FILES_CHANGED" ]] && readonly MAX_FILES_CHANGED=50

# Git diff exclusions
[[ -z "$DIFF_EXCLUSIONS" ]] && readonly DIFF_EXCLUSIONS=(
    ':(exclude)package-lock.json'
    ':(exclude)yarn.lock' 
    ':(exclude)Cargo.lock'
    ':(exclude)*.lock'
    ':(exclude)dist'
    ':(exclude)build'
    ':(exclude)node_modules'
    ':(exclude).next'
    ':(exclude)*.min.js'
    ':(exclude)*.bundle.js'
)

# ============================================================================
# CACHING AND UTILITY FUNCTIONS
# ============================================================================

# Branch cache to avoid repeated git calls
declare -A BRANCH_CACHE=()

# Clear branch cache
clear_branch_cache() {
    BRANCH_CACHE=()
}

# Cached branch check
branch_exists_local_cached() {
    local branch="$1"
    local cache_key="local_$branch"

    if [[ -z "${BRANCH_CACHE[$cache_key]}" ]]; then
        if git show-ref --verify --quiet "refs/heads/$branch"; then
            BRANCH_CACHE[$cache_key]="1"
        else
            BRANCH_CACHE[$cache_key]="0"
        fi
    fi

    [ "${BRANCH_CACHE[$cache_key]}" = "1" ]
}

# Cached remote branch check
branch_exists_remote_cached() {
    local branch="$1"
    local cache_key="remote_$branch"

    if [[ -z "${BRANCH_CACHE[$cache_key]}" ]]; then
        if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
            BRANCH_CACHE[$cache_key]="1"
        else
            BRANCH_CACHE[$cache_key]="0"
        fi
    fi

    [ "${BRANCH_CACHE[$cache_key]}" = "1" ]
}

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

    if ! command_exists gh; then
        echo "❌ GitHub CLI (gh) is not installed. Install it with: brew install gh"
        return 1
    fi

    if ! command_exists fzf; then
        echo "❌ fzf is required for interactive branch selection. Install it with: brew install fzf"
        return 1
    fi

    if [ ! -f "$CLAUDE_CLI_PATH" ]; then
        echo "⚠️  Claude CLI not found at $CLAUDE_CLI_PATH"
        echo "   Will use fallback title generation"
    elif ! command_exists timeout; then
        echo "⚠️  timeout command not available. Claude calls may hang."
    fi

    return 0
}

# Check if branch exists locally
branch_exists_local() {
    git show-ref --verify --quiet "refs/heads/$1"
}

# Check if branch exists on remote
branch_exists_remote() {
    git show-ref --verify --quiet "refs/remotes/origin/$1"
}

# Check if local and remote branches are synced
is_branch_synced() {
    local branch="$1"
    
    if ! branch_exists_local "$branch" || ! branch_exists_remote "$branch"; then
        return 1
    fi
    
    local local_commit=$(git rev-parse "refs/heads/$branch" 2>/dev/null)
    local remote_commit=$(git rev-parse "refs/remotes/origin/$branch" 2>/dev/null)
    
    [ "$local_commit" = "$remote_commit" ]
}

# Get sync status for a branch
get_branch_sync_status() {
    local branch="$1"
    
    if ! branch_exists_local "$branch" || ! branch_exists_remote "$branch"; then
        echo ""
        return
    fi
    
    local ahead=$(git rev-list --count "origin/$branch..$branch" 2>/dev/null || echo "0")
    local behind=$(git rev-list --count "$branch..origin/$branch" 2>/dev/null || echo "0")
    
    if [ "$ahead" != "0" ] && [ "$behind" != "0" ]; then
        echo " ($ahead ahead, $behind behind)"
    elif [ "$ahead" != "0" ]; then
        echo " ($ahead ahead)"
    elif [ "$behind" != "0" ]; then
        echo " ($behind behind)"
    else
        echo ""
    fi
}

# Should include branch in selection
should_include_branch() {
    local branch="$1"
    local current_branch="$2"
    local default_branch="$3"
    
    [ -n "$branch" ] && [ "$branch" != "$current_branch" ] && [ "$branch" != "$default_branch" ]
}

# ============================================================================
# BRANCH SELECTION FUNCTIONS
# ============================================================================

# Get default branch for repository
get_default_branch() {
    for branch in "${DEFAULT_BRANCHES[@]}"; do
        if branch_exists_local_cached "$branch" || branch_exists_remote_cached "$branch"; then
            echo "$branch"
            return 0
        fi
    done
    echo ""
}

# Get all available branches for selection
get_available_branches() {
    local current_branch="$1"
    local default_branch="$2"
    local -a branches=()
    local -A seen_branches=()
    
    # Add default branch first if different from current
    if [ -n "$default_branch" ] && [ "$default_branch" != "$current_branch" ]; then
        branches+=("$default_branch (default)")
        seen_branches["$default_branch"]=1
    fi
    
    # Process local branches
    while IFS= read -r branch; do
        if should_include_branch "$branch" "$current_branch" "$default_branch" && [[ -z "${seen_branches[$branch]}" ]]; then
            if is_branch_synced "$branch"; then
                branches+=("$branch")
            else
                local sync_status=$(get_branch_sync_status "$branch")
                branches+=("$branch (local$sync_status)")
            fi
            seen_branches["$branch"]=1
        fi
    done < <(git branch --format='%(refname:short)')
    
    # Add remote-only branches (branches that exist on remote but not locally)
    while IFS= read -r remote_branch; do
        local branch=$(echo "$remote_branch" | sed 's/origin\///')
        # Skip if it's just "origin" or other non-branch refs
        if [ "$branch" = "origin" ] || [ "$branch" = "HEAD" ] || [[ "$branch" =~ ^origin$ ]]; then
            continue
        fi
        # Only add if branch doesn't exist locally and hasn't been seen yet
        if should_include_branch "$branch" "$current_branch" "$default_branch" && [[ -z "${seen_branches[$branch]}" ]] && ! branch_exists_local_cached "$branch"; then
            branches+=("$branch (remote)")
            seen_branches["$branch"]=1
        fi
    done < <(git branch -r --format='%(refname:short)' | grep -v 'origin/HEAD' | grep -v '^origin$')
    
    printf '%s\n' "${branches[@]}"
}

# Interactive branch selection with fzf
select_target_branch() {
    local current_branch="$1"
    local default_branch=$(get_default_branch)
    
    local branches_output=$(get_available_branches "$current_branch" "$default_branch")
    
    if [ -z "$branches_output" ]; then
        echo "❌ No target branches available (current: $current_branch)" >&2
        return 1
    fi
    
    local selected=$(echo "$branches_output" | fzf \
        --prompt="Target branch: " \
        --height=40% \
        --border \
        --header="Select target branch for PR (↑↓ to navigate, Enter to select)" \
        --preview-window=hidden)
    
    if [ -z "$selected" ]; then
        echo "❌ No branch selected" >&2
        return 1
    fi
    
    # Extract branch name (remove annotations)
    echo "$selected" | sed -E 's/ \([^)]+\)$//'
}

# ============================================================================
# PR MANAGEMENT FUNCTIONS
# ============================================================================

# Find existing PR for branch and base
find_existing_pr() {
    local head_branch="$1"
    local base_branch="$2"
    
    if [ -n "$base_branch" ]; then
        gh pr list --head "$head_branch" --base "$base_branch" --json number,url --jq '.[0]'
    else
        gh pr list --head "$head_branch" --json number,url,baseRefName --jq '.[0]'
    fi
}

# Handle existing PR interaction
handle_existing_pr() {
    local pr_info="$1"
    local pr_number=$(echo "$pr_info" | jq -r '.number')
    local pr_url=$(echo "$pr_info" | jq -r '.url')
    
    echo ""
    echo "⚠️  A PR already exists for this branch:"
    echo "   PR #$pr_number: $pr_url"
    echo ""
    
    local choice=$(printf "View existing PR in browser\nUpdate existing PR description\nCancel operation" | fzf \
        --prompt="Choose action: " \
        --height=40% \
        --border \
        --header="Select what to do with existing PR" \
        --preview-window=hidden)
    
    case "$choice" in
        "View existing PR in browser")
            echo "🌐 Opening PR in browser..."
            gh pr view "$pr_number" --web
            return 2
            ;;
        "Update existing PR description")
            echo "🔄 Updating existing PR description..."
            return 1
            ;;
        *)
            echo "❌ Operation cancelled"
            return 0
            ;;
    esac
}

# Create or update PR
create_or_update_pr() {
    local mode="$1"  # "create" or "update"
    local pr_number="$2"  # only for update
    local title="$3"
    local body="$4"
    local target_branch="$5"
    local current_branch="$6"
    
    if [ "$mode" = "create" ]; then
        echo "📝 Creating PR: $title"
        gh pr create \
            --title "$title" \
            --body "$body" \
            --base "$target_branch" \
            --head "$current_branch"
    else
        echo "📝 Updating PR #$pr_number: $title"
        gh pr edit "$pr_number" --body "$body"
    fi
}

# ============================================================================
# PROGRESS INDICATORS
# ============================================================================

# Simple spinner for long operations
show_spinner() {
    local pid=$1
    local message="$2"
    local spin='⣾⣽⣻⢿⡿⣟⣯⣷'
    local i=0

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r%s %s" "${spin:$i:1}" "$message"
        i=$(( (i+1) % ${#spin} ))
        sleep 0.1
    done
    printf "\r✅ %s\n" "$message"
}

# ============================================================================
# AI GENERATION FUNCTIONS
# ============================================================================

# Safe Claude CLI wrapper with timeout
call_claude_cli() {
    local input="$1"
    local timeout_seconds="${2:-30}"

    if [ ! -f "$CLAUDE_CLI_PATH" ]; then
        return 1
    fi

    if command_exists timeout; then
        echo "$input" | timeout "$timeout_seconds" "$CLAUDE_CLI_PATH" 2>&1
    else
        echo "$input" | "$CLAUDE_CLI_PATH" 2>&1
    fi
}

# Generate PR title using Claude CLI
generate_ai_title() {
    local target_branch="$1"
    local current_branch="$2"
    
    local commits=$(git log "$target_branch..$current_branch" --oneline --no-merges)
    local files=$(git diff "$target_branch...$current_branch" --name-only | head -10)
    
    local claude_input="Generate a descriptive English PR title (max 70 characters) that clearly explains what this PR accomplishes from a user/business perspective.

Style guidelines:
- Use natural English sentences, not commitlint format (no \"feat:\", \"fix:\", etc.)
- Focus on WHAT the change does, not HOW it's implemented  
- Make it readable for non-technical stakeholders
- Examples of good titles:
  * \"Add email notification system for user registration\"
  * \"Improve dashboard loading performance\"
  * \"Fix authentication issues on mobile devices\"

Avoid:
- Commitlint prefixes (feat:, fix:, chore:, etc.)
- Technical jargon when possible
- Vague descriptions like \"update code\" or \"refactor\"

=== COMMITS ===
$commits

=== FILES AFFECTED ===  
$files

Generate only the title, nothing else."
    
    local claude_response
    if claude_response=$(call_claude_cli "$claude_input" 30); then
        echo "$claude_response" | tr -d '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//'
    else
        # Fallback to first commit message
        echo "⚠️  Claude CLI failed, using fallback title" >&2
        git log -1 --pretty=%B | head -n1
    fi
}

# Check if diff is too large for analysis
is_diff_too_large() {
    local target_branch="$1" 
    local current_branch="$2"
    
    local numstat=$(git diff "$target_branch..$current_branch" --numstat)
    local total_lines_changed=0
    local files_changed=0
    
    while IFS=$'\t' read -r added removed filename; do
        if [ -n "$added" ] && [ -n "$removed" ] && [ "$added" != "-" ] && [ "$removed" != "-" ]; then
            total_lines_changed=$((total_lines_changed + added + removed))
            files_changed=$((files_changed + 1))
        fi
    done <<< "$numstat"
    
    local diff_content=$(git diff "$target_branch..$current_branch" -- . "${DIFF_EXCLUSIONS[@]}")
    local diff_size=${#diff_content}
    
    if [ $total_lines_changed -gt $MAX_LINES_CHANGED ] || [ $diff_size -gt $MAX_DIFF_SIZE ] || [ $files_changed -gt $MAX_FILES_CHANGED ]; then
        echo "⚠️  Large diff detected ($total_lines_changed lines changed, $files_changed files, $diff_size chars), using summary mode"
        return 0
    fi
    
    return 1
}

# Generate AI analysis using Claude CLI
generate_ai_analysis() {
    local target_branch="$1"
    local current_branch="$2"
    
    local stats=$(git diff "$target_branch..$current_branch" --stat | tail -n1)
    local commits=$(git log "$target_branch..$current_branch" --oneline --no-merges)
    local files=$(git diff "$target_branch..$current_branch" --name-status)
    
    local claude_input="Analyze this Git PR and generate a summary in English:

=== STATS ===
$stats

=== COMMITS ===
$commits

=== FILES CHANGED ===
$files
"
    
    if ! is_diff_too_large "$target_branch" "$current_branch"; then
        local diff_content=$(git diff "$target_branch..$current_branch" -- . "${DIFF_EXCLUSIONS[@]}")
        claude_input+="
=== DIFF CONTENT ===
$diff_content
"
    fi
    
    claude_input+="
Response format:
## Summary
[Concise description of what this PR does]

## Changes  
[Detailed analysis of changes by category with relevant technical details]"
    
    local claude_response
    if claude_response=$(call_claude_cli "$claude_input" 45); then
        echo "$claude_response"
    else
        # Fallback analysis
        echo "⚠️  Claude CLI failed, using fallback analysis" >&2
        echo "## Summary"
        echo "This PR includes changes across $(echo "$files" | wc -l | tr -d ' ') files."
        echo ""
        echo "## Changes"
        echo "$stats"
        echo ""
        echo "### Recent Commits"
        echo "$commits" | sed 's/^/- /'
        echo ""
        echo "### Files Modified"
        echo "$files" | sed 's/^/- /'
    fi
}

# Create PR body with AI analysis
create_pr_body() {
    local target_branch="$1"
    local current_branch="$2"
    
    local analysis=$(generate_ai_analysis "$target_branch" "$current_branch")
    
    cat <<EOF
$analysis

---
🤖 Generated with gprc made by Walid + Claude
EOF
}

# ============================================================================
# MAIN FLOW HANDLERS
# ============================================================================

# Handle update-only mode
handle_update_mode() {
    local current_branch="$1"
    
    echo "🔍 Looking for existing PR on current branch..."
    
    local existing_pr_info=$(find_existing_pr "$current_branch" "")
    
    if [ "$existing_pr_info" = "null" ] || [ -z "$existing_pr_info" ]; then
        echo "❌ No existing PR found for branch '$current_branch'"
        echo "💡 Create a PR first or run 'gprc' without the -u flag"
        return 1
    fi
    
    local pr_number=$(echo "$existing_pr_info" | jq -r '.number')
    local pr_url=$(echo "$existing_pr_info" | jq -r '.url')
    local target_branch=$(echo "$existing_pr_info" | jq -r '.baseRefName')
    
    echo "✅ Found PR #$pr_number: $pr_url"
    echo "🎯 Target branch: $target_branch"
    echo ""
    echo "❓ Update the description of PR #$pr_number? (y/N)"
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        return 0
    fi
    
    echo ""
    echo "🔄 Generating updated analysis..."
    local pr_body=$(create_pr_body "$target_branch" "$current_branch")
    
    if create_or_update_pr "update" "$pr_number" "" "$pr_body" "$target_branch" "$current_branch"; then
        echo ""
        echo "✅ PR description updated successfully!"
        gh pr view "$pr_number" --web
    else
        echo ""
        echo "❌ Failed to update PR description"
        return 1
    fi
}

# Ensure branch is pushed to remote
ensure_branch_pushed() {
    local current_branch="$1"

    if branch_exists_remote_cached "$current_branch"; then
        echo "🔄 Pulling latest changes with rebase..."
        if ! git pull --rebase origin "$current_branch"; then
            echo ""
            echo "❌ Rebase failed. Please resolve conflicts and try again."
            echo "💡 After resolving conflicts, run: git rebase --continue"
            return 1
        fi
        echo "✅ Branch up to date"
    else
        echo ""
        echo "⚠️  Current branch '$current_branch' does not exist on remote"
        echo "💡 Push it first with: git push -u origin $current_branch"
        return 1
    fi
}

# Handle create mode
handle_create_mode() {
    local current_branch="$1"
    
    local target_branch
    if ! target_branch=$(select_target_branch "$current_branch"); then
        return 1
    fi
    
    echo ""
    echo "🎯 Target branch: $target_branch"
    
    if ! ensure_branch_pushed "$current_branch"; then
        return 1
    fi
    
    echo ""
    echo "🔍 Checking for existing PRs..."

    local existing_pr_info=$(find_existing_pr "$current_branch" "$target_branch")
    
    if [ "$existing_pr_info" != "null" ] && [ -n "$existing_pr_info" ]; then
        handle_existing_pr "$existing_pr_info"
        case $? in
            0) return 0 ;;  # Cancel
            2) return 0 ;;  # Viewed
            1)  # Update
                echo ""
                echo "🔄 Generating updated analysis..."
                local pr_body=$(create_pr_body "$target_branch" "$current_branch")
                local pr_number=$(echo "$existing_pr_info" | jq -r '.number')
                
                if create_or_update_pr "update" "$pr_number" "" "$pr_body" "$target_branch" "$current_branch"; then
                    echo ""
                    echo "✅ PR updated successfully!"
                    gh pr view "$pr_number" --web
                else
                    echo ""
                    echo "❌ Failed to update PR"
                    return 1
                fi
                ;;
        esac
    else
        echo "✅ No existing PR found, proceeding with creation..."
        echo ""
        echo "🤖 Generating PR title from commits..."
        local pr_title=$(generate_ai_title "$target_branch" "$current_branch")
        echo ""
        echo "🔄 Generating changes analysis..."
        local pr_body=$(create_pr_body "$target_branch" "$current_branch")

        if create_or_update_pr "create" "" "$pr_title" "$pr_body" "$target_branch" "$current_branch"; then
            echo ""
            echo "✅ PR created successfully!"
        else
            echo ""
            echo "❌ Failed to create PR"
            return 1
        fi
    fi
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

gprc() {
    # Clear branch cache for fresh data
    clear_branch_cache

    # Parse arguments
    local update_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--update-description)
                update_only=true
                shift
                ;;
            -h|--help)
                cat <<EOF
Git PR Create with AI-powered title and description generation

USAGE:
    gprc [OPTIONS]

OPTIONS:
    -u, --update-description    Update description of existing PR only
    -h, --help                 Show this help message

DESCRIPTION:
    Creates GitHub PRs with AI-generated titles and descriptions using Claude CLI.
    Supports interactive branch selection, automatic conflict detection, and
    smart handling of existing PRs.

FEATURES:
    - Interactive branch selection with fzf
    - AI-generated PR titles and descriptions
    - Automatic sync checking between local and remote branches  
    - Smart handling of existing PRs
    - Large diff detection with summary mode
    - Integration with GitHub CLI

EXAMPLES:
    gprc                       Create new PR with interactive branch selection
    gprc -u                    Update existing PR description only

REQUIREMENTS:
    - GitHub CLI (gh)
    - fzf (fuzzy finder)
    - Claude CLI
    - Git repository
EOF
                return 0
                ;;
            *)
                echo "❌ Unknown option: $1"
                echo "Usage: gprc [-u|--update-description] [-h|--help]"
                return 1
                ;;
        esac
    done
    
    # Validate dependencies
    if ! validate_dependencies; then
        return 1
    fi
    
    local current_branch=$(git branch --show-current)
    echo "🎯 Current branch: $current_branch"
    echo ""
    
    # Route to appropriate handler
    if [ "$update_only" = true ]; then
        handle_update_mode "$current_branch"
    else
        handle_create_mode "$current_branch"
    fi
}