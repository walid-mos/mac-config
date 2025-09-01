#!/bin/zsh
# Git fetch with prune and cleanup of gone branches

gf() {
    local interactive_mode=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --interactive|-i)
                interactive_mode=true
                shift
                ;;
            --help|-h)
                echo "Usage: gf [--interactive|-i]"
                echo "  --interactive, -i    Ask confirmation for each branch individually"
                echo "  --help, -h          Show this help message"
                return 0
                ;;
            *)
                echo "Error: Unknown argument '$1'"
                echo "Usage: gf [--interactive|-i]"
                return 1
                ;;
        esac
    done
    
    echo "Fetching with prune..."
    git fetch --prune
    echo "\nCleaning up branches that are gone on remote..."
    
    local gone_branches=$(git branch -vv | grep ": gone]" | awk '{gsub(/^[*+] */, ""); print $1}')
    
    if [ -z "$gone_branches" ]; then
        echo "No branches to clean up"
        return 0
    fi
    
    # Convert to array for easier handling
    local -a branch_array
    branch_array=(${(f)gone_branches})
    local branch_count=${#branch_array[@]}
    
    echo "Found $branch_count branch(es) to delete:"
    printf "  - %s\n" "${branch_array[@]}"
    echo
    
    if [ "$interactive_mode" = true ]; then
        # Interactive mode: ask for each branch
        local skip_all=false
        for branch in "${branch_array[@]}"; do
            if [ "$skip_all" = true ]; then
                break
            fi
            
            while true; do
                echo -n "Delete branch '$branch'? (y/n/a/q): "
                read -r response
                case $response in
                    [Yy]|yes)
                        _delete_branch_with_worktree "$branch"
                        break
                        ;;
                    [Nn]|no)
                        echo "Skipping '$branch'"
                        break
                        ;;
                    [Aa]|all)
                        echo "Deleting all remaining branches..."
                        for remaining_branch in "${branch_array[@]}"; do
                            _delete_branch_with_worktree "$remaining_branch"
                        done
                        return 0
                        ;;
                    [Qq]|quit)
                        echo "Cancelled"
                        return 0
                        ;;
                    *)
                        echo "Please answer y(es), n(o), a(ll), or q(uit)"
                        ;;
                esac
            done
        done
    else
        # Default mode: global confirmation (default to Y)
        echo -n "Delete all $branch_count branch(es)? (Y/n): "
        read -r response
        case $response in
            [Nn]|no)
                echo "Cancelled"
                return 0
                ;;
            *)
                # Default to yes for empty input or 'y'/'yes'
                for branch in "${branch_array[@]}"; do
                    _delete_branch_with_worktree "$branch"
                done
                ;;
        esac
    fi
}

# Helper function to delete a branch and its worktree
_delete_branch_with_worktree() {
    local branch="$1"
    
    # Check if branch has an associated worktree
    local worktree_info=$(git worktree list --porcelain | grep -A2 "branch refs/heads/$branch")
    if [ -n "$worktree_info" ]; then
        local worktree_path=$(echo "$worktree_info" | grep "worktree" | cut -d' ' -f2)
        if [ -n "$worktree_path" ]; then
            echo "Removing worktree for '$branch' at: $worktree_path"
            git worktree remove "$worktree_path" --force 2>/dev/null
            if [ -d "$worktree_path" ]; then
                echo "Removing directory: $worktree_path"
                rm -rf "$worktree_path"
            fi
        fi
    fi
    
    echo "Deleting branch: $branch"
    git branch -D "$branch"
}