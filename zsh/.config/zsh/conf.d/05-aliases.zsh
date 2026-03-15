# =============================================================================
# Shell Aliases
# =============================================================================
# Command shortcuts and overrides
# =============================================================================

# Editor & Shell
alias v="nvim"
alias szsh="exec zsh"  # Better than source ~/.zshrc (starts fresh shell)
alias c="tput reset"   # Clear terminal completely

# Navigation
alias cdev="cd ~/Development"
alias cdconfig="cd ~/.config/"
alias cdstow="cd ~/.stow_repository/"
alias zz="zi"  # Zoxide interactive selection (shorter)

# Git aliases - override Oh-My-Zsh defaults
# Free up 'gf' for our custom git-fetch-prune function
unalias gf 2>/dev/null

# Override OMZ 'gl' with better git log
unalias gl 2>/dev/null
alias gl="git log --oneline --graph --decorate --all"

# Other git shortcuts
alias gs="git switch"
alias gst="git status"
alias gpl="git pull --all"
alias ga="git add"
alias gc="git commit"
alias gr="git rebase"
alias gp="git push"

# GH Shortcuts
alias ghwdev="gh workflow run deploy-dev.yml -R"
alias ghwprod="gh workflow run deploy-prod.yml -R"

# Tools
alias upclaude="rm -rf ~/.local/state/claude/locks && curl -fsSL https://claude.ai/install.sh | sh -s"
alias ghclean="gh run list --limit 500 --json databaseId -q '.[].databaseId' | xargs -I {} gh run delete {}"
alias oc="opencode"
alias qwen-server='llama-server -m ~/unsloth/Qwen3.5-35B-A3B-GGUF/unsloth_Qwen3.5-35B-A3B-GGUF_Qwen3.5-35B-A3B-MXFP4_MOE.gguf -ngl 999 -c 140000 -np 2 -fa on --host 127.0.0.1 --port 8080'

# FNM (Fast Node Manager) shortcuts
alias fnmi="fnm install"
alias fnmu="fnm use"
alias fnml="fnm list"
alias nv="node --version"
