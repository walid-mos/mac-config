# /review

Process GitHub PR review comments and address them systematically with individual commits.

## Task

I'll fetch all unresolved review comments from the PR associated with your current branch, create a task for each comment, propose fixes, and create atomic commits with proper traceability.

## Process

I'll execute these steps systematically:

1. **Environment Validation**: Ensure we're in a git repository and not on protected branch (main/develop)
2. **PR Detection**: Find the PR associated with current branch using `gh pr view`
3. **Fetch Reviews**: Retrieve all review comments and filter for unresolved ones
4. **Create TODO List**: Generate task list with one item per review comment
5. **Process Each Comment**:
   - Display comment context (author, file, line, text)
   - Read affected file and surrounding code
   - Propose fix and wait for your approval
   - Apply changes after validation
   - Create atomic commit with proper formatting
   - Mark task as completed
6. **Push Confirmation**: Show summary and ask for confirmation before pushing

## Implementation Details

### Pre-flight Checks
```bash
# Verify git repository
git rev-parse --git-dir

# Check current branch
current_branch=$(git branch --show-current)

# Ensure not on protected branch
if [[ "$current_branch" =~ ^(main|master|develop)$ ]]; then
  echo "❌ Cannot run on protected branch: $current_branch"
  exit 1
fi
```

### Fetch PR and Comments
```bash
# Get PR for current branch
gh pr view --json number,url,title,reviews,comments

# Expected JSON structure:
# {
#   "number": 123,
#   "url": "https://github.com/user/repo/pull/123",
#   "title": "Feature: Add authentication",
#   "comments": [
#     {
#       "author": {"login": "reviewer"},
#       "body": "Consider adding input validation here",
#       "path": "src/auth.ts",
#       "line": 42,
#       "url": "https://github.com/user/repo/pull/123#discussion_r123456",
#       "isResolved": false
#     }
#   ],
#   "reviews": [...]
# }
```

### Filter Logic
- **Ignore resolved comments**: `isResolved: false`
- **Ignore bot comments**: Filter out authors like `github-actions[bot]`, `dependabot[bot]`, etc.
- **Focus on code comments**: Prioritize inline comments over general review comments

### TODO List Structure
For each unresolved comment, create task:
```
📝 Review by @username on src/auth.ts:42
   "Consider adding input validation here"
```

### Interactive Fixing Process
For each comment:
1. **Display Context**:
   ```
   🔍 Processing review comment #1/5

   👤 Author: @reviewer
   📄 File: src/auth.ts:42
   💬 Comment: "Consider adding input validation here"
   🔗 URL: https://github.com/user/repo/pull/123#discussion_r123456
   ```

2. **Read File**: Use Read tool to fetch file and surrounding context

3. **Propose Fix**: Analyze code and suggest specific changes

4. **Wait for Approval**:
   - Show proposed changes
   - Ask: "Apply this fix? (y/n/skip/edit)"
   - `y`: Apply and commit
   - `n`: Skip this comment
   - `skip`: Skip and move to next
   - `edit`: Let user modify the proposed fix

5. **Apply Changes**: Use Edit tool to make changes

6. **Create Commit**: Use standardized format

### Commit Message Format
```
fix: address review comment on <subject>

Review by @<username>:
"<comment body>"

Changes:
- <bullet point description of changes>
- <additional changes if any>

File: <file_path>:<line>
Review URL: <github_comment_url>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Example:
```
fix: address review comment on password validation

Review by @john:
"The password validation should also check for special characters"

Changes:
- Add special character validation to password regex pattern
- Update validation error messages
- Add test cases for special character requirements

File: src/auth/password.ts:87
Review URL: https://github.com/acme/api/pull/456#discussion_r789012

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Commit Strategy
```bash
# For each approved fix:
git add <affected_files>
git commit -m "$(cat <<'EOF'
fix: address review comment on <subject>

Review by @<username>:
"<comment>"

Changes:
- <changes>

File: <path>:<line>
Review URL: <url>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Expected Output

```
🎯 Starting PR review comment processor...

✅ Environment validated
📍 Current branch: feature/authentication
🔍 Finding PR for current branch...

✅ Found PR #456: Feature: Add authentication system
🔗 https://github.com/acme/api/pull/456

📥 Fetching review comments...
✅ Found 5 unresolved comments (filtered 3 resolved, 1 bot)

📝 Creating task list...
  1. Review by @john on src/auth/password.ts:87
  2. Review by @jane on src/auth/login.ts:45
  3. Review by @john on src/middleware/auth.ts:23
  4. Review by @jane on tests/auth.test.ts:156
  5. Review by @bob on README.md:89

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Processing review comment 1/5

👤 Author: @john
📄 File: src/auth/password.ts:87
💬 Comment: "The password validation should also check for special characters"
🔗 URL: https://github.com/acme/api/pull/456#discussion_r789012

📖 Reading file and analyzing context...

💡 Proposed fix:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'll update the password regex to include special character validation:

[Shows diff of proposed changes]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply this fix? (y/n/skip): y

✅ Changes applied
✅ Committed: fix: address review comment on password validation
✅ Task 1/5 completed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Repeats for each comment...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All review comments processed!

📊 Summary:
   5 comments processed
   4 fixes applied and committed
   1 skipped
   0 errors

📝 Commits created:
   abc1234 fix: address review comment on password validation
   def5678 fix: address review comment on error handling
   ghi9012 fix: address review comment on middleware logic
   jkl3456 docs: address review comment on README examples

🚀 Ready to push changes?
   Branch: feature/authentication
   Commits: 4 new commits
   Remote: origin

Push to remote? (y/n):
```

## Error Handling

### No PR Found
```
❌ No PR found for branch 'feature/authentication'

💡 Suggestions:
   - Create a PR first: /check-pr
   - Or use: gh pr create
   - Verify you're on the correct branch
```

### No Unresolved Comments
```
✅ No unresolved review comments found!

🎉 All review comments have been addressed or resolved.
   You're ready to merge!
```

### File Not Found
```
⚠️  Comment #3: File src/old-file.ts no longer exists

💡 This file may have been renamed or deleted.
   Skipping this comment...
```

### Protected Branch
```
❌ Cannot run /review on protected branch: main

💡 Switch to a feature branch first:
   git checkout feature/your-branch
```

### Git Conflicts
```
❌ Git conflict detected while applying changes

💡 Please resolve conflicts manually:
   1. Fix conflicts in: src/auth.ts
   2. Run: git add src/auth.ts
   3. Run: git commit (will use prepared message)
   4. Run: /review to continue with remaining comments
```

## Integration Notes

- **Respects Branch Protection**: Refuses to run on main/develop branches
- **Semi-Automatic Mode**: Requires approval for each fix before applying
- **Atomic Commits**: One commit per review comment for clean history
- **GitHub Traceability**: Each commit includes direct link to review comment
- **TODO List Tracking**: Real-time progress tracking with visual feedback
- **Workflow Integration**: Suggests `/check-pr` after all fixes for final validation

## Requirements

- GitHub CLI (`gh`) installed and authenticated
- Git repository with remote origin
- Active PR on current branch
- Review comments on the PR

This command streamlines the process of addressing PR review feedback while maintaining clean commit history and full traceability.
