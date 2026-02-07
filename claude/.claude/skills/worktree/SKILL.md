---
name: wt
description: Manage git worktrees for isolated parallel development
user-invocable: true
argument-hint: <new|switch|clean|list|status> <branch> [-y]
allowed-tools: Bash
---

# Worktree Skill

Manage git worktrees using the `wt` shell function. Worktrees provide isolated working directories for parallel development — each worktree has its own branch and working tree, stored in `~/development/worktrees/`.

## Prerequisite Check

Before running any `wt` command, verify the function is available:

```bash
type wt
```

If `wt` is not found, inform the user:
> The `wt` function is not available in your shell. Make sure your zsh functions are loaded.

## Commands

### `/wt new <branch> [-y]`

Create a new worktree for the given branch and cd into it.

```bash
wt new <branch-name> -y
```

- Creates the branch if it doesn't exist (from current HEAD)
- Creates the worktree at `~/development/worktrees/<project>-<branch>/`
- Changes directory to the new worktree
- `-y` skips all confirmation prompts (required for automation)

### `/wt switch <branch>`

Switch to an existing worktree.

```bash
wt switch <branch-name>
```

Already non-interactive when a branch name is provided.

### `/wt clean <branch...> [-y]`

Remove one or more worktrees by branch name.

```bash
wt clean <branch-name> -y
```

- Accepts one or more branch names as arguments
- `-y` skips the removal confirmation prompt
- Keeps the local branch (only removes the worktree)

### `/wt list`

List all worktrees for the current project.

```bash
wt list
```

### `/wt status`

Show git status for all worktrees.

```bash
wt status
```

## Usage from Other Skills

Other skills (like `/swarm`) can use `wt` via Bash for worktree isolation:

```bash
# Create isolated worktree for a feature
wt new feat/<session-name> -y

# ... do work in the worktree ...

# Cleanup after PR creation
wt clean feat/<session-name> -y
```

The `-y` flag is essential for automation — it makes all operations fully non-interactive.
