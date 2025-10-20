#!/bin/zsh
# Git Sync - Synchronize current branch with parent branch using rebase
#
# Automatically detects the parent branch (develop, main, master) and rebases
# the current branch onto it. Handles fetch, pull, rebase, and push with
# intelligent force-push detection and safe rollback on conflicts.

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Check if we're in a git repository
is_git_repo() {
    git rev-parse --git-dir > /dev/null 2>&1
}

# Get current branch name
get_current_branch() {
    git branch --show-current
}

# Get parent branch candidates (common base branches)
get_parent_candidates() {
    local current_branch="$1"
    local -a candidates=()

    # Common parent branches to check (in order of preference)
    local common_branches=("develop" "main" "master")

    for branch in "${common_branches[@]}"; do
        # Check if branch exists and is not the current branch
        if git show-ref --verify --quiet "refs/heads/$branch" && [ "$branch" != "$current_branch" ]; then
            candidates+=("$branch")
        fi
    done

    printf '%s\n' "${candidates[@]}"
}

# Find parent branch using merge-base
find_parent_branch() {
    local current_branch="$1"
    local candidates=$(get_parent_candidates "$current_branch")

    if [ -z "$candidates" ]; then
        return 1
    fi

    local best_parent=""
    local max_common_commits=0

    while IFS= read -r candidate; do
        # Get merge base (common ancestor)
        local merge_base=$(git merge-base "$current_branch" "$candidate" 2>/dev/null)

        if [ -n "$merge_base" ]; then
            # Count commits from merge-base to candidate
            local common_commits=$(git rev-list --count "$merge_base..$candidate" 2>/dev/null || echo "0")

            # The parent is the branch with the most commits after the merge-base
            # (i.e., the branch that has advanced the most since divergence)
            if [ "$common_commits" -gt "$max_common_commits" ]; then
                max_common_commits="$common_commits"
                best_parent="$candidate"
            fi
        fi
    done <<< "$candidates"

    if [ -n "$best_parent" ]; then
        echo "$best_parent"
        return 0
    fi

    return 1
}

# Interactive parent branch selection
select_parent_branch() {
    local current_branch="$1"
    local candidates=$(get_parent_candidates "$current_branch")

    if [ -z "$candidates" ]; then
        echo ""
        return 1
    fi

    if ! command -v fzf &> /dev/null; then
        # If fzf not available, return first candidate
        echo "$candidates" | head -n1
        return 0
    fi

    local selected=$(echo "$candidates" | fzf \
        --prompt="Select parent branch: " \
        --height=40% \
        --border \
        --header="Select the parent branch to rebase onto" \
        --preview-window=hidden)

    if [ -z "$selected" ]; then
        return 1
    fi

    echo "$selected"
}

# Check if there are uncommitted changes
has_uncommitted_changes() {
    ! git diff-index --quiet HEAD --
}

# Get current HEAD commit (for rollback)
get_current_commit() {
    git rev-parse HEAD
}

# Check if trees are identical (definitive squash detection)
has_identical_trees() {
    local current_branch="$1"
    local parent_branch="$2"

    local parent_tree=$(git rev-parse "$parent_branch^{tree}" 2>/dev/null)
    local current_tree=$(git rev-parse "$current_branch^{tree}" 2>/dev/null)

    if [ -n "$parent_tree" ] && [ -n "$current_tree" ] && [ "$parent_tree" = "$current_tree" ]; then
        return 0  # Trees identical
    fi

    return 1  # Trees different
}

# Check if branch has minimal diff (possible partial squash)
has_minimal_diff() {
    local current_branch="$1"
    local parent_branch="$2"

    local diff_output=$(git diff "$parent_branch" "$current_branch" 2>/dev/null)
    local diff_lines=$(echo "$diff_output" | wc -l | tr -d ' ')

    if [ "$diff_lines" -lt 50 ]; then
        return 0  # Minimal diff
    fi

    return 1  # Significant diff
}

# Count commits on current branch not in parent
count_new_commits() {
    local current_branch="$1"
    local parent_branch="$2"

    local commit_count=$(git rev-list --count "$parent_branch..$current_branch" 2>/dev/null || echo "0")
    echo "$commit_count"
}

# Get list of commits not in parent (for cherry-pick)
get_new_commits() {
    local current_branch="$1"
    local parent_branch="$2"

    git rev-list --reverse "$parent_branch..$current_branch" 2>/dev/null
}

