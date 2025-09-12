#!/bin/bash
# Command: /feature-start
# Description: Start a new feature - create branch from updated base and initialize todos

set -e  # Exit on any error

echo "🚀 Starting new feature development..."

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Check if we're on main or develop
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "develop" ]]; then
    echo "⚠️  Currently on branch: $CURRENT_BRANCH"
    echo "💡 Recommended to start features from main or develop"
    read -p "Continue anyway? (y/N): " choice
    if [[ "$choice" != "y" && "$choice" != "Y" ]]; then
        echo "🛑 Aborting feature start"
        exit 0
    fi
fi

# Step 1: Update base branch
echo "📥 Step 1: Updating base branch ($CURRENT_BRANCH)..."
if git pull --all; then
    echo "✅ Base branch updated successfully"
else
    echo "⚠️  Failed to update base branch, continuing anyway"
fi

# Step 2: Get feature name
if [ $# -gt 0 ]; then
    FEATURE_NAME="$1"
else
    echo "🏷️  Step 2: Feature naming"
    echo "Enter feature name (will be prefixed with 'feature/'):"
    read -p "Feature name: " FEATURE_NAME
fi

# Validate feature name
if [ -z "$FEATURE_NAME" ]; then
    echo "❌ Error: Feature name cannot be empty"
    exit 1
fi

# Clean up feature name (replace spaces with dashes, lowercase)
FEATURE_NAME=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')
BRANCH_NAME="feature/$FEATURE_NAME"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "❌ Error: Branch '$BRANCH_NAME' already exists"
    echo "💡 Use 'git switch $BRANCH_NAME' to work on existing feature"
    exit 1
fi

# Step 3: Create and switch to feature branch
echo "🌱 Step 3: Creating feature branch '$BRANCH_NAME'..."
if git checkout -b "$BRANCH_NAME"; then
    echo "✅ Created and switched to branch: $BRANCH_NAME"
else
    echo "❌ Failed to create feature branch"
    exit 1
fi

# Step 4: Initialize feature with basic structure
echo "📋 Step 4: Initializing feature development structure..."

# Create initial commit for feature start
INIT_COMMIT="feat: initialize $FEATURE_NAME feature

🚀 Feature development started
- Created feature branch from $CURRENT_BRANCH
- Ready for development

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Make an empty commit to mark feature start
if git commit --allow-empty -m "$INIT_COMMIT"; then
    echo "✅ Created initial feature commit"
else
    echo "⚠️  Failed to create initial commit, but branch is ready"
fi

# Step 5: Suggest development workflow
echo ""
echo "🎉 Feature '$FEATURE_NAME' is ready for development!"
echo ""
echo "📝 Recommended workflow:"
echo "  1. Develop your feature incrementally"
echo "  2. Make regular commits with descriptive messages"
echo "  3. Use /quick-fix for small changes"
echo "  4. Use /test-watch during development"
echo "  5. Use /feature-complete when ready to finish"
echo ""
echo "🔧 Useful commands:"
echo "  /test-watch     - Run tests in watch mode"
echo "  /quick-fix      - Quick lint + commit + push"
echo "  /deps-check     - Check dependencies"
echo "  /feature-complete - Complete feature and create PR"
echo ""
echo "📊 Current status:"
echo "  Branch: $BRANCH_NAME"
echo "  Base: $CURRENT_BRANCH"
echo "  Status: Ready for development"
echo ""
echo "Happy coding! 🚀"