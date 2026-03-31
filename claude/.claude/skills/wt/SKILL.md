---
name: wt
description: >-
  Manage git worktrees: create, list, switch, clean up, and prune worktrees.
  Wraps the `wt` zsh function for non-interactive use within Claude Code.
user-invocable: true
---

# Git Worktree Manager

Manage git worktrees from Claude Code. All worktrees are centralized in `~/development/worktrees` with the naming pattern `{project}-{branch}`.

## Arguments

- `subcommand` (optional): The worktree operation to perform.
- Additional args depend on the subcommand.

Examples:
- `/wt` — List all worktrees for the current project
- `/wt new feature-auth` — Create a worktree for branch `feature-auth`
- `/wt clean feature-auth` — Remove the worktree for `feature-auth`
- `/wt prune` — Remove worktrees for branches deleted on remote
- `/wt status` — Show git status of all worktrees

## Instructions

### Important: Non-interactive mode

Claude Code cannot interact with prompts (fzf, read). Always use the `-y` flag or provide explicit branch names to avoid interactive prompts.

### Environment setup

The `wt` zsh function is available as a shell function. Source it before use:

```bash
source ~/.config/zsh/functions/wt
```

However, since `cd` in Bash tool does not persist across calls, **do not rely on `wt switch` or `wt new` to change directories**. Instead, after creating or identifying a worktree, report its path to the user and use that path in subsequent commands.

### Subcommands

#### `new <branch> [-y]` — Create a worktree

```bash
source ~/.config/zsh/functions/wt && wt new <branch> -y
```

- Creates `~/development/worktrees/{project}-{branch}/`
- If branch doesn't exist, creates it from current HEAD (auto-confirmed with `-y`)
- If worktree already exists, reports the path
- After creation, tell the user the worktree path

#### `list` — List worktrees

```bash
source ~/.config/zsh/functions/wt && wt list
```

- Shows all worktrees for the current project with their paths and branches
- This is the **default** when `/wt` is invoked with no arguments

#### `status` — Show status of all worktrees

```bash
source ~/.config/zsh/functions/wt && wt status
```

- Shows git status (clean/dirty) for each worktree

#### `clean <branch...> -y` — Remove specific worktrees

```bash
source ~/.config/zsh/functions/wt && wt clean <branch1> [branch2...] -y
```

- Always provide branch name(s) explicitly (no interactive fzf)
- Always use `-y` to skip confirmation
- This removes the worktree but keeps the local branch

#### `prune` — Remove worktrees for deleted remote branches

```bash
source ~/.config/zsh/functions/wt && wt prune
```

- Fetches with `--prune`, finds branches marked as "gone" on remote
- Removes both the worktree AND the local branch
- Will prompt for confirmation — if the user wants auto-confirm, they should run it themselves with `! wt prune`

### Working in a worktree

After creating or identifying a worktree, use its full path for any file operations:

```bash
# Run commands in the worktree directory
git -C ~/development/worktrees/{project}-{branch} status
git -C ~/development/worktrees/{project}-{branch} log --oneline -5
```

Or prefix commands with `cd`:
```bash
cd ~/development/worktrees/{project}-{branch} && git status
```

### Using Claude Code's built-in worktree isolation

For running agents in isolated worktrees, use the Agent tool with `isolation: "worktree"`. This creates a temporary git worktree managed by Claude Code itself — separate from the `wt` managed worktrees. Use the `wt` skill for persistent, user-facing worktrees.

## Rules

1. **Always use `-y` flag** for `new` and `clean` to avoid interactive prompts
2. **Always provide explicit branch names** for `clean` — never invoke without arguments (it opens fzf)
3. **Never invoke `wt switch` without a branch argument** — it opens fzf
4. **Report worktree paths** after creation so the user knows where to find them
5. **Warn before destructive operations** — `clean` and `prune` delete worktree directories
