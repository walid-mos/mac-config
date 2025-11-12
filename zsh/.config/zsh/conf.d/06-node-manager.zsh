# =============================================================================
# Node Version Manager (fnm)
# =============================================================================
# Fast Node Manager with background loading for instant shell startup
# Compatible with mac-setup installation: https://fnm.vercel.app/install
# =============================================================================

# fnm installation directory (standard location from mac-setup)
export FNM_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/fnm"

# Add fnm to PATH immediately
export PATH="$FNM_DIR:$PATH"

# Initialize fnm with auto-switch on directory change
# Note: Background loading doesn't work (env vars don't propagate to parent shell)
# This adds ~5-10ms to startup but ensures fnm works immediately
if command -v fnm &>/dev/null && [[ -o interactive ]]; then
  eval "$(fnm env --use-on-cd)"
fi