# ============================================================================
# SYNC WORKFLOW FUNCTIONS
# ============================================================================

# Perform fetch from origin
fetch_origin() {
    echo "🔄 Fetching from origin..."
    if ! git fetch origin; then
        echo "❌ Failed to fetch from origin"
        return 1
    fi

    echo "✅ Fetch completed"
    return 0
}

# Pull parent branch from origin
pull_parent_branch() {
    local parent_branch="$1"

    echo ""
    echo "🔄 Pulling '$parent_branch' from origin..."

    # Check if parent branch exists on remote
    if ! git show-ref --verify --quiet "refs/remotes/origin/$parent_branch"; then
        echo "⚠️  Parent branch '$parent_branch' not found on remote"
        echo "   Continuing with local branch only..."
        return 0
    fi

    # Switch to parent branch temporarily to pull
    local current_branch=$(get_current_branch)

    if ! git checkout "$parent_branch" 2>/dev/null; then
        echo "❌ Failed to checkout parent branch '$parent_branch'"
        return 1
    fi

    if ! git pull origin "$parent_branch"; then
        echo "❌ Failed to pull '$parent_branch'"
        git checkout "$current_branch" 2>/dev/null
        return 1
    fi

    # Switch back to original branch
    git checkout "$current_branch" 2>/dev/null
    echo "✅ Parent branch updated"
    return 0
}

# Perform rebase onto parent branch
rebase_onto_parent() {
    local parent_branch="$1"
    local original_commit="$2"

    echo ""
    echo "🔄 Rebasing onto '$parent_branch'..."

    if ! git rebase "$parent_branch"; then
        echo ""
        echo "❌ Rebase failed - conflicts detected!"
        echo ""
        echo "⚠️  Rolling back to original state..."

        # Abort rebase and restore original state
        git rebase --abort 2>/dev/null

        echo "✅ Rolled back to commit: ${original_commit:0:7}"
        echo ""
        echo "💡 To resolve conflicts manually:"
        echo "   1. Run: git rebase $parent_branch"
        echo "   2. Resolve conflicts in affected files"
        echo "   3. Run: git add <resolved-files>"
        echo "   4. Run: git rebase --continue"
        echo "   5. After rebase completes, run: git push --force-with-lease"

        return 1
    fi

    echo "✅ Rebase completed successfully"
    return 0
}

# ============================================================================
# SQUASH MERGE HANDLING
# ============================================================================

# Handle squashed branch with no new commits
handle_squashed_branch() {
    local current_branch="$1"
    local parent_branch="$2"

    echo ""
    echo "✅ Branch '$current_branch' already merged into '$parent_branch' (squashed)"
    echo ""

    if ! command -v fzf &> /dev/null; then
        # Fallback without fzf
        echo "❓ What do you want to do?"
        echo "   1. Reset to $parent_branch (git reset --hard $parent_branch)"
        echo "   2. Delete branch (recommended - already merged)"
        echo "   3. Cancel"
        echo -n "Choice (1/2/3): "
        read -r choice
        case $choice in
            1) return 1 ;;  # Reset
            2) return 2 ;;  # Delete
            *) return 0 ;;  # Cancel
        esac
    fi

    local options="Reset to $parent_branch (keeps branch name)\nDelete branch (already merged)\nCancel"
    local selected=$(echo "$options" | fzf \
        --prompt="Branch already merged: " \
        --height=40% \
        --border \
        --header="What do you want to do?" \
        --preview-window=hidden)

    case "$selected" in
        "Reset to $parent_branch"*)
            return 1  # Reset
            ;;
        "Delete branch"*)
            return 2  # Delete
            ;;
        *)
            return 0  # Cancel
            ;;
    esac
}

# Handle squashed branch with new commits
handle_squashed_with_new_commits() {
    local current_branch="$1"
    local parent_branch="$2"
    local commit_count="$3"

    echo ""
    echo "⚠️  Branch '$current_branch' was squashed but has $commit_count new commit(s)"
    echo ""

    if ! command -v fzf &> /dev/null; then
        # Fallback without fzf
        echo "❓ What do you want to do?"
        echo "   1. Reset + cherry-pick new commits (safe)"
        echo "   2. Continue with rebase (may cause conflicts)"
        echo "   3. Cancel"
        echo -n "Choice (1/2/3): "
        read -r choice
        case $choice in
            1) return 1 ;;  # Cherry-pick
            2) return 2 ;;  # Rebase
            *) return 0 ;;  # Cancel
        esac
    fi

    local options="Reset + cherry-pick new commits (safe)\nContinue with rebase (risky - may conflict)\nCancel"
    local selected=$(echo "$options" | fzf \
        --prompt="Branch squashed with new commits: " \
        --height=40% \
        --border \
        --header="What do you want to do?" \
        --preview-window=hidden)

    case "$selected" in
        "Reset + cherry-pick"*)
            return 1  # Cherry-pick
            ;;
        "Continue with rebase"*)
            return 2  # Rebase
            ;;
        *)
            return 0  # Cancel
            ;;
    esac
}

