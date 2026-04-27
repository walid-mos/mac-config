# =============================================================================
# Ghostty Shell Integration
# =============================================================================
# MUST load first to properly track CWD for new tabs/splits
# Ghostty auto-injects this in direct shells, but not in exec zsh/tmux/etc.
# =============================================================================

if [[ -n "$GHOSTTY_RESOURCES_DIR" && -r "$GHOSTTY_RESOURCES_DIR/shell-integration/zsh/ghostty-integration" ]]; then
  source "$GHOSTTY_RESOURCES_DIR/shell-integration/zsh/ghostty-integration"
fi
