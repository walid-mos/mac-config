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

# App-specific XDG overrides
export DOCKER_BUILDKIT=1
export TURBO_TELEMETRY_DISABLED=1
export CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1

# Essential PATH
export PATH="$HOME/.local/bin:$PATH"

# Custom functions
fpath=(~/.config/zsh/functions $fpath)
. "$HOME/.cargo/env"

# Secrets (API keys, tokens) — loaded for ALL shells incl. non-interactive (hooks, scripts)
[[ -f ~/.config/zsh/secrets ]] && source ~/.config/zsh/secrets
