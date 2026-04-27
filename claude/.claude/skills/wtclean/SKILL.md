---
name: wtclean
description: >-
  Cleanly remove the current git worktree AND its local branch, then close
  the cmux workspace it was running in. Run from inside a worktree-spawned
  cmux workspace (typically created by `/wt`). Hard-refuses on protected
  branches (main, master, develop, dev, prod, production, staging, release)
  and on the primary worktree.
user-invocable: true
---

# Clean Worktree + Branch + Close cmux Workspace

Counterpart to `/wt`. In one shot: removes the current worktree directory, deletes the local branch, and closes the cmux workspace. The branch is **always** deleted — the user is tired of dangling branches piling up. Hard-refuses on protected branches and on the primary worktree.

## Arguments

None. Always operates on the current cwd's worktree, current branch, and current cmux workspace (`$CMUX_WORKSPACE_ID`).

## Why this skill is shaped the way it is (read before editing)

There are two macOS/Claude Code quirks the implementation has to dodge:

1. **Path case-canonicalization mismatch.** macOS HFS+/APFS is case-insensitive but case-preserving. `git rev-parse --show-toplevel` returns the cwd-cased path, while `git worktree list --porcelain` returns the path git stored when the worktree was created — the two strings can differ in case (e.g. `Development` vs `development`). `git worktree remove <path>` does an exact-string match and rejects the wrong-cased argument. **Always use the path from `git worktree list --porcelain`, never from `rev-parse --show-toplevel`.**

2. **Post-deletion cwd lockout.** Once `git worktree remove` deletes the directory, the persistent shell's cwd no longer exists. Claude Code's Bash tool refuses subsequent calls with `Path X does not exist` because its pre-flight cwd check fails. **All destructive ops MUST happen inside a single Bash call** chained with `&&` — once the directory is gone, you cannot run another Bash command from this session.

Also: **do not use `cd /tmp` or any `cd` outside the worktree.** The user's hook environment may interfere, and we don't need it — `git -C <path>` and `cmux` (a binary talking to a Unix socket) both work regardless of cwd.

## Instructions

### Step 1 — Pre-flight (single Bash call, no side effects)

```bash
branch=$(git rev-parse --abbrev-ref HEAD) && \
  main_repo=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}') && \
  wt_path=$(git worktree list --porcelain | awk -v b="$branch" '
    /^worktree / {p=$2}
    $0 == "branch refs/heads/" b {print p; exit}
  ') && \
  [ -n "$wt_path" ] || wt_path=$(git rev-parse --show-toplevel) && \
  echo "branch=$branch" && \
  echo "main_repo=$main_repo" && \
  echo "wt_path=$wt_path" && \
  echo "cmux_ws=$CMUX_WORKSPACE_ID" && \
  echo "---" && \
  case "$branch" in
    main|master|develop|dev|prod|production|staging|release|HEAD)
      echo "REFUSE: protected branch '$branch'"; exit 1 ;;
  esac && \
  if [ "$wt_path" = "$main_repo" ]; then
    echo "REFUSE: this is the primary worktree"; exit 1
  fi && \
  lower_wt=$(printf '%s' "$wt_path" | tr '[:upper:]' '[:lower:]') && \
  lower_prefix=$(printf '%s' "$HOME/development/worktrees/" | tr '[:upper:]' '[:lower:]') && \
  case "$lower_wt" in
    "$lower_prefix"*) ;;
    *) echo "REFUSE: '$wt_path' not under ~/development/worktrees/ (case-insensitive)"; exit 1 ;;
  esac && \
  echo "preflight=ok" && \
  echo "---" && \
  echo "dirty_status:" && \
  git -C "$wt_path" status --porcelain
```

If the output ends with `preflight=ok` and the `dirty_status:` block is empty → clean, skip to Step 3.

If `preflight=ok` and `dirty_status:` has lines → dirty, go to Step 2.

If output contains `REFUSE:` → stop, report to user, do nothing.

### Step 2 — Dirty worktree (interactive confirm)

When `git status --porcelain` returned non-empty:

1. Run `git -C "$wt_path" status --short` and `git -C "$wt_path" diff --stat HEAD` to summarize.
2. Show the user: count of modified/staged/untracked files, plus the first ~10 lines.
3. Load `AskUserQuestion` via `ToolSearch query="select:AskUserQuestion"`.
4. Ask: `"Worktree '<branch>' has uncommitted changes. Discard and remove worktree + delete branch?"` with options `"Discard and delete"` / `"Cancel"`.
5. If user picks **Cancel** → stop, no destructive action. Done.
6. If user picks **Discard and delete** → set `force_flag="--force"` and proceed to Step 3.

For a clean worktree, `force_flag=""`.

### Step 3 — Destructive sequence (single Bash call, MUST be atomic)

This is the only Bash call that performs destruction. Because the cwd will become invalid after the worktree is removed, **chain everything with `&&` in ONE call** — you cannot rely on running another Bash command afterward.

```bash
git -C "$main_repo" worktree remove $force_flag "$wt_path" && \
  git -C "$main_repo" branch -D "$branch" && \
  { if [ -n "$CMUX_WORKSPACE_ID" ]; then \
      cmux close-workspace --workspace "$CMUX_WORKSPACE_ID"; \
    else \
      echo "(no cmux workspace to close)"; \
    fi }
```

Substitute the actual values for `$main_repo`, `$wt_path`, `$branch`, `$force_flag`, `$CMUX_WORKSPACE_ID` from Step 1 — do not rely on shell variable persistence across Bash calls.

If `git branch -D` fails because the branch was already gone (deleted-on-remote and pruned), that's fine; you can swallow that one with `|| true` on the branch-delete step:

```bash
git -C "$main_repo" worktree remove $force_flag "$wt_path" && \
  { git -C "$main_repo" branch -D "$branch" || true; } && \
  { [ -n "$CMUX_WORKSPACE_ID" ] && cmux close-workspace --workspace "$CMUX_WORKSPACE_ID" || true; }
```

### Reporting

**Before** the Step 3 Bash call, tell the user exactly what will happen: branch name (will be deleted), worktree path (will be removed), cmux workspace id (will be closed). Once the cmux close fires, the session ends and any text after it is lost.

## Rules

1. **Protected branches are hard-refused.** `main`, `master`, `develop`, `dev`, `prod`, `production`, `staging`, `release`, `HEAD`. No flag overrides this.
2. **Primary worktree is hard-refused.** Compared via `git worktree list --porcelain` (first entry).
3. **Branch is always deleted.** No "keep branch" flag — that's the whole point of this skill.
4. **Use git's canonical wt path** from `git worktree list --porcelain`, NOT `git rev-parse --show-toplevel`. macOS case mismatches will silently break the removal otherwise.
5. **All destructive ops in one Bash call**, chained with `&&`. Splitting into multiple calls wedges the session once the worktree directory is deleted.
6. **No `cd` outside the worktree** anywhere. Use `git -C` and absolute paths; cmux doesn't care about cwd.
7. **Dirty worktree → AskUser, never auto-force.** Summarize the diff first.
8. **cmux close is optional**, conditional on `$CMUX_WORKSPACE_ID`. Skip if unset.
9. **cmux close runs last** in the chain, since it kills the session.
