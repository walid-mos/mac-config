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

# pnpm
export PNPM_HOME="/Users/walid/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# Added by Antigravity
export PATH="/Users/walid/.antigravity/antigravity/bin:$PATH"
