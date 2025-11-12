# =============================================================================
# ZSH Environment Variables (.zshenv)
# =============================================================================
# Loaded for ALL zsh invocations (login, interactive, scripts)
# Only essential environment variables should go here
# =============================================================================

# XDG Base Directory Specification
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"

# Essential PATH
export PATH="$HOME/.local/bin:$PATH"

# PNPM
export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Starship config location
export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"
