# =============================================================================
# History Configuration
# =============================================================================

# History file location & size
HISTFILE="${XDG_STATE_HOME:-$HOME/.local/state}/zsh/history"
HISTSIZE=50000
SAVEHIST=50000

# Ensure history directory exists
[[ -d "${HISTFILE:h}" ]] || mkdir -p "${HISTFILE:h}"

# History behavior
setopt EXTENDED_HISTORY          # Save timestamp and duration
setopt INC_APPEND_HISTORY        # Write immediately, not on exit
setopt SHARE_HISTORY             # Share history across sessions
setopt HIST_EXPIRE_DUPS_FIRST    # Expire duplicates first when trimming
setopt HIST_IGNORE_DUPS          # Don't record consecutive duplicates
setopt HIST_IGNORE_ALL_DUPS      # Remove older duplicate entries
setopt HIST_FIND_NO_DUPS         # Skip duplicates when searching
setopt HIST_IGNORE_SPACE         # Don't record commands starting with space
setopt HIST_SAVE_NO_DUPS         # Don't write duplicates to file
setopt HIST_VERIFY               # Show expanded command before executing
setopt HIST_NO_STORE             # Don't store `history` command itself

# Up/Down arrows: search history matching current input
autoload -Uz history-search-end
zle -N history-beginning-search-backward-end history-search-end
zle -N history-beginning-search-forward-end history-search-end
bindkey '^[[A' history-beginning-search-backward-end   # Up
bindkey '^[[B' history-beginning-search-forward-end     # Down
bindkey '^[OA' history-beginning-search-backward-end   # Up (alternate)
bindkey '^[OB' history-beginning-search-forward-end     # Down (alternate)
