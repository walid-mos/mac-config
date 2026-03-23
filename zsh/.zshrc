# =============================================================================
# ZSH Configuration (.zshrc)
# =============================================================================
# Loaded for INTERACTIVE shells only
# =============================================================================

# Load modular configurations
for config in ~/.config/zsh/conf.d/*.zsh(N); do
  source "$config"
done

# Aliases & secrets (outside conf.d for quick access)
source ~/.config/zsh/aliases
[[ -f ~/.config/zsh/secrets ]] && source ~/.config/zsh/secrets
