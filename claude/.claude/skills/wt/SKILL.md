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

Thin wrapper around the `wt` zsh function. The skill delegates everything to it — keep it that way.

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

All commands invoke the existing `wt` zsh function — source it first:

```bash
source ~/.config/zsh/functions/wt
```

### Spawn flow — `/wt <branch>`

```bash
source ~/.config/zsh/functions/wt && wt spawn "<branch>"
```

`wt spawn` is idempotent (reuses an existing worktree if present), formats the workspace name from the branch, and calls `cmux new-workspace --command "claude"`. If the worktree contains `pnpm-lock.yaml`, it also kicks off `pnpm install` in the background (logged to `/tmp/wt-spawn-<project>-<branch>-pnpm.log`); failures surface via a macOS notification. Report branch + worktree path + workspace name to the user.

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

1. **Never duplicate logic from the `wt` function** — always shell out to it. If the spawn flow needs to change, edit `~/.config/zsh/functions/wt` (the `wt_spawn` function), not this skill.
2. **Never invoke `wt clean` without explicit branch names** — opens fzf otherwise.
3. **Verify cmux is reachable**: `wt spawn` requires the cmux app to be running. If it fails with a socket error, tell the user cmux isn't running.
4. **Warn before destructive ops**: `clean` and `prune` delete worktree directories.
5. **Do not `cd` into the new worktree from the current Bash session** — `cd` doesn't persist across Bash calls and the new worktree lives in the new cmux workspace anyway.
