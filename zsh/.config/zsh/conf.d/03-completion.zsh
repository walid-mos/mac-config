# =============================================================================
# Completion System
# =============================================================================
# Configure zsh completion with daily cache refresh for better performance
# =============================================================================

# Load completion system
autoload -Uz compinit

# Completion dump location (XDG compliant)
ZCOMPDUMP="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/.zcompdump-$HOST-$ZSH_VERSION"

# Ensure cache directory exists
mkdir -p "$(dirname "$ZCOMPDUMP")"

# Rebuild completion cache only once per day (performance optimization)
# This saves ~100-150ms on each shell startup
if [[ -n $ZCOMPDUMP(#qN.mh+24) ]]; then
  # Cache is older than 24 hours, rebuild it
  compinit -d "$ZCOMPDUMP"
else
  # Cache is fresh, skip check (-C flag)
  compinit -C -d "$ZCOMPDUMP"
fi

# Completion styles
zstyle ':completion:*' menu select                          # Interactive selection menu
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'  # Case insensitive matching
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"    # Colored file listings
zstyle ':completion:*' group-name ''                        # Group completions by category
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'  # Category headers
zstyle ':completion:*:warnings' format '%F{red}-- no matches found --%f'  # No matches message

# Cache expensive completions
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "${XDG_CACHE_HOME:-$HOME/.cache}/zsh/completion-cache"
