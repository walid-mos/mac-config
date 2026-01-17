# =============================================================================
# Completion System - Styles Configuration
# =============================================================================
# Completion initialization handled by Zinit (01-zinit.zsh)
# This file configures completion behavior and appearance
# =============================================================================

# Homebrew completions (supplement to brew shellenv)
if [[ -d /opt/homebrew/share/zsh/site-functions ]]; then
  fpath=(/opt/homebrew/share/zsh/site-functions $fpath)
fi

# Custom functions path
fpath=(~/.config/zsh/functions $fpath)

# Completion styles
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:warnings' format '%F{red}-- no matches found --%f'

# Cache expensive completions
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "${XDG_CACHE_HOME:-$HOME/.cache}/zsh/completion-cache"
