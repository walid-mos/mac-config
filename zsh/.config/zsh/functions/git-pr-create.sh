#!/bin/zsh
# Git PR Create with automatic description

gprc() {
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    # Check if gh CLI is installed
    if ! command -v gh &> /dev/null; then
        echo "❌ GitHub CLI (gh) is not installed. Install it with: brew install gh"
        return 1
    fi
    
    # Get current branch
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Function to select target branch interactively with fzf
    select_target_branch() {
        # Check if fzf is available
        if ! command -v fzf &> /dev/null; then
            echo "❌ fzf is required for interactive branch selection. Install it with: brew install fzf"
            return 1
        fi
        
        # Detect default branch (develop, main, master)
        local default_branch=""
        for branch in develop main master; do
            if git show-ref --verify --quiet refs/heads/$branch; then
                default_branch=$branch
                break
            fi
        done
        
        # If no default branch found locally, check remote
        if [ -z "$default_branch" ]; then
            for branch in develop main master; do
                if git show-ref --verify --quiet refs/remotes/origin/$branch; then
                    default_branch=$branch
                    break
                fi
            done
        fi
        
        # Get all available branches (excluding current)
        local branches=()
        
        # Add default branch first if it exists and is different from current
        if [ -n "$default_branch" ] && [ "$default_branch" != "$CURRENT_BRANCH" ]; then
            branches+=("$default_branch (default)")
        fi
        
        # Add other local branches
        while IFS= read -r branch; do
            if [ -n "$branch" ] && [ "$branch" != "$CURRENT_BRANCH" ] && [ "$branch" != "$default_branch" ]; then
                branches+=("$branch")
            fi
        done <<< "$(git branch --format='%(refname:short)')"
        
        # Add remote branches that don't exist locally
        while IFS= read -r remote_branch; do
            if [ -n "$remote_branch" ]; then
                branch=$(echo "$remote_branch" | sed 's/origin\///')
                if [ "$branch" != "$CURRENT_BRANCH" ] && [ "$branch" != "$default_branch" ]; then
                    # Check if this branch already exists locally
                    if ! git show-ref --verify --quiet refs/heads/$branch; then
                        branches+=("$branch (remote)")
                    fi
                fi
            fi
        done <<< "$(git branch -r --format='%(refname:short)' | grep -v 'origin/HEAD')"
        
        if [ ${#branches[@]} -eq 0 ]; then
            echo "❌ No target branches available (current: $CURRENT_BRANCH)"
            return 1
        fi
        
        # Use fzf for selection
        local selected=$(printf '%s\n' "${branches[@]}" | fzf \
            --prompt="Target branch: " \
            --height=40% \
            --border \
            --header="Select target branch for PR (↑↓ to navigate, Enter to select)" \
            --preview-window=hidden)
        
        if [ -z "$selected" ]; then
            echo "❌ No branch selected"
            return 1
        fi
        
        # Extract branch name (remove annotations like "(default)" or "(remote)")
        local branch_name=$(echo "$selected" | sed 's/ (default)//' | sed 's/ (remote)//')
        echo "$branch_name"
        return 0
    }
    
    echo "🎯 Current branch: $CURRENT_BRANCH"
    echo ""
    
    # Select target branch interactively
    TARGET_BRANCH=$(select_target_branch)
    if [ $? -ne 0 ] || [ -z "$TARGET_BRANCH" ]; then
        return 1
    fi
    
    echo ""
    echo "🎯 Target branch: $TARGET_BRANCH"
    
    # Check if current branch exists on remote and pull latest changes
    if git show-ref --verify --quiet refs/remotes/origin/$CURRENT_BRANCH; then
        echo ""
        echo "🔄 Pulling latest changes with rebase..."
        if ! git pull --rebase origin $CURRENT_BRANCH; then
            echo ""
            echo "❌ Rebase failed. Please resolve conflicts and try again."
            echo "💡 After resolving conflicts, run: git rebase --continue"
            return 1
        fi
        echo "✅ Branch up to date"
    else
        echo ""
        echo "⚠️  Current branch '$CURRENT_BRANCH' does not exist on remote"
        echo "💡 Push it first with: git push -u origin $CURRENT_BRANCH"
        return 1
    fi
    
    # Get PR title from argument or last commit message
    if [ -n "$1" ]; then
        PR_TITLE="$1"
    else
        PR_TITLE=$(git log -1 --pretty=%B | head -n1)
    fi
    
    # Function to generate AI analysis using Claude CLI
    generate_ai_analysis() {
        local target_branch=$1
        local current_branch=$2
        
        # Collect git data
        local stats=$(git diff $target_branch...$current_branch --stat | tail -n1)
        local commits=$(git log $target_branch..$current_branch --oneline --no-merges)
        local files=$(git diff $target_branch...$current_branch --name-status)
        
        # Get diff with exclusions and size limit
        local diff_content=$(git diff $target_branch...$current_branch \
            ':!*.lock' ':!package-lock.json' ':!yarn.lock' ':!Cargo.lock' \
            ':!dist/*' ':!build/*' ':!node_modules/*' ':!.next/*' \
            ':!*.min.js' ':!*.bundle.js')
        
        # Check diff size (20000 chars limit)
        local diff_size=${#diff_content}
        local use_full_diff=true
        
        if [ $diff_size -gt 20000 ]; then
            use_full_diff=false
            echo "⚠️  Large diff detected ($diff_size chars), using summary mode"
        fi
        
        # Prepare Claude prompt
        local claude_input="Analyze this Git PR and generate a summary in English:

=== STATS ===
$stats

=== COMMITS ===
$commits

=== FILES CHANGED ===
$files
"
        
        if [ "$use_full_diff" = true ]; then
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
        
        # Call Claude CLI with timeout and error handling
        local claude_response
        if claude_response=$(echo "$claude_input" | timeout 30s claude 2>/dev/null); then
            echo "$claude_response"
        else
            echo "⚠️  Claude CLI failed, using fallback analysis"
            # Fallback to simplified analysis
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
    
    # Generate changes analysis
    CHANGES_ANALYSIS=$(generate_ai_analysis $TARGET_BRANCH $CURRENT_BRANCH)
    
    # Create PR body
    PR_BODY=$(cat <<EOF
$CHANGES_ANALYSIS

---
🤖 Generated with gprc made by Walid + Claude
EOF
)
    
    echo ""
    echo "📝 Creating PR: $PR_TITLE"
    echo ""
    
    # Create the PR
    gh pr create \
        --title "$PR_TITLE" \
        --body "$PR_BODY" \
        --base "$TARGET_BRANCH" \
        --head "$CURRENT_BRANCH"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ PR created successfully!"
    else
        echo ""
        echo "❌ Failed to create PR"
        return 1
    fi
}