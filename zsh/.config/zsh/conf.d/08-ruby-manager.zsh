# =============================================================================
# Ruby Version Manager (rbenv)
# =============================================================================
# Fast Ruby version management with automatic version switching
# Compatible with Homebrew installation: https://github.com/rbenv/rbenv
# =============================================================================

# Initialize rbenv if available
# Note: Synchronous loading ensures env vars propagate correctly
# This adds ~5-10ms to startup but ensures rbenv works immediately
if command -v rbenv &>/dev/null && [[ -o interactive ]]; then
  eval "$(rbenv init - zsh)"
fi
