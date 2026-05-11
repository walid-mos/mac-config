---
name: pr
user-invocable: true
description: >-
  Open a clean GitHub pull request via `gh` from the current branch to a
  target branch (default: repo's default branch). Use when the user runs
  `/pr`, asks to "open a PR", "create a pull request", or wants to push the
  current branch as a reviewable PR. Runs pre-flight hygiene, generates a
  conventional-commit-aligned title and structured body (Summary / Changes /
  Test plan). Flags: `--draft`, `--base <branch>`, `--title`, `--body`.
---

# Clean Pull Request

One-shot: take the current branch and open a high-quality GitHub PR against a target branch. Default target is the repository's default branch (resolved from GitHub, not assumed). All pre-flight hygiene runs before any push or PR creation.

## Arguments

- First positional arg, or `--base <branch>`: target branch. Default = repo's default branch (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`).
- `--draft`: open as a draft PR.
- `--title "<title>"`: override the auto-generated title.
- `--body "<body>"`: override the auto-generated body.
- No args → target = default branch, normal (non-draft) PR.

Examples:

- `/pr` - PR current branch → default branch
- `/pr develop` - PR current branch → `develop`
- `/pr --draft` - draft PR → default branch
- `/pr --base release/v2 --draft` - draft PR → `release/v2`

## Instructions

Execute phases in order. Stop and report on any REFUSE condition; do not push or open a PR until every pre-flight check passes.

### Phase 1 - Resolve context (single Bash call, read-only)

```bash
git rev-parse --git-dir > /dev/null 2>&1 || { echo "REFUSE: not a git repo"; exit 1; }
command -v gh > /dev/null 2>&1 || { echo "REFUSE: gh CLI not installed"; exit 1; }
gh auth status > /dev/null 2>&1 || { echo "REFUSE: gh not authenticated"; exit 1; }

branch=$(git rev-parse --abbrev-ref HEAD)
default_branch=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)
base="${ARG_BASE:-$default_branch}"

echo "branch=$branch"
echo "default_branch=$default_branch"
echo "base=$base"
echo "---"
git status --porcelain
echo "---"
git log --oneline "origin/$base..HEAD" 2>/dev/null || echo "(no upstream comparison yet)"
echo "---"
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "(no upstream tracking)"
echo "---"
gh pr view --json number,state,url 2>/dev/null || echo "(no existing PR)"
```

Use the output to drive Phase 2 checks.

### Phase 2 - Pre-flight hygiene

Hard refuse and stop if any of the following fail:

1. **Not on base branch** - `branch != base`. Refuse: "cannot PR base branch into itself".
2. **Working tree clean** - `git status --porcelain` empty. If dirty, REFUSE and tell the user to commit/stash first. (Do NOT auto-commit.)
3. **No PR already open** - `gh pr view` returned no existing PR for this branch in `OPEN` state. If one exists, print its URL and jump to the **Existing-PR flow** below (do NOT proceed with creation).
4. **Has commits ahead of base** - `git log origin/$base..HEAD` non-empty. If empty, refuse: "no commits to PR".
5. **No fixup/WIP/squash commits** - scan `git log --format=%s origin/$base..HEAD` for `^fixup!`, `^squash!`, `^wip\b`, `^WIP\b`, `^tmp\b`. If found, REFUSE and list them - tell the user to interactive-rebase first (`git rebase -i origin/$base`). Do NOT run rebase on their behalf.

Soft warnings (continue, but flag in the final summary):

6. **Branch behind base** - `git rev-list --count HEAD..origin/$base` > 0. Warn that base has new commits; suggest the user rebase before merging. Do not auto-rebase.
7. **Large diff** - `git diff --shortstat origin/$base..HEAD` files changed > 30 OR insertions+deletions > 1000. Warn that the PR may be hard to review and suggest splitting.
8. **No tests touched** - diff doesn't include any `*.test.*`, `*.spec.*`, `__tests__/`, or `tests/` paths AND non-test source files were changed. Warn but proceed; mention in the test plan that manual verification is needed.

### Existing-PR flow (early branch)

If Phase 2 detected an open PR for the current branch:

1. Print the existing PR's URL, title, and current state.
2. Load `AskUserQuestion` via `ToolSearch query="select:AskUserQuestion"`.
3. Ask: `"PR already open for '<branch>'. Update its title/body with a freshly generated one?"` with options:
   - `"Update body"` - regenerate body via Phase 5, then run `gh pr edit <number> --body "<new body>"`. Do NOT touch the title unless the user passed `--title`.
   - `"Update title and body"` - regenerate both via Phase 4 + Phase 5, run `gh pr edit <number> --title "<new title>" --body "<new body>"`.
   - `"Open in browser"` - run `gh pr view --web` and stop.
   - `"Nothing"` - stop, no action.
4. Skip Phase 3–6 entirely. Skip the push (the branch is already published if a PR exists; only push if Phase 1 detected unpushed commits, in which case run `git push` before the edit).

### Phase 3 - Sync with remote

```bash
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
if [ -z "$upstream" ]; then
  git push -u origin "$branch"
else
  ahead=$(git rev-list --count '@{u}..HEAD')
  if [ "$ahead" -gt 0 ]; then
    git push
  fi
fi
```

If `git push` fails (e.g. non-fast-forward), STOP and report - do not force-push. Tell the user to resolve manually.

### Phase 4 - Generate title

Pick the title in this order:

1. If user passed `--title`, use it verbatim (still verify <= 72 chars, warn if longer; never auto-truncate).
2. If the branch has exactly **one commit** ahead of base, use that commit's subject.
3. Otherwise, synthesize a title from the diff and commit subjects:
   - Detect convention: scan recent commits on the default branch (`git log --format=%s -20 origin/$default_branch`). If ≥ 60% match `^(feat|fix|update|chore|docs|refactor|test|perf|build|ci|revert)(\([^)]+\))?: `, use the same `<type>(<scope>): <description>` format. Otherwise fall back to plain imperative ("Add X", "Fix Y").
   - Imperative mood ("Add", "Fix", "Update" - never "Added", "Adds", "Adding").
   - Capitalize first letter of the description.
   - No trailing period.
   - **Hard cap: 72 characters.** Tighter is better - aim for ≤ 60.

### Phase 5 - Generate body

Use this exact template. Omit a section only if it would be empty/trivial:

```markdown
## Summary

- <bullet 1: what changed and WHY (motivation, not mechanics)>
- <bullet 2: optional, second high-level point>
- <bullet 3: optional, third high-level point>

## Changes

- <only include for multi-commit PRs touching > 5 files: 3-7 bullets summarizing concrete changes>

## Test plan

- [ ] <verification step - automated tests added/updated, or manual repro steps>
- [ ] <regression checks - what existing flows could break>
- [ ] <edge cases - error paths, empty states, large inputs, etc.>

## Breaking changes

<only include if detected: API/CLI/config changes that break callers. Bullet each one with migration notes.>

## Linked issues

<only include if commit messages reference issues. Format: `Closes #N` / `Refs #N`>
```

Body rules:

- **Summary bullets focus on WHY.** "Add retry-on-429 to fix flaky CI runs." Not "Add retry function." The diff already shows what; the PR explains why.
- **Changes section is optional.** Skip for small PRs (≤ 5 files or single commit) - the Summary covers it. Include for larger PRs to give reviewers a map.
- **Test plan is mandatory** even for trivial changes. Always at least one checklist item - if no tests exist, list manual verification steps.
- **No "How it works" section.** Code review reads code; the body explains intent and verification.
- **No emoji** beyond the trailer (unless user requested otherwise).
- **No screenshots placeholders** - tell the user separately if the change is UI and they should attach images via `gh pr edit`.

### Phase 6 - Create the PR

Pass the body via heredoc to preserve formatting:

```bash
gh pr create \
  --base "$base" \
  --title "<generated title>" \
  ${DRAFT:+--draft} \
  --body "$(cat <<'EOF'
## Summary

- ...

## Test plan

- [ ] ...
EOF
)"
```

Capture the PR URL from gh's stdout.

### Phase 7 - Report

Output to the user:

1. **PR URL** (always - the user wants to click it).
2. **Title** that was used.
3. **Soft warnings** raised in Phase 2 (behind-base, large-diff, no-tests) so they can act on them.
4. **Next steps** if applicable: rebase suggestion, attach screenshots for UI PRs, request reviewers.

## Rules

1. **Never force-push.** If `git push` fails, stop and report. The user resolves divergence.
2. **Never auto-rebase or auto-merge.** Even when behind base, only warn - let the user decide.
3. **Never commit on the user's behalf.** Dirty tree → REFUSE. Stash/commit is the user's call.
4. **Never edit history (`rebase -i`, `commit --amend`)** to clean fixup/WIP commits - refuse and tell the user.
5. **Resolve the default branch from GitHub**, not by guessing `main`. Some repos use `master`, `develop`, or `trunk`.
6. **Detect commit-message convention from history.** Don't impose Conventional Commits on a repo that doesn't use them.
7. **Title hard-cap is 72 chars.** Never truncate a user-supplied `--title`; warn instead.
8. **Test plan is non-negotiable.** Every PR body has at least one test-plan item, even if it's "Manually verified locally - no automated coverage exists."
9. **One PR per branch.** If a PR already exists, never open a duplicate - print its URL and run the Existing-PR flow (AskUserQuestion: update body / update title+body / open in browser / nothing).
10. **Skill never opens a PR from the base branch into itself.** Hard refuse.
11. **No data exfiltration.** The body comes from local git context only - never include env vars, file contents outside the diff, or secrets.

## Quick reference

| Check | Hard refuse | Soft warn |
|---|---|---|
| Not in git repo / no `gh` / not authed | ✓ | |
| On base branch | ✓ | |
| Dirty working tree | ✓ | |
| PR already open | ✓ (print URL) | |
| Zero commits ahead of base | ✓ | |
| Fixup/WIP/squash commits in range | ✓ | |
| Branch behind base | | ✓ |
| > 30 files or > 1000 line diff | | ✓ |
| No tests touched in code change | | ✓ |
| `--title` > 72 chars | | ✓ |
