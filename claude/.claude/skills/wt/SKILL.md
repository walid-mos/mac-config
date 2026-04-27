---
name: wt
description: >-
  Spawn a git worktree + a new cmux workspace running Claude in it. Primary
  command: `/wt <branch>` creates the worktree, opens a new cmux workspace
  scoped to that worktree, and launches `claude` inside it. Also supports
  list/clean/prune for managing existing worktrees.
user-invocable: true
---

# Worktree + cmux Workspace Spawner

Primary use case: from inside a Claude session running in a cmux workspace, spawn a fresh worktree on a new branch AND a new cmux workspace (left-side tab) with `claude` already running in it.

This is the one-shot replacement for the manual chain: open cmux tab → `wt new` → `claude`.

## Arguments

- `branch` (or first arg): branch name → spawn flow.
- `subcommand`: `list`, `clean`, `prune` for managing existing worktrees.

Examples:
- `/wt fix-login` — create worktree for `fix-login` + cmux workspace + claude
- `/wt list` — list all worktrees for the current project
- `/wt clean fix-login` — remove the `fix-login` worktree
- `/wt prune` — remove worktrees for branches deleted on remote

## Instructions

### Dispatch rule

If the first argument is `list`, `clean`, or `prune`, run that subcommand. Otherwise treat the argument as a branch name and run the spawn flow. With no arguments, default to `list`.

### Spawn flow — `/wt <branch>`

This is the main flow. Steps:

1. **Resolve project name** (same logic as the `wt` zsh function — git remote origin URL, falling back to git root basename):

   ```bash
   git rev-parse --git-dir > /dev/null 2>&1 || { echo "Not in a git repo"; exit 1; }
   remote=$(git config --get remote.origin.url 2>/dev/null)
   if [ -n "$remote" ]; then
     project=$(echo "$remote" | sed -E 's#.*/([^/]+)(\.git)?$#\1#' | sed 's/\.git$//')
   else
     project=$(basename "$(git rev-parse --show-toplevel)")
   fi
   ```

2. **Compute target path**: `~/development/worktrees/{project}-{branch}`

3. **Create the worktree if missing** (skip if path already exists — idempotent):

   ```bash
   target="$HOME/development/worktrees/${project}-${branch}"
   if [ ! -d "$target" ]; then
     source ~/.config/zsh/functions/wt && wt new "$branch" -y
   fi
   ```

4. **Spawn cmux workspace + claude**:

   ```bash
   cmux new-workspace --name "$branch" --cwd "$target" --command "claude"
   ```

   - `--name "$branch"` sets the workspace tab title.
   - `--cwd` opens the workspace at the worktree path.
   - `--command "claude"` auto-launches Claude Code in the main pane.

5. **Report** to the user: branch name, worktree path, and that a new cmux workspace was opened.

### Compact one-liner (preferred when invoking)

```bash
source ~/.config/zsh/functions/wt && \
  branch="<branch>" && \
  remote=$(git config --get remote.origin.url 2>/dev/null) && \
  if [ -n "$remote" ]; then project=$(echo "$remote" | sed -E 's#.*/([^/]+)(\.git)?$#\1#' | sed 's/\.git$//'); else project=$(basename "$(git rev-parse --show-toplevel)"); fi && \
  target="$HOME/development/worktrees/${project}-${branch}" && \
  [ -d "$target" ] || wt new "$branch" -y && \
  cmux new-workspace --name "$branch" --cwd "$target" --command "claude"
```

### Subcommands

#### `list` — list worktrees

```bash
source ~/.config/zsh/functions/wt && wt list
```

Default when `/wt` is invoked with no arguments.

#### `clean <branch...>` — remove worktrees

```bash
source ~/.config/zsh/functions/wt && wt clean <branch1> [branch2...] -y
```

Always provide explicit branch names (no fzf). Removes worktree directory; keeps local branch.

#### `prune` — remove worktrees for deleted remote branches

```bash
source ~/.config/zsh/functions/wt && wt prune
```

Fetches with `--prune`, removes worktrees AND local branches marked "gone" on remote. Will prompt for confirmation — if user wants auto-confirm, suggest they run `! wt prune` themselves.

## Rules

1. **Spawn flow is idempotent on the worktree**: if `~/development/worktrees/{project}-{branch}` already exists, skip `wt new` and just open the cmux workspace pointing at it.
2. **Always pass `-y`** to `wt new` and `wt clean` — Claude cannot answer interactive prompts.
3. **Never invoke `wt clean` without explicit branch names** — opens fzf otherwise.
4. **Verify cmux is reachable**: the spawn command requires the cmux app to be running. If `cmux new-workspace` fails with a socket error, tell the user cmux isn't running.
5. **Warn before destructive ops**: `clean` and `prune` delete worktree directories.
6. **Do not `cd` into the new worktree from the current Bash session** — `cd` doesn't persist across Bash calls and the new worktree lives in the new cmux workspace anyway.
