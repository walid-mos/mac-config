---
name: fix-reviews
description: Fix all review comments on the current PR/MR
disable-model-invocation: true
argument-hint: "[pr-url]"
allowed-tools: Bash(gh:*), Bash(glab:*), Bash(git:*), Read, Edit, Grep, Glob
---

# Fix Review Comments

Fix all unresolved review comments on the current branch's PR (GitHub) or MR (GitLab).

## Instructions

### 1. Detect Platform

```bash
git remote get-url origin
```

- `github.com` -> GitHub workflow (`gh` CLI)
- `gitlab` -> GitLab workflow (`glab` CLI)

### 2. Fetch Review Comments

#### GitHub
```bash
# Get PR number
gh pr view --json number -q '.number'

# Get review comments with file/line context
gh api repos/{owner}/{repo}/pulls/{number}/comments

# Get general comments
gh pr view --json reviews,comments
```

#### GitLab
```bash
# Get MR info
glab mr view --output json

# Get discussions
glab api projects/:id/merge_requests/:iid/discussions
```

### 3. Process Each Comment

For each **unresolved** comment:

1. **Read the file** at the path and line number
2. **Check for suggestion blocks**: Apply directly if present
3. **Analyze feedback**: Understand the requested change
4. **If clear**: Apply fix with Edit tool
5. **If ambiguous**: Ask user to clarify
6. **Skip**: Already resolved, outdated, or general discussion

### 4. GitHub Suggestion Blocks

```markdown
```suggestion
const result = computeValue();
```
```

When found:
- Extract suggested code
- Replace lines from `start_line` to `line`
- Apply with Edit tool

### 5. Report Summary

**Fixed:**
- `file.ts:42` - Renamed variable
- `utils.ts:15` - Applied suggestion

**Skipped:**
- `file.ts:100` - Already resolved
- `config.ts:5` - Outdated

**Needs Attention:**
- `service.ts:78` - Architectural decision required

## Error Handling

- No PR/MR: Inform user and exit
- CLI not installed: Provide install instructions
- Rate limited: Suggest retry later

## Dependencies

- GitHub: `gh` CLI authenticated
- GitLab: `glab` CLI authenticated
- Git repository with remote
- Open PR/MR on current branch
