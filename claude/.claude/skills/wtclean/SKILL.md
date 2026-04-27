---
name: wtclean
description: >-
  Cleanly remove the current git worktree and close its cmux workspace.
  Run from inside a worktree-spawned cmux workspace (typically created by
  `/wt`). Refuses to run on protected branches (main, master, develop,
  dev, prod, production, staging, release) or in the primary worktree.
user-invocable: true
---

# Clean Worktree + Close cmux Workspace

Counterpart to `/wt`. Removes the current worktree directory and closes the cmux workspace it was running in. Hard-refuses on protected branches and on the primary worktree — it is impossible for this skill to delete `main`.

## Arguments

None. Always operates on the current cwd's worktree and the current cmux workspace (`$CMUX_WORKSPACE_ID`).

## Instructions

### Pre-flight (mandatory, no exceptions)

Run all checks before any destructive action. Refuse the whole operation if ANY check fails.

```bash
# 1. Must be in a git repo
git rev-parse --git-dir > /dev/null 2>&1 || { echo "Not in a git repo"; exit 1; }

# 2. Resolve current branch + worktree path + primary worktree path
branch=$(git rev-parse --abbrev-ref HEAD)
wt_path=$(git rev-parse --show-toplevel)
main_repo=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')

# 3. PROTECTED BRANCHES — refuse
case "$branch" in
  main|master|develop|dev|prod|production|staging|release|HEAD)
    echo "Refusing: branch '$branch' is protected"; exit 1 ;;
esac

# 4. Must NOT be the primary worktree (the main repo)
if [ "$wt_path" = "$main_repo" ]; then
  echo "Refusing: this is the primary worktree, not a managed worktree"; exit 1
fi

# 5. Must live under ~/development/worktrees/ (the /wt convention)
case "$wt_path" in
  "$HOME/development/worktrees/"*) ;;
  *) echo "Refusing: '$wt_path' is not under ~/development/worktrees/"; exit 1 ;;
esac

# 6. Must be inside a cmux workspace
if [ -z "$CMUX_WORKSPACE_ID" ]; then
  echo "Refusing: not inside a cmux workspace (CMUX_WORKSPACE_ID unset)"; exit 1
fi
```

### Execute

After all pre-flight checks pass:

```bash
# Remove the worktree from the main repo (refuses if dirty — that's the safety)
cd /tmp && git -C "$main_repo" worktree remove "$wt_path"

# Close the cmux workspace (this kills the current Claude session — must be last)
cd /tmp && cmux close-workspace --workspace "$CMUX_WORKSPACE_ID"
```

`git worktree remove` will refuse if the worktree has uncommitted/untracked changes. That is the desired behavior — tell the user to commit, stash, or push first. If they truly want to discard, they can run `git worktree remove --force` themselves; this skill does not pass `--force`.

### Compact one-liner

```bash
branch=$(git rev-parse --abbrev-ref HEAD) && \
  wt_path=$(git rev-parse --show-toplevel) && \
  main_repo=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}') && \
  case "$branch" in main|master|develop|dev|prod|production|staging|release|HEAD) echo "Refusing: protected branch '$branch'"; exit 1 ;; esac && \
  [ "$wt_path" != "$main_repo" ] || { echo "Refusing: primary worktree"; exit 1; } && \
  case "$wt_path" in "$HOME/development/worktrees/"*) ;; *) echo "Refusing: not under ~/development/worktrees/"; exit 1 ;; esac && \
  [ -n "$CMUX_WORKSPACE_ID" ] || { echo "Refusing: not in cmux workspace"; exit 1; } && \
  cd /tmp && git -C "$main_repo" worktree remove "$wt_path" && \
  cmux close-workspace --workspace "$CMUX_WORKSPACE_ID"
```

### Reporting

Report the branch name and worktree path that was removed BEFORE running `cmux close-workspace` — once that command runs the session ends and the user won't see anything else from this Claude.

## Rules

1. **Never delete protected branches.** `main`, `master`, `develop`, `dev`, `prod`, `production`, `staging`, `release` (and the literal `HEAD`) are hard-refused. No flag overrides this.
2. **Never operate on the primary worktree.** If `git rev-parse --show-toplevel` equals the first entry of `git worktree list`, refuse.
3. **Never `git branch -D`.** This skill removes the worktree only. The local branch is kept on purpose — pushed work and unmerged commits are preserved. Branch cleanup is the user's call (or `wt prune` for gone-on-remote branches).
4. **Never `--force`.** A dirty worktree is a stop signal. Tell the user to commit/stash/push.
5. **Run the cmux close last.** It terminates the current Claude session, so any subsequent step would not run.
6. **`cd /tmp` before destructive commands** so the spawned shell's cwd is not the directory being deleted.
