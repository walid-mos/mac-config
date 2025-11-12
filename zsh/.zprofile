# =============================================================================
# ZSH Profile (.zprofile)
# =============================================================================
# Loaded for LOGIN shells only (after .zshenv, before .zshrc)
# Use for setting up login session environment (PATH, etc.)
# =============================================================================

# Homebrew (macOS)
eval "$(/opt/homebrew/bin/brew shellenv)"

# Ruby via Homebrew
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
export PATH="/opt/homebrew/lib/ruby/gems/3.4.0/bin:$PATH"

# Cargo (Rust) - if exists
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
