# /quick-fix

Quick fix for small changes - lint, commit, and push (skips tests for speed).

## Task

I'll perform a rapid fix cycle for small changes: auto-fix linting issues, commit changes with descriptive message, and push to remote if available.

## Process

I'll execute these steps quickly:

1. **Detect Changes**: Check if there are any uncommitted changes
2. **Quick Lint**: Run `pnpm lint --fix` to auto-fix style issues
3. **Smart Commit**: Generate contextual commit message based on changed files
4. **Push to Remote**: Push to existing remote branch if available

## Implementation Details

### Change Detection
- Use `git diff-index --quiet HEAD --` to detect changes
- Exit gracefully if no changes found
- Provide informative message about current state

### Linting Strategy
- **Auto-fix Only**: Use `--fix` flag to automatically resolve issues
- **Non-blocking**: Continue even if some lint issues remain (quick mode)
- **Skip Complex**: Don't run full validation, focus on formatting

### Commit Message Generation
- **Single File**: "fix: quick fix for [filename]"
- **Multiple Files**: "fix: quick fixes for N files" with file list
- **Include Metadata**: Mark as quick fix, mention skipped tests
- **Claude Signature**: Add Claude Code co-authorship

### Push Strategy
- **Check Remote**: Verify if remote branch exists
- **Safe Push**: Only push to existing remote branches
- **Guidance**: Provide instructions for new branch setup

## Expected Output

```
⚡ Starting quick fix pipeline...

📝 Step 1/3: Running lint with auto-fix...
✅ Linting completed with auto-fix (3 issues resolved)

📦 Step 2/3: Committing changes...
✅ Changes committed successfully

🚀 Step 3/3: Pushing to remote...
✅ Changes pushed to remote

⚡ Quick fix completed!
📝 Summary:
  ✅ Linting applied
  ⏭️  Tests skipped (quick mode)
  ✅ Changes committed
  ✅ Changes pushed

💡 For full validation, use /check-pr before creating a PR
```

## Commit Message Examples

### Single File Change
```
fix: quick fix for authentication.js

⚡ Quick fix (linting applied, tests skipped)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Multiple Files
```
fix: quick fixes for 5 files

⚡ Quick fix (linting applied, tests skipped)

Modified files:
- src/auth/login.js
- src/utils/helpers.js
- src/components/Header.tsx
- ... and 2 more files

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

## When to Use

- **Small Style Fixes**: Formatting, import organization, minor corrections
- **Documentation Updates**: README changes, comment updates
- **Configuration Tweaks**: Minor config adjustments
- **Urgent Hotfixes**: Critical fixes that need immediate deployment

## When NOT to Use

- **New Features**: Use `/check-pr` for proper validation
- **Refactoring**: Complex changes need full test suite
- **Breaking Changes**: Always run tests for API changes
- **Security Updates**: Always run security review first

This command prioritizes speed over comprehensive validation for minor changes.