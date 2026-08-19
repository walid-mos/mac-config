---
name: pr
user-invocable: true
description: >-
  Create a GitHub pull request from the current branch: generate a clean,
  reviewer-readable title and description from the full branch diff, push, and
  open the PR via gh. Use when the user runs /pr, says "crée une PR",
  "fais la PR", "ouvre une pull request", or wants to ship the current work as
  a PR.
---

# Create PR

Turn the current branch state into a published GitHub PR with a title and
description a reviewer can understand without having seen the conversation.

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Writing the description from commit messages alone | Read the FULL diff `git diff <base>...HEAD` — commits lie, the diff doesn't |
| Opening a PR from the default branch | Create a branch first, named `<type>/<kebab-summary>` from the changes |
| `git push --force` on a branch that already has a PR | `--force-with-lease` only, and only if the user asked for a rewrite |
| Inventing a test plan ("tests pass") without running anything | Only list verifications actually performed; otherwise write what the reviewer should check |
| Vague titles ("fix stuff", "updates", "améliorations diverses") | Conventional commit format: `type(scope): summary`, ≤ 72 chars, imperative |

## Arguments

- `--draft`: open as draft PR.
- `--base <branch>`: target branch. Default: repo default branch (`gh repo view --json defaultBranchRef`).
- Any remaining text: extra context to weave into the description (e.g. issue number, motivation).

## Instructions

### Phase 1 — Preflight (parallel)

Run in parallel: `git status`, `git log --oneline <base>..HEAD`, `gh pr view --json url,title 2>/dev/null` (existing PR check), default-branch resolution.

- **On the default branch** → create and switch to a new branch before anything else.
- **Uncommitted changes** → commit them first (conventional commit message derived from the diff). Never `stash` or discard.
- **No commits ahead of base and nothing uncommitted** → stop and tell the user there is nothing to PR.
- **A PR already exists for this branch** → push, then update it (`gh pr edit --title --body`) instead of creating a duplicate. Say so in the final message.

### Phase 2 — Understand the change

Read `git diff <base>...HEAD` (three dots: merge-base) plus `git log <base>..HEAD` for intent. For large diffs, read file-by-file via `git diff <base>...HEAD --stat` then the files that matter.

Match the language of the repo's recent commit history (French repo → French PR; English → English).

### Phase 3 — Title and description

**Title**: `type(scope): summary` — the type/scope of the dominant change, not an enumeration. If the branch does several things, the title states the umbrella goal.

**Body** (adapt sections to the change; drop a section rather than pad it):

```markdown
## Summary

2-4 sentences: what this changes and WHY. The reviewer reads only this — it must stand alone.

## Changes

- Grouped by area/package, not by file. One bullet = one logical change.
- Mention behavior changes, breaking changes, and migrations explicitly.

## Test plan

- [ ] What was actually run/verified, or what the reviewer should check.
```

### Phase 4 — Ship

1. `git push -u origin <branch>`.
2. `gh pr create --title "..." --body-file <temp>` — never interpolate the body on the shell. Add `--draft` / `--base` if requested.
3. Report: PR URL, title, one-line recap of what was pushed.

## Troubleshooting

- `gh` not authenticated → tell the user to run `gh auth login`.
- No `origin` remote → `ask_user_question` which remote/repo to target; don't create one silently.
- Push rejected (stale remote branch) → fetch and rebase on the remote branch, never force unprompted.
