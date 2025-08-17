#!/bin/zsh
# Git PR Create with automatic title and description generation

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
    
    # Function to check if PR already exists for current branch
    check_existing_pr() {
        local current_branch=$1
        local target_branch=$2
        
        # Get existing PRs for current branch
        local existing_pr=$(gh pr list --head "$current_branch" --base "$target_branch" --json number,url --jq '.[0]')
        
        if [ "$existing_pr" != "null" ] && [ -n "$existing_pr" ]; then
            echo "$existing_pr"
            return 0
        else
            return 1
        fi
    }
    
    # Function to handle existing PR
    handle_existing_pr() {
        local pr_info=$1
        local pr_number=$(echo "$pr_info" | jq -r '.number')
        local pr_url=$(echo "$pr_info" | jq -r '.url')
        
        echo ""
        echo "⚠️  A PR already exists for this branch:"
        echo "   PR #$pr_number: $pr_url"
        echo ""
        echo "What would you like to do?"
        echo "1) View existing PR in browser"
        echo "2) Update existing PR description with new analysis"
        echo "3) Cancel operation"
        echo ""
        
        # Use read for simple selection (fallback if fzf not available)
        if command -v fzf &> /dev/null; then
            local choice=$(printf "1) View existing PR in browser\n2) Update existing PR description with new analysis\n3) Cancel operation" | fzf \
                --prompt="Choose action: " \
                --height=40% \
                --border \
                --header="Select what to do with existing PR" \
                --preview-window=hidden | cut -d')' -f1)
        else
            echo -n "Enter your choice (1-3): "
            read choice
        fi
        
        case "$choice" in
            1)
                echo "🌐 Opening PR in browser..."
                gh pr view "$pr_number" --web
                return 2  # Special return code for "viewed"
                ;;
            2)
                echo "🔄 Updating existing PR description..."
                return 1  # Return code for "update"
                ;;
            3|"")
                echo "❌ Operation cancelled"
                return 0  # Return code for "cancel"
                ;;
            *)
                echo "❌ Invalid choice. Operation cancelled."
                return 0
                ;;
        esac
    }
    
    # Function to generate AI title using Claude CLI
    generate_ai_title() {
        local target_branch=$1
        local current_branch=$2
        
        # Collect commits for title generation
        local commits=$(git log $target_branch..$current_branch --oneline --no-merges)
        local files=$(git diff $target_branch...$current_branch --name-only | head -10)
        
        # Prepare Claude prompt for title generation
        local claude_input="Generate a concise English PR title (max 70 characters) that summarizes all these commits:

=== COMMITS ===
$commits

=== FILES AFFECTED (sample) ===
$files

Generate only the title, nothing else. Make it descriptive and natural (not conventional commits style)."
        
        # Call Claude CLI with error handling
        local claude_response
        
        if claude_response=$(echo "$claude_input" | /Users/walid/Library/pnpm/claude 2>&1); then
            # Clean the response (remove any extra whitespace/newlines)
            echo "$claude_response" | tr -d '\n' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//'
        else
            # Fallback to first commit message if Claude fails
            echo "$(git log -1 --pretty=%B | head -n1)"
        fi
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
    
    # Generate PR title using AI analysis of all commits
    echo ""
    echo "🤖 Generating PR title from commits..."
    PR_TITLE=$(generate_ai_title $TARGET_BRANCH $CURRENT_BRANCH)
    
    # Function to generate AI analysis using Claude CLI
    generate_ai_analysis() {
        local target_branch=$1
        local current_branch=$2
        
        # Collect git data
        local stats=$(git diff $target_branch...$current_branch --stat | tail -n1)
        local commits=$(git log $target_branch..$current_branch --oneline --no-merges)
        local files=$(git diff $target_branch...$current_branch --name-status)
        
        # Get diff with exclusions and size limit
        local diff_content=$(git diff $target_branch...$current_branch -- . \
            ':(exclude)package-lock.json' \
            ':(exclude)yarn.lock' \
            ':(exclude)Cargo.lock' \
            ':(exclude)*.lock' \
            ':(exclude)dist' \
            ':(exclude)build' \
            ':(exclude)node_modules' \
            ':(exclude).next' \
            ':(exclude)*.min.js' \
            ':(exclude)*.bundle.js')
        
        # Check diff size using smarter calculation
        local diff_size=${#diff_content}
        local use_full_diff=true
        
        # Get actual lines changed for better size estimation
        local numstat=$(git diff $target_branch...$current_branch --numstat)
        local total_lines_changed=0
        local files_changed=0
        
        while IFS=$'\t' read -r added removed filename; do
            if [ -n "$added" ] && [ -n "$removed" ] && [ "$added" != "-" ] && [ "$removed" != "-" ]; then
                total_lines_changed=$((total_lines_changed + added + removed))
                files_changed=$((files_changed + 1))
            fi
        done <<< "$numstat"
        
        # Use a combined approach: prioritize line count but also check char count
        # Large diff criteria: >5000 lines changed OR >100000 chars OR >50 files
        if [ $total_lines_changed -gt 5000 ] || [ $diff_size -gt 100000 ] || [ $files_changed -gt 50 ]; then
            use_full_diff=false
            echo "⚠️  Large diff detected ($total_lines_changed lines changed, $files_changed files, $diff_size chars), using summary mode"
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
        local claude_error
        
        # First try with full path and capture errors
        if claude_response=$(echo "$claude_input" | /Users/walid/Library/pnpm/claude 2>&1); then
            echo "$claude_response"
        else
            # Get the actual error for debugging
            claude_error=$(echo "$claude_input" | /Users/walid/Library/pnpm/claude 2>&1)
            echo "⚠️  Claude CLI failed (exit code: $?), using fallback analysis"
            echo "<!-- Debug: Claude error: $claude_error -->" >&2
            
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
    
    # Check if PR already exists
    echo ""
    echo "🔍 Checking for existing PRs..."
    
    if existing_pr_info=$(check_existing_pr "$CURRENT_BRANCH" "$TARGET_BRANCH"); then
        # PR exists, handle it
        handle_existing_pr "$existing_pr_info"
        case $? in
            0)  # Cancel
                return 0
                ;;
            1)  # Update existing PR
                echo ""
                echo "🔄 Generating updated analysis..."
                CHANGES_ANALYSIS=$(generate_ai_analysis $TARGET_BRANCH $CURRENT_BRANCH)
                
                # Create updated PR body
                PR_BODY=$(cat <<EOF
$CHANGES_ANALYSIS

---
🤖 Generated with gprc made by Walid + Claude
EOF
)
                
                # Update the existing PR
                pr_number=$(echo "$existing_pr_info" | jq -r '.number')
                echo ""
                echo "📝 Updating PR #$pr_number: $PR_TITLE"
                
                if gh pr edit "$pr_number" --body "$PR_BODY"; then
                    echo ""
                    echo "✅ PR updated successfully!"
                    gh pr view "$pr_number" --web
                else
                    echo ""
                    echo "❌ Failed to update PR"
                    return 1
                fi
                return 0
                ;;
            2)  # Viewed in browser
                return 0
                ;;
        esac
    else
        # No existing PR, proceed with creation
        echo "✅ No existing PR found, proceeding with creation..."
        
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
    fi
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ PR created successfully!"
    else
        echo ""
        echo "❌ Failed to create PR"
        return 1
    fi
}