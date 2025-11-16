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

# Ruby gems (user-installed) - dynamic version detection
if command -v ruby &>/dev/null; then
  RUBY_VERSION="$(ruby -e 'puts RUBY_VERSION.split(".")[0,2].join(".") + ".0"')"
  export PATH="$HOME/.gem/ruby/${RUBY_VERSION}/bin:$PATH"
fi

# Cargo (Rust) - if exists
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
