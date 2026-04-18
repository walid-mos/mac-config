# =============================================================================
# wt - Git Worktree Manager completion
# =============================================================================
# Provides subcommand completion for `wt` and worktree-branch completion for
# `wt switch` / `wt clean` (and the `wts` / `wtc` aliases). This overrides the
# generic _help_only fallback, which cannot handle `wt switch --help` safely.

# List worktree branches for the current project (excluding the main checkout)
_wt_branches() {
  git rev-parse --git-dir >/dev/null 2>&1 || return 1

  local git_root
  git_root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1

  local -a branches
  branches=(${(f)"$(git worktree list --porcelain 2>/dev/null | awk -v root="$git_root" '
    /^worktree / { path = substr($0, 10) }
    /^branch / {
      branch = substr($0, 8)
      sub(/^refs\/heads\//, "", branch)
      if (path != root) print branch
      path = ""; branch = ""
    }
  ')"})

  (( ${#branches} )) || { _message 'no worktrees found'; return 1; }
  _describe -t branches 'worktree branch' branches
}

_wt() {
  local curcontext="$curcontext" state line
  local -a subcommands
  subcommands=(
    'new:Create a new worktree'
    'switch:Switch to an existing worktree'
    'list:List worktrees for current project'
    'status:Show git status for all worktrees'
    'clean:Remove worktrees'
    'prune:Remove worktrees for deleted remote branches'
    'help:Show help message'
  )

  _arguments -C \
    '1: :->command' \
    '*:: :->args'

  case $state in
    command)
      _describe -t commands 'wt command' subcommands
      ;;
    args)
      case $words[1] in
        switch)
          _wt_branches
          ;;
        clean)
          _arguments \
            '(-y --yes)'{-y,--yes}'[auto-confirm]' \
            '*: :_wt_branches'
          ;;
        new)
          _arguments '(-y --yes)'{-y,--yes}'[auto-confirm]' '1:branch name:'
          ;;
        prune)
          _arguments '(-i --interactive)'{-i,--interactive}'[confirm each worktree]'
          ;;
      esac
      ;;
  esac
}

# Alias wrappers — these functions delegate to `wt <sub>`, so the first
# positional arg is already the branch name, not a subcommand.
_wts() { _wt_branches }
_wtc() { _wt_branches }

compdef _wt wt
compdef _wts wts
compdef _wtc wtc
