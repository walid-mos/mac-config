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


if [ -f ~/.config/zsh/secret_env ]; then
    source ~/.config/zsh/secret_env
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
eval "$(zellij setup --generate-auto-start zsh)"

