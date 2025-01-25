# If you come from bash you might have to change your $PATH.
export PATH=/opt/homebrew/bin:/Users/walid-mos/Library/pnpm:/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin
export ZSH="$HOME/.config/oh-my-zsh"

# Launch commands
fastfetch

if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='nvim'
fi

# pnpm
export PNPM_HOME="/Users/walid-mos/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

zstyle ':omz:update' mode reminder  # just remind me to update when it's time


COMPLETION_WAITING_DOTS="true"
plugins=(
    git
    zsh-shift-select
)


zle -N shift-select::beginning-of-line shift-select::select-and-invoke
zle -N shift-select::end-of-line shift-select::select-and-invoke
# Aliases
if [ -f ~/.config/zsh/aliases ]; then
    source ~/.config/zsh/aliases
fi


if [ -f ~/.zsh_local_aliases ]; then
    source ~/.zsh_local_aliases
fi

source $ZSH/oh-my-zsh.sh
eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship/starship.toml
export DARKMODE
source ~/.config/starship/starship_theme.sh

bindkey -M emacs '^[[1;10D' shift-select::beginning-of-line
bindkey -M emacs '^[[1;10C' shift-select::end-of-line
bindkey -M shift-select '^[[1;10D' shift-select::beginning-of-line
bindkey -M shift-select '^[[1;10C' shift-select::end-of-line

bindkey \^U backward-kill-line
