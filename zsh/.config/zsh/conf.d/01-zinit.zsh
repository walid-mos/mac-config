# =============================================================================
# Zinit Plugin Manager
# =============================================================================
# Modern, fast plugin manager with turbo mode for async loading
# https://github.com/zdharma-continuum/zinit
# =============================================================================

# Zinit installation location
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Auto-install Zinit if not present
if [[ ! -f "$ZINIT_HOME/zinit.zsh" ]]; then
  print -P "%F{yellow}Installing Zinit plugin manager...%f"
  mkdir -p "$(dirname "$ZINIT_HOME")"
  git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Load Zinit
source "${ZINIT_HOME}/zinit.zsh"

# Load Oh-My-Zsh git plugin only (for git aliases and completion)
# Provides: gst, gco, ga, gc, gp, gl, etc.
zinit snippet OMZP::git

# Syntax highlighting (deferred after prompt)
# Highlights commands as you type (green = valid, red = invalid)
zinit ice wait lucid atinit"ZINIT[COMPINIT_OPTS]=-C; zicompinit; zicdreplay"
zinit light zsh-users/zsh-syntax-highlighting

# Autosuggestions (deferred)
# Suggests commands from history as you type (gray text)
zinit ice wait lucid atload"_zsh_autosuggest_start"
zinit light zsh-users/zsh-autosuggestions

# History search multi-word (interactive Ctrl+R with multi-word matching)
# Type partial command, use Up/Down or Ctrl+R to search history
zinit light zdharma-continuum/history-search-multi-word
