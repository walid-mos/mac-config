#!/bin/bash
# Command: /quick-fix
# Description: Quick fix for small changes - lint, commit, and push (skips tests for speed)

set -e  # Exit on any error

echo "⚡ Starting quick fix pipeline..."

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if we have any changes to fix
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes detected. Nothing to fix."
    exit 0
fi

# Step 1: Quick lint and fix
echo "📝 Step 1/3: Running lint with auto-fix..."
if [ -f "package.json" ]; then
    if pnpm lint --fix 2>/dev/null; then
        echo "✅ Linting completed with auto-fix"
    else
        echo "⚠️  Linting failed, but proceeding anyway (quick-fix mode)"
    fi
else
    echo "ℹ️  No package.json found, skipping lint"
fi

# Step 2: Commit changes
echo "📦 Step 2/3: Committing changes..."
git add -A

# Generate a simple commit message
CHANGED_FILES=$(git diff --cached --name-only | head -5)
FILE_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')

if [ "$FILE_COUNT" -eq 1 ]; then
    COMMIT_MSG="fix: quick fix for $(basename "$CHANGED_FILES")

⚡ Quick fix (linting applied, tests skipped)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
else
    COMMIT_MSG="fix: quick fixes for $FILE_COUNT files

⚡ Quick fix (linting applied, tests skipped)

Modified files:
$(echo "$CHANGED_FILES" | head -3 | sed 's/^/- /')
$([ "$FILE_COUNT" -gt 3 ] && echo "- ... and $((FILE_COUNT - 3)) more files")

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
fi

if git commit -m "$COMMIT_MSG"; then
    echo "✅ Changes committed successfully"
else
    echo "❌ Failed to commit changes"
    exit 1
fi

# Step 3: Push to remote (if remote branch exists)
echo "🚀 Step 3/3: Pushing to remote..."
CURRENT_BRANCH=$(git branch --show-current)

if git ls-remote --heads origin "$CURRENT_BRANCH" | grep -q "$CURRENT_BRANCH"; then
    if git push; then
        echo "✅ Changes pushed to remote"
    else
        echo "⚠️  Failed to push to remote, but commit was successful"
        echo "💡 You may need to push manually later"
    fi
else
    echo "ℹ️  No remote branch found for '$CURRENT_BRANCH'"
    echo "💡 Use 'git push -u origin $CURRENT_BRANCH' to create remote branch"
fi

echo ""
echo "⚡ Quick fix completed!"
echo "📝 Summary:"
echo "  ✅ Linting applied"
echo "  ⏭️  Tests skipped (quick mode)"
echo "  ✅ Changes committed"
echo "  ✅ Changes pushed (if remote exists)"
echo ""
echo "💡 For full validation, use /check-pr before creating a PR"