# Reset branch to parent
reset_to_parent() {
    local parent_branch="$1"

    echo ""
    echo "🔄 Resetting to '$parent_branch'..."

    if ! git reset --hard "$parent_branch"; then
        echo "❌ Failed to reset to '$parent_branch'"
        return 1
    fi

    echo "✅ Branch reset to '$parent_branch'"
    return 0
}

# Delete current branch and switch to parent
delete_current_branch() {
    local current_branch="$1"
    local parent_branch="$2"

    echo ""
    echo "🗑️  Deleting branch '$current_branch'..."

    # Switch to parent branch first
    if ! git checkout "$parent_branch" 2>/dev/null; then
        echo "❌ Failed to checkout '$parent_branch'"
        return 1
    fi

    # Delete the branch
    if ! git branch -D "$current_branch" 2>/dev/null; then
        echo "❌ Failed to delete branch '$current_branch'"
        git checkout "$current_branch" 2>/dev/null  # Switch back
        return 1
    fi

    echo "✅ Branch '$current_branch' deleted"
    echo "📍 Now on branch: $parent_branch"
    return 0
}

# Reset and cherry-pick new commits
reset_and_cherry_pick() {
    local current_branch="$1"
    local parent_branch="$2"

    echo ""
    echo "🔄 Resetting to '$parent_branch' and cherry-picking new commits..."

    # Get list of new commits before reset
    local new_commits=$(get_new_commits "$current_branch" "$parent_branch")

    if [ -z "$new_commits" ]; then
        echo "⚠️  No new commits to cherry-pick"
        return reset_to_parent "$parent_branch"
    fi

    # Reset to parent
    if ! git reset --hard "$parent_branch"; then
        echo "❌ Failed to reset to '$parent_branch'"
        return 1
    fi

    echo "✅ Reset to '$parent_branch'"
    echo ""
    echo "🍒 Cherry-picking new commits..."

    # Cherry-pick each commit
    local failed=false
    while IFS= read -r commit; do
        local commit_msg=$(git log -1 --pretty=%s "$commit")
        echo "  Picking: ${commit:0:7} - $commit_msg"

        if ! git cherry-pick "$commit" 2>/dev/null; then
            echo ""
            echo "❌ Cherry-pick failed for commit ${commit:0:7}"
            echo "   Conflicts detected. Please resolve manually:"
            echo "   1. Fix conflicts in affected files"
            echo "   2. Run: git add <resolved-files>"
            echo "   3. Run: git cherry-pick --continue"
            echo "   Or abort with: git cherry-pick --abort"
            failed=true
            return 1
        fi
    done <<< "$new_commits"

    if [ "$failed" = false ]; then
        echo ""
        echo "✅ All commits cherry-picked successfully"
    fi

    return 0
}

# Check if force push is needed
needs_force_push() {
    local current_branch="$1"

    # Try a dry-run push
    if git push --dry-run origin "$current_branch" &>/dev/null; then
        return 1  # No force push needed
    else
        # Check if it's because of non-fast-forward
        local push_output=$(git push --dry-run origin "$current_branch" 2>&1)
        if echo "$push_output" | grep -q "non-fast-forward\|rejected"; then
            return 0  # Force push needed
        else
            # Some other error (maybe branch doesn't exist on remote)
            return 2  # Unknown error
        fi
    fi
}

