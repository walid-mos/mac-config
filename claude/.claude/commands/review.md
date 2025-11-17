---
allowed-tools: Bash(gh:*), Bash(git:*), Read, Edit
description: Process GitHub PR review comments systematically
---

# Process GitHub PR Review Comments

I'll fetch all unresolved review comments from the PR associated with your current branch, propose fixes, and create individual commits for each resolved comment.

## Process

1. **Environment Validation**
   - Verify git repository
   - Check current branch is not protected (main/develop)
   - Ensure GitHub CLI is authenticated

2. **PR Detection**
   - Find PR for current branch: `gh pr view`
   - Fetch review comments
   - Filter for unresolved comments only

3. **Create TODO List**
   - One task per unresolved comment
   - Show file, line, author, and comment text

4. **Process Each Comment**
   - Display comment context
   - Read affected file and surrounding code
   - Propose fix and explain reasoning
   - Wait for your approval (y/n/skip)
   - Apply changes if approved
   - Create atomic commit with proper format

5. **Summary & Push**
   - Show summary of processed comments
   - List all commits created
   - Ask for confirmation before pushing

## Commit Message Format

```
fix: address review comment on <subject>

Review by @<username>:
"<comment body>"

Changes:
- <bullet point description of changes>

File: <file_path>:<line>
Review URL: <github_comment_url>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Error Handling

### No PR Found
```
❌ No PR found for branch '<branch-name>'

💡 Create a PR first:
   gh pr create
```

### No Unresolved Comments
```
✅ No unresolved review comments!
   All comments have been addressed.
```

### Protected Branch
```
❌ Cannot run /review on protected branch: <branch>

💡 Switch to a feature branch first.
```

### File Not Found
```
⚠️  Comment references non-existent file
    Skipping this comment...
```

## Requirements

- GitHub CLI (`gh`) installed and authenticated
- Git repository with remote origin
- Active PR on current branch
- Review comments on the PR

## Notes

- Each fix is a separate commit for clean history
- Every commit links back to the GitHub review comment
- Semi-automatic: requires approval for each fix
- Respects branch protection rules
