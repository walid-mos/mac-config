# =============================================================================
# ZSH Environment Variables (.zshenv)
# =============================================================================
# Loaded for ALL zsh invocations (login, interactive, scripts)
# =============================================================================

# XDG Base Directory Specification
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"

# Essential PATH
export PATH="$HOME/.local/bin:$PATH"

# Custom functions
fpath=(~/.config/zsh/functions $fpath)