# Push changes to remote
push_changes() {
    local current_branch="$1"
    local force_mode="$2"  # "force" or "normal"

    if [ "$force_mode" = "force" ]; then
        echo ""
        echo "⚠️  Force push required (history was rewritten)"
        echo ""
        echo "📋 Changes to be pushed:"
        echo "   Local:  $current_branch"
        echo "   Remote: origin/$current_branch"
        echo ""

        # Show visual preview of commits that will be force-pushed
        echo "📊 Commits preview:"
        git log --oneline --graph --decorate "origin/$current_branch..HEAD" -3 2>/dev/null || echo "   (unable to show preview)"
        echo ""

        echo "🔒 Safety: Using --force-with-lease (will abort if remote changed)"
        echo ""
        echo -n "   Continue with force push? (Y/n): "
        read -r confirm

        # Accept by default (refuse only if explicitly n/N)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "❌ Push cancelled"
            echo ""
            echo "💡 Your local branch has been rebased but not pushed."
            echo "   You can push later with: git push --force-with-lease origin $current_branch"
            return 1
        fi

        echo ""
        echo "🚀 Force pushing to remote..."
        if git push --force-with-lease origin "$current_branch"; then
            echo "✅ Force push completed successfully"
            return 0
        else
            echo "❌ Force push failed"
            return 1
        fi
    else
        echo ""
        echo "🚀 Pushing to remote..."
        if git push origin "$current_branch"; then
            echo "✅ Push completed successfully"
            return 0
        else
            echo "❌ Push failed"
            return 1
        fi
    fi
}

# ============================================================================
# MAIN SYNC FUNCTION
# ============================================================================

gsync() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                cat <<EOF
Git Sync - Synchronize current branch with parent branch using rebase

USAGE:
    gsync [OPTIONS]

OPTIONS:
    -h, --help    Show this help message

DESCRIPTION:
    Synchronizes your current branch with its parent branch using rebase.
    The function will:
    1. Auto-detect the parent branch (develop, main, master)
    2. Fetch the latest changes from origin
    3. Pull and update the parent branch
    4. Check for squash merges and handle appropriately
    5. Rebase your current branch onto the parent (or cherry-pick if squashed)
    6. Push changes (with intelligent force push detection)

    If conflicts occur during rebase, the operation will be automatically rolled back.

WORKFLOW EXAMPLES:
    feature-1 branch → rebase onto develop
    develop branch   → rebase onto main
    bugfix-auth      → rebase onto develop

SQUASH MERGE HANDLING:
    When a branch was squash-merged via GitHub PR, gsync detects this and offers:

    If branch fully merged (no new commits):
      • Reset to parent (keeps branch name)
      • Delete branch (recommended)
      • Cancel

    If branch merged but has new commits:
      • Reset + cherry-pick new commits (safe)
      • Continue with rebase (risky - may conflict)
      • Cancel

FEATURES:
    - Automatic parent branch detection using merge-base
    - Squash merge detection and smart handling
    - Interactive parent selection (fallback with fzf)
    - Intelligent force push detection
    - Safe rollback on rebase conflicts
    - Interactive confirmation for force push
    - Clear error messages and recovery instructions

EXAMPLES:
    gsync                Sync current branch with its parent

REQUIREMENTS:
    - Git repository
    - At least one parent branch (develop/main/master)

NOTES:
    - Parent branch is detected dynamically (not hardcoded)
    - Uses --force-with-lease for safer force pushing
    - Automatically updates parent branch before rebasing
    - Preserves your work if rebase fails
