# =============================================================================
# ZSH Options
# =============================================================================
# Configure shell behavior: history, completion, navigation
# =============================================================================

# History configuration
HISTFILE="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/history"
HISTSIZE=10000
SAVEHIST=10000

# Create history file directory if needed
mkdir -p "$(dirname "$HISTFILE")"

# History options
setopt SHARE_HISTORY           # Share history across all sessions
setopt HIST_IGNORE_ALL_DUPS    # Remove older duplicate entries from history
setopt HIST_FIND_NO_DUPS       # Don't show duplicates when searching
setopt HIST_REDUCE_BLANKS      # Remove superfluous blanks from history
setopt HIST_VERIFY             # Show command before executing from history
setopt HIST_IGNORE_SPACE       # Don't save commands starting with space

# Completion behavior
setopt MENU_COMPLETE           # Automatically highlight first element of completion menu
setopt AUTO_LIST               # Automatically list choices on ambiguous completion
setopt COMPLETE_IN_WORD        # Complete from both ends of word
setopt ALWAYS_TO_END           # Move cursor to end after completion

# Directory navigation
setopt AUTO_CD                 # Type directory name to cd into it
setopt AUTO_PUSHD              # Make cd push old directory onto directory stack
setopt PUSHD_IGNORE_DUPS       # Don't push duplicates onto directory stack
setopt PUSHD_MINUS             # Exchange meanings of + and - for pushd

# Globbing
setopt EXTENDED_GLOB           # Use extended globbing syntax
