# =============================================================================
# Startup & Miscellaneous
# =============================================================================
# Shell startup display, editor config, and secret loading
# Note: Ghostty integration moved to 00-ghostty.zsh for early CWD tracking
# =============================================================================

# System info display (conditional)
# Only show in interactive, non-nested shells
if [[ -o interactive ]] && [[ -z "$TMUX" ]] && [[ -z "$NVIM" ]]; then
  if command -v fastfetch &>/dev/null; then
    fastfetch
  fi
fi

# Editor selection
# Use vim for SSH connections (might not have neovim)
# Use neovim for local sessions
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi

# Load secrets (API keys, tokens, etc.)
# This file is gitignored and should contain sensitive data
if [[ -f "$HOME/.config/zsh/secrets" ]]; then
  source "$HOME/.config/zsh/secrets"
fi
