# =============================================================================
# ZSH Configuration (.zshrc)
# =============================================================================
# Loaded for INTERACTIVE shells only
# Main configuration file - loads modular configs and functions
# =============================================================================

# Load modular configurations
for config in ~/.config/zsh/conf.d/*.zsh(N); do
  source "$config"
done

# Load custom functions (flat structure - zsh standard)
fpath=(~/.config/zsh/functions $fpath)
autoload -Uz ~/.config/zsh/functions/*(:t)
