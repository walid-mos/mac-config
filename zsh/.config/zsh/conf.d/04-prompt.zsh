# =============================================================================
# Prompt Configuration
# =============================================================================
# Starship prompt - fast, minimal, and infinitely customizable
# https://starship.rs/
# =============================================================================

# Starship prompt (if installed)
if command -v starship &>/dev/null; then
  eval "$(starship init zsh)"
fi
