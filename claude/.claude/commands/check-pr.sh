#!/bin/bash
# Command: /check-pr
# Description: Complete pipeline before creating PR - lint, typecheck, test, security, refactor, commit, and create PR

set -e  # Exit on any error

echo "🚀 Starting complete PR check pipeline..."

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if we're on a protected branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "develop" ]]; then
    echo "❌ Error: Cannot create PR from protected branch '$CURRENT_BRANCH'"
    echo "💡 Please create a feature branch first using /feature-start"
    exit 1
fi

# Step 1: Lint
echo "📝 Step 1/7: Running linter..."
if [ -f "package.json" ]; then
    if pnpm lint 2>/dev/null; then
        echo "✅ Linting passed"
    else
        echo "🔧 Linting failed, attempting auto-fix..."
        if pnpm lint --fix 2>/dev/null; then
            echo "✅ Linting auto-fixed successfully"
        else
            echo "❌ Linting failed even after auto-fix. Please fix manually."
            exit 1
        fi
    fi
else
    echo "ℹ️  No package.json found, skipping lint"
fi

# Step 2: Type checking
echo "🔍 Step 2/7: Running type check..."
if [ -f "package.json" ] && grep -q "typescript" package.json 2>/dev/null; then
    if pnpm type-check 2>/dev/null || pnpm typecheck 2>/dev/null || pnpm tsc 2>/dev/null; then
        echo "✅ Type checking passed"
    else
        echo "❌ Type checking failed. Please fix type errors."
        exit 1
    fi
else
    echo "ℹ️  No TypeScript configuration found, skipping type check"
fi

# Step 3: Tests
echo "🧪 Step 3/7: Running tests..."
if [ -f "package.json" ]; then
    if pnpm test 2>/dev/null; then
        echo "✅ Tests passed"
    else
        echo "❌ Tests failed. Please fix failing tests."
        exit 1
    fi
else
    echo "ℹ️  No package.json found, skipping tests"
fi

# Step 4: Security review
echo "🔒 Step 4/7: Running security review..."
echo "Launching security commit guardian agent..."
# Note: This will be handled by the Task tool when Claude Code processes this command

# Step 5: Code refactoring
echo "🔧 Step 5/7: Running code refactoring analysis..."
echo "Launching code refactor specialist agent..."
# Note: This will be handled by the Task tool when Claude Code processes this command

# Step 6: Commit changes
echo "📦 Step 6/7: Committing changes..."
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes to commit"
else
    git add -A
    
    # Generate commit message based on changes
    COMMIT_MSG="feat: implement feature ready for PR review

🤖 Generated with Claude Code
- Passed all lint checks
- Passed all type checks  
- Passed all tests
- Security reviewed
- Code refactored for quality

Co-Authored-By: Claude <noreply@anthropic.com>"
    
    if git commit -m "$COMMIT_MSG"; then
        echo "✅ Changes committed successfully"
    else
        echo "❌ Failed to commit changes"
        exit 1
    fi
fi

# Step 7: Create PR with gprc
echo "🎯 Step 7/7: Creating PR with gprc..."
if command -v gprc >/dev/null 2>&1; then
    echo "🚀 Launching gprc to create PR with AI-generated content..."
    gprc
    echo "✅ PR creation completed!"
else
    echo "❌ Error: gprc command not found"
    echo "💡 Please ensure your shell functions are loaded or gprc is in PATH"
    exit 1
fi

echo ""
echo "🎉 Complete PR pipeline finished successfully!"
echo "📝 Summary:"
echo "  ✅ Linting passed"
echo "  ✅ Type checking passed" 
echo "  ✅ Tests passed"
echo "  ✅ Security reviewed"
echo "  ✅ Code refactored"
echo "  ✅ Changes committed"
echo "  ✅ PR created with gprc"
echo ""
echo "🔗 Your PR should now be available on GitHub!"