EOF
                return 0
                ;;
            *)
                echo "❌ Unknown option: $1"
                echo "Usage: gsync [-h|--help]"
                return 1
                ;;
        esac
    done

    # Validate git repository
    if ! is_git_repo; then
        echo "❌ Not in a git repository"
        return 1
    fi

    # Get current branch
    local current_branch=$(get_current_branch)

    if [ -z "$current_branch" ]; then
        echo "❌ Not on any branch (detached HEAD state)"
        return 1
    fi

    echo "🎯 Current branch: $current_branch"

    # Check for uncommitted changes
    if has_uncommitted_changes; then
        echo ""
        echo "⚠️  You have uncommitted changes!"
        echo ""
        git status --short
        echo ""
        echo "💡 Please commit or stash your changes before syncing:"
        echo "   - Commit: git add -A && git commit -m 'Your message'"
        echo "   - Stash: git stash"
        return 1
    fi

    # Detect or select parent branch
    echo ""
    echo "🔍 Detecting parent branch..."

    local parent_branch=$(find_parent_branch "$current_branch")

    if [ -z "$parent_branch" ]; then
        echo "⚠️  Could not auto-detect parent branch"
        echo ""
        parent_branch=$(select_parent_branch "$current_branch")

        if [ -z "$parent_branch" ]; then
            echo "❌ No parent branch selected"
            echo ""
            echo "💡 Available parent branches: develop, main, master"
            return 1
        fi
    fi

    echo "📡 Parent branch: $parent_branch"

    # Save current commit for potential rollback
    local original_commit=$(get_current_commit)
    echo "💾 Current commit: ${original_commit:0:7}"

    # Step 1: Fetch from origin
    echo ""
    if ! fetch_origin; then
        return 1
    fi

    # Step 2: Pull parent branch
    if ! pull_parent_branch "$parent_branch"; then
        return 1
    fi

    # Step 3: Check if branch was squashed
    echo ""
    echo "🔍 Checking for squash merge..."

    # First check: Are trees identical? (definitive squash)
    if has_identical_trees "$current_branch" "$parent_branch"; then
        # Case A: Trees identical = complete squash merge, no new commits
        # (commits exist in history but were already squashed)
        handle_squashed_branch "$current_branch" "$parent_branch"
        local action=$?

        case $action in
            1)
                # Reset to parent
                if reset_to_parent "$parent_branch"; then
                    echo ""
                    echo "✅ Branch reset to '$parent_branch'"
                    echo "   Proceeding to push changes..."
                else
                    return 1
                fi
                # Don't return - continue to push step
                ;;
            2)
                # Delete branch
                if delete_current_branch "$current_branch" "$parent_branch"; then
                    echo ""
                    echo "✅ Sync completed! Branch deleted"
                fi
                return 0
                ;;
            *)
                # Cancel
                echo "❌ Operation cancelled"
                return 0
                ;;
        esac

    # Second check: Minimal diff but different trees
    elif has_minimal_diff "$current_branch" "$parent_branch"; then
        local new_commits=$(count_new_commits "$current_branch" "$parent_branch")

        if [ "$new_commits" = "0" ]; then
            # Minimal diff but no commits? Unlikely, but treat as normal rebase
            echo "✅ Minimal changes detected, proceeding with normal rebase..."
            if ! rebase_onto_parent "$parent_branch" "$original_commit"; then
                return 1
            fi
        else
            # Case B: Minimal diff with new commits (possible partial squash)
            handle_squashed_with_new_commits "$current_branch" "$parent_branch" "$new_commits"
            local action=$?

            case $action in
                1)
                    # Cherry-pick
                    if reset_and_cherry_pick "$current_branch" "$parent_branch"; then
                        echo ""
                        echo "✅ Sync completed! Ready to push"
                        # Continue to push step below
                    else
                        return 1
                    fi
                    ;;
                2)
                    # Continue with risky rebase
                    echo ""
                    echo "⚠️  Continuing with rebase (may cause conflicts)..."
                    if ! rebase_onto_parent "$parent_branch" "$original_commit"; then
                        return 1
                    fi
                    ;;
                *)
                    # Cancel
                    echo "❌ Operation cancelled"
                    return 0
                    ;;
            esac
        fi
    else
        # Case C: Significant diff = normal branch (not squashed) - standard rebase
        echo "✅ No squash merge detected, proceeding with normal rebase..."

        if ! rebase_onto_parent "$parent_branch" "$original_commit"; then
            return 1
        fi
    fi

    # Step 4: Push changes
    echo ""
    echo "🔍 Checking if push is needed..."

    # Check what kind of push we need
    needs_force_push "$current_branch"
    local push_status=$?

    case $push_status in
        0)
            # Force push needed
            if ! push_changes "$current_branch" "force"; then
                return 1
            fi
            ;;
        1)
            # Normal push is fine
            if ! push_changes "$current_branch" "normal"; then
                return 1
            fi
            ;;
        2)
            # Unknown error - might be that branch doesn't exist on remote
            echo ""
            echo "⚠️  Branch '$current_branch' may not exist on remote"
            echo -n "   Push as new branch? (y/N): "
            read -r confirm

            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                echo ""
                echo "🚀 Pushing new branch to remote..."
                if git push -u origin "$current_branch"; then
                    echo "✅ Branch pushed and tracking set up"
                else
                    echo "❌ Failed to push branch"
                    return 1
                fi
            else
                echo "❌ Push cancelled"
                echo ""
                echo "💡 Your local branch has been rebased but not pushed."
                echo "   You can push later with: git push -u origin $current_branch"
                return 1
            fi
            ;;
    esac

    echo ""
    echo "✅ Sync completed successfully!"
    echo "🎉 Branch '$current_branch' is now up to date with '$parent_branch'"
}
