# =============================================================================
# Node Version Manager (fnm)
# =============================================================================
# Fast Node Manager with background loading for instant shell startup
# Compatible with mac-setup installation: https://fnm.vercel.app/install
# =============================================================================

# fnm installation directory (standard location from mac-setup)
export FNM_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/fnm"

# Add fnm to PATH immediately (instant binary access)
# This allows `fnm` command to be available right away
export PATH="$FNM_DIR:$PATH"

# Defer full initialization to background (saves 50-80ms startup time)
# Full init includes: shell hooks, auto-cd detection, env setup
# The shell becomes interactive immediately, fnm loads in 1-2 seconds
if [[ -o interactive ]]; then
  {
    # Full fnm initialization with auto-switch on directory change
    eval "$(fnm env --use-on-cd)"
  } &!  # Background job, disowned (no job control messages)
fi
