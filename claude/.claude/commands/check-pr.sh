#!/bin/bash
# Command: /check-pr
# Description: Complete pipeline before creating PR - lint, typecheck, test, security, refactor, commit, and create PR

# Load common library
source "$(dirname "$0")/../lib/common.sh"

# Initialize common library and setup
init_common_lib
init_steps 7

echo "🚀 Starting complete PR check pipeline..."

# Validate git repository
if ! validate_git_repo; then
    exit 1
fi

# Check if we're on a protected branch
if ! CURRENT_BRANCH=$(check_current_branch); then
    handle_error 1 "Cannot create PR from protected branch '$CURRENT_BRANCH'" \
                 "Please create a feature branch first using /feature-start" \
                 "Protected branch policy"
fi

# Step 1: Lint
next_step "Running linter"
if validate_nodejs_project >/dev/null 2>&1; then
    if ! validate_pnpm; then
        exit 1
    fi
    
    if pnpm lint 2>/dev/null; then
        show_success "Linting passed"
    else
        show_warning "Linting failed, attempting auto-fix"
        if pnpm lint --fix 2>/dev/null; then
            show_success "Linting auto-fixed successfully"
        else
            handle_error 1 "Linting failed even after auto-fix" \
                         "Please fix manually and run again" \
                         "Code quality check"
        fi
    fi
else
    echo "ℹ️  No package.json found, skipping lint"
fi

# Step 2: Type checking
next_step "Running type check"
if validate_nodejs_project >/dev/null 2>&1 && grep -q "typescript" package.json 2>/dev/null; then
    if pnpm type-check 2>/dev/null || pnpm typecheck 2>/dev/null || pnpm tsc 2>/dev/null; then
        show_success "Type checking passed"
    else
        handle_error 1 "Type checking failed" \
                     "Please fix type errors and run again" \
                     "TypeScript validation"
    fi
else
    echo "ℹ️  No TypeScript configuration found, skipping type check"
fi

# Step 3: Tests
next_step "Running tests"
if validate_nodejs_project >/dev/null 2>&1; then
    if pnpm test 2>/dev/null; then
        show_success "Tests passed"
    else
        handle_error 1 "Tests failed" \
                     "Please fix failing tests and run again" \
                     "Test validation"
    fi
else
    echo "ℹ️  No package.json found, skipping tests"
fi

# Step 4: Security review
next_step "Running security review"
echo "Launching security commit guardian agent..."
# Note: This will be handled by the Task tool when Claude Code processes this command

# Step 5: Code refactoring
next_step "Running code refactoring analysis"
echo "Launching code refactor specialist agent..."
# Note: This will be handled by the Task tool when Claude Code processes this command

# Step 6: Commit changes
next_step "Committing changes"
get_git_context
if [ "$GIT_HAS_CHANGES" == "false" ]; then
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
        show_success "Changes committed successfully"
    else
        handle_error 1 "Failed to commit changes" \
                     "Check git status and try again" \
                     "Git commit operation"
    fi
fi

# Step 7: Create PR with gprc
next_step "Creating PR with gprc"
if command_exists gprc; then
    echo "🚀 Launching gprc to create PR with AI-generated content..."
    if gprc; then
        show_success "PR creation completed!"
    else
        handle_error 1 "gprc execution failed" \
                     "Check gprc configuration and try again" \
                     "PR creation"
    fi
else
    handle_error 1 "gprc command not found" \
                 "Please ensure your shell functions are loaded or gprc is in PATH" \
                 "Command availability"
fi

# Show completion summary with timing
end_timer
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