#!/bin/zsh
# Git fetch with prune and cleanup of gone branches

gf() {
    echo "Fetching with prune..."
    git fetch --prune
    echo "\nCleaning up branches that are gone on remote..."
    local gone_branches=$(git branch -vv | grep ": gone]" | awk '{print $1}')
    if [ -n "$gone_branches" ]; then
        echo "Found branches to delete:"
        echo "$gone_branches"
        echo "$gone_branches" | while read branch; do
            git branch -D "$branch"
        done
    else
        echo "No branches to clean up"
    fi
}