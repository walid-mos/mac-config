---
allowed-tools: Bash(gh:*), Bash(glab:*), Bash(git:*), Read, Edit, Grep, Glob
description: Fix all review comments on the current PR/MR
---

# /fix-reviews

Fix all unresolved review comments on the current branch's PR (GitHub) or MR (GitLab).

## Instructions

### 1. Detect Platform

Run:
```bash
git remote get-url origin
```

- If URL contains `github.com` → use **GitHub** workflow with `gh` CLI
- If URL contains `gitlab` → use **GitLab** workflow with `glab` CLI

### 2. Fetch Review Comments

#### GitHub

```bash
# Get PR number for current branch
gh pr view --json number -q '.number'

# Get review comments with file/line context (includes suggestions)
gh api repos/{owner}/{repo}/pulls/{number}/comments

# Get general review comments
gh pr view --json reviews,comments
```

#### GitLab

```bash
# Get MR info
glab mr view --output json

# Get discussions with file/line context
glab api projects/:id/merge_requests/:iid/discussions
```

### 3. Process Each Comment

For each **unresolved** review comment:

1. **Read the file** at the path and line number mentioned in the comment
2. **Check for GitHub suggestion blocks**: If the comment contains a `suggestion` code block, apply it directly using the Edit tool
3. **Analyze the feedback**: Understand what change is being requested
4. **If clear and actionable**: Apply the fix using the Edit tool
5. **If ambiguous or unclear**: Use the AskUserQuestion tool to clarify before proceeding
6. **Skip** comments that are:
   - Already resolved
   - Outdated (file/line no longer exists)
   - General discussion (no code change needed)

### 4. GitHub Suggestion Blocks

GitHub suggestions look like:
```markdown
```suggestion
const result = computeValue();
```
```

When found:
- Extract the suggested code
- Replace the exact lines indicated by the comment's `start_line` to `line` range
- Apply using Edit tool

### 5. Report Summary

After processing all comments, provide a summary:

**Fixed:**
- `file.ts:42` - Renamed variable as suggested
- `utils.ts:15` - Applied suggestion block

**Skipped:**
- `file.ts:100` - Already resolved
- `config.ts:5` - Outdated (line changed)

**Needs Manual Attention:**
- `service.ts:78` - Architectural decision required

## Error Handling

- If no PR/MR exists for current branch: Inform user and exit
- If `gh` or `glab` CLI not installed: Inform user how to install
- If API rate limited: Inform user and suggest retry later

## Dependencies

- GitHub: `gh` CLI authenticated
- GitLab: `glab` CLI authenticated
- Git repository with remote configured
- Open PR/MR on current branch
