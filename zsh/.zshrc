# ENV 
export ZSH="$HOME/.config/zsh/.oh-my-zsh"
export ZSH_COMPDUMP="$HOME/.cache/zsh/.zcompdump-$HOST-$ZSH_VERSION"
export PNPM_HOME="/Users/walid/Library/pnpm"
export STARSHIP_CONFIG=~/.config/starship/starship.toml
# ENV end


# ZSH
ZSH_THEME="robbyrussell"

plugins=(git)

zstyle ':omz:update' mode reminder

COMPLETION_WAITING_DOTS="true"
# ZSH end


# Sources
source $ZSH/oh-my-zsh.sh
if [ -f ~/.config/starship/starship_theme.sh ]; then
  source ~/.config/starship/starship_theme.sh
fi
# SOURCES end


# CONFIG
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi

if [ -f ~/.config/zsh/aliases ]; then
    source ~/.config/zsh/aliases
fi

# Load all shell functions
if [ -d ~/.config/zsh/functions ]; then
    for f in ~/.config/zsh/functions/*.sh; do
        if [ -r "$f" ]; then
            # Unset existing functions from this file
            for func_name in $(grep -o '^[a-zA-Z_][a-zA-Z0-9_]*()' "$f" 2>/dev/null | sed 's/()$//'); do
                unset -f "$func_name" 2>/dev/null
            done
            # Load the file (readonly variables will only be set if not already defined)
            . "$f"
        fi
    done
fi

# Tmux config auto-load
if [ -n "$TMUX" ] && [ -f ~/.config/tmux/tmux.conf ]; then
    tmux source-file ~/.config/tmux/tmux.conf > /dev/null 2>&1
fi

if [ -f ~/.config/zsh/secrets ]; then
    source ~/.config/zsh/secrets
fi
# CONFIG end


# PNPM
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# PNPM end


# STARSHIP
eval "$(starship init zsh)"
# STARSHIP end

# MISC 
fastfetch
# MISC end

