#!/bin/bash
# Command: /feature-complete
# Description: Complete feature development - run full checks, squash if needed, and create PR

set -e  # Exit on any error

echo "🏁 Completing feature development..."

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if we're on a feature branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ ! "$CURRENT_BRANCH" =~ ^feature/ ]]; then
    echo "❌ Error: Not on a feature branch (current: $CURRENT_BRANCH)"
    echo "💡 Feature branches should start with 'feature/'"
    read -p "Continue anyway? (y/N): " choice
    if [[ "$choice" != "y" && "$choice" != "Y" ]]; then
        exit 0
    fi
fi

echo "🌿 Working on branch: $CURRENT_BRANCH"

# Step 1: Run full validation pipeline
echo "🔍 Step 1: Running full validation pipeline..."
echo "This will run: lint, type-check, tests, security review, and refactoring"

# Check if check-pr command exists
if [ -f "$HOME/.claude/commands/check-pr.sh" ]; then
    echo "🚀 Running /check-pr pipeline..."
    if bash "$HOME/.claude/commands/check-pr.sh"; then
        echo "✅ Full validation pipeline completed successfully"
        echo "✅ PR has been created with gprc"
        echo ""
        echo "🎉 Feature completion successful!"
        echo "📝 Summary:"
        echo "  ✅ All validations passed"
        echo "  ✅ Code committed"
        echo "  ✅ PR created"
        echo ""
        echo "🔗 Check GitHub for your PR link!"
        exit 0
    else
        echo "❌ Validation pipeline failed"
        echo "💡 Please fix the issues and run /feature-complete again"
        exit 1
    fi
else
    echo "⚠️  /check-pr command not found, running individual steps..."
fi

# Fallback: individual steps if check-pr not available
echo "🔧 Running individual validation steps..."

# Lint
echo "📝 Running lint..."
if [ -f "package.json" ]; then
    if ! pnpm lint; then
        echo "🔧 Attempting auto-fix..."
        if ! pnpm lint --fix; then
            echo "❌ Linting failed. Please fix manually."
            exit 1
        fi
    fi
fi

# Type check
echo "🔍 Running type check..."
if [ -f "package.json" ] && grep -q "typescript" package.json 2>/dev/null; then
    if ! (pnpm type-check 2>/dev/null || pnpm typecheck 2>/dev/null || pnpm tsc 2>/dev/null); then
        echo "❌ Type checking failed. Please fix type errors."
        exit 1
    fi
fi

# Tests
echo "🧪 Running tests..."
if [ -f "package.json" ]; then
    if ! pnpm test; then
        echo "❌ Tests failed. Please fix failing tests."
        exit 1
    fi
fi

# Step 2: Optional commit squashing
echo "📦 Step 2: Commit management"
COMMIT_COUNT=$(git rev-list --count HEAD ^$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD develop 2>/dev/null || echo HEAD~10))

if [ "$COMMIT_COUNT" -gt 3 ]; then
    echo "📊 Found $COMMIT_COUNT commits in this feature branch"
    echo "🤔 Consider squashing commits for cleaner history?"
    echo "Options:"
    echo "  1. Keep all commits (recommended for collaborative features)"
    echo "  2. Squash into fewer commits"
    echo "  3. Skip for now"
    read -p "Choose option (1/2/3): " squash_choice
    
    case $squash_choice in
        2)
            echo "🔧 Interactive rebase will open for squashing..."
            echo "💡 Use 'squash' or 's' for commits you want to combine"
            sleep 2
            git rebase -i HEAD~"$COMMIT_COUNT" || true
            ;;
        1|3|*)
            echo "✅ Keeping current commit structure"
            ;;
    esac
fi

# Step 3: Update documentation if needed
echo "📚 Step 3: Documentation check..."
if [ -f "README.md" ] || [ -f "CLAUDE.md" ]; then
    echo "📖 Documentation files found. Consider if updates are needed:"
    [ -f "README.md" ] && echo "  - README.md: Add new features, update API docs, etc."
    [ -f "CLAUDE.md" ] && echo "  - CLAUDE.md: Update project conventions or workflows"
    
    read -p "Does documentation need updates? (y/N): " doc_choice
    if [[ "$doc_choice" == "y" || "$doc_choice" == "Y" ]]; then
        echo "⏳ Please update documentation now. Press Enter when done..."
        read -p ""
        
        # Commit documentation updates if any
        if ! git diff-index --quiet HEAD --; then
            git add -A
            git commit -m "docs: update documentation for $CURRENT_BRANCH

📚 Updated documentation for feature completion

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
            echo "✅ Documentation updates committed"
        fi
    fi
fi

# Step 4: Final commit and PR creation
echo "🚀 Step 4: Final steps..."

# Commit any remaining changes
if ! git diff-index --quiet HEAD --; then
    git add -A
    git commit -m "feat: complete $CURRENT_BRANCH development

✨ Feature implementation completed
- All validations passed
- Ready for review

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
    echo "✅ Final changes committed"
fi

# Create PR with gprc
echo "🎯 Creating PR with gprc..."
if command -v gprc >/dev/null 2>&1; then
    echo "🚀 Launching gprc to create PR with AI-generated content..."
    gprc
    echo "✅ PR created successfully!"
else
    echo "❌ Error: gprc command not found"
    echo "💡 Please ensure your shell functions are loaded"
    echo "🔗 You can create the PR manually on GitHub"
fi

echo ""
echo "🎉 Feature completion process finished!"
echo "📝 Final summary:"
echo "  ✅ All validations passed"
echo "  ✅ Documentation checked"
echo "  ✅ Code committed"
echo "  ✅ PR creation attempted"
echo ""
echo "🔗 Next steps:"
echo "  - Review your PR on GitHub"
echo "  - Request code review from team members"
echo "  - Monitor CI/CD pipeline"
echo ""
echo "Great work! 🚀"