# =============================================================================
# Zoxide (Smarter cd)
# =============================================================================
# Fast directory jumper that learns your habits
# Install: brew install zoxide
# https://github.com/ajeetdsouza/zoxide
# =============================================================================

# Initialize zoxide if available
# Uses default 'z' command (not replacing cd)
if command -v zoxide &>/dev/null && [[ -o interactive ]]; then
  eval "$(zoxide init zsh)"
fi
