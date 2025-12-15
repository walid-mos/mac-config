# =============================================================================
# Key Bindings
# =============================================================================
# Terminal key bindings optimized for Ghostty on macOS
# Requires: macos-option-as-alt = left (or true) in Ghostty config
# =============================================================================

# Use emacs key bindings (default, but explicit)
bindkey -e

# =============================================================================
# Word Navigation (Alt + Left/Right arrows)
# =============================================================================
# These are the primary bindings for Ghostty with macos-option-as-alt enabled
bindkey "^[[1;3D" backward-word    # Option + Left (Ghostty standard)
bindkey "^[[1;3C" forward-word     # Option + Right (Ghostty standard)

# Alternative bindings (emacs-style, work in all terminals)
bindkey "^[b" backward-word        # Option + B
bindkey "^[f" forward-word         # Option + F

# =============================================================================
# Line Navigation
# =============================================================================
# Home/End keys
bindkey "^[[H" beginning-of-line   # Home
bindkey "^[[F" end-of-line         # End
bindkey "^[[1~" beginning-of-line  # Home (alternative sequence)
bindkey "^[[4~" end-of-line        # End (alternative sequence)

# Ctrl + A/E: Beginning/End of line (standard Unix)
bindkey "^A" beginning-of-line     # Ctrl + A
bindkey "^E" end-of-line           # Ctrl + E

# =============================================================================
# Deletion
# =============================================================================
bindkey "^[[3~" delete-char        # Delete key (forward delete)
bindkey "^?" backward-delete-char  # Backspace
bindkey "^W" backward-kill-word    # Ctrl + W (delete word backward)
bindkey "^U" backward-kill-line    # Ctrl + U (kill line to beginning)
bindkey "^K" kill-line             # Ctrl + K (kill line to end)

# =============================================================================
# History Navigation
# =============================================================================
# Prefix-based search: type partial command, Up/Down shows only matching entries
bindkey "^[[A" history-beginning-search-backward  # Up arrow
bindkey "^[[B" history-beginning-search-forward   # Down arrow
bindkey "^P" history-beginning-search-backward    # Ctrl + P
bindkey "^N" history-beginning-search-forward     # Ctrl + N

# =============================================================================
# Search
# =============================================================================
# Ctrl+R uses history-search-multi-word plugin (multi-word AND matching)
bindkey "^R" history-search-multi-word
bindkey "^S" history-incremental-search-forward   # Ctrl + S (forward search)
