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

# pnpm
export PNPM_HOME="/Users/walid/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end
