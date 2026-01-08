---
description: Fix all review comments on the current PR/MR
---

# /fix-reviews

Fix all unresolved review comments on the current branch's PR (GitHub) or MR (GitLab).

## Instructions

### 1. Detect Platform

```bash
git remote get-url origin
```

- `github.com` -> GitHub workflow with `gh` CLI
- `gitlab` -> GitLab workflow with `glab` CLI

### 2. Fetch Review Comments

#### GitHub

```bash
# Get PR number
gh pr view --json number -q '.number'

# Get review comments with file/line context
gh api repos/{owner}/{repo}/pulls/{number}/comments

# Get general review comments
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

For each **unresolved** review comment:

1. **Read the file** at the path and line number
2. **Check for suggestion blocks**: If comment contains ` ```suggestion ` block, apply directly
3. **Analyze the feedback**: Understand requested change
4. **If clear and actionable**: Apply the fix
5. **If ambiguous**: Ask user to clarify
6. **Skip** if: Already resolved, outdated, or general discussion

### 4. GitHub Suggestion Blocks

````markdown
````suggestion
const result = computeValue();
```　
````
````

When found:

- Extract suggested code
- Replace lines indicated by `start_line` to `line` range
- Apply using Edit tool

### 5. Report Summary

```
**Fixed:**
- `file.ts:42` - Renamed variable as suggested
- `utils.ts:15` - Applied suggestion block

**Skipped:**
- `file.ts:100` - Already resolved
- `config.ts:5` - Outdated (line changed)

**Needs Manual Attention:**
- `service.ts:78` - Architectural decision required
```

## Error Handling

- No PR/MR exists: Inform user and exit
- CLI not installed: Inform how to install
- API rate limited: Suggest retry later

## Dependencies

- GitHub: `gh` CLI authenticated
- GitLab: `glab` CLI authenticated
- Git repository with remote configured
- Open PR/MR on current branch
