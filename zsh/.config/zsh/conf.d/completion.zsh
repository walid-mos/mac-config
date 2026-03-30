# =============================================================================
# Completion System
# =============================================================================

# Initialize completion engine
autoload -Uz compinit
compinit -d "${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump"
[[ -d "${XDG_CACHE_HOME:-$HOME/.cache}/zsh" ]] || mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/zsh"

# Completers: try exact match, then approximate (typo-tolerant)
zstyle ':completion:*' completer _complete _approximate

# Case-insensitive and partial matching
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=*' 'l:|=* r:|=*'

# Use menu selection (navigate with arrows)
zstyle ':completion:*' menu select

# Group results by category
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:warnings' format '%F{red}-- no matches --%f'

# Cache
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "${XDG_CACHE_HOME:-$HOME/.cache}/zsh/compcache"

# Fallback for commands without a dedicated completer:
# Parse --help for subcommands AND flags. Never fall back to file listing.
_help_only() {
  setopt local_options extended_glob

  local help_out
  help_out=$("${(@)words[1,CURRENT-1]}" --help 2>&1)
  [[ -z "$help_out" ]] && help_out=$("${(@)words[1,CURRENT-1]}" help 2>&1)
  [[ -z "$help_out" ]] && return 1

  local -a subcmds=() flags=()
  local in_cmds=0 line

  while IFS= read -r line; do
    [[ -z "${line##[[:space:]]#}" ]] && continue

    # Non-indented line → section header
    if [[ "$line" != [[:space:]]* ]]; then
      [[ "${line:l}" == *command* || "${line:l}" == *subcommand* ]] && in_cmds=1 || in_cmds=0
      continue
    fi

    local trimmed="${line##[[:space:]]##}"

    # Flags: lines starting with -
    if [[ "$trimmed" == -* ]]; then
      local flag_part="${trimmed%%[[:space:]][[:space:]]*}"
      local f
      for f in ${(s:,:)flag_part}; do
        f="${f##[[:space:]]##}"
        f="${f%%[[:space:]]*}"
        f="${f%%=*}"
        [[ "$f" == -* ]] && flags+=("$f")
      done
      continue
    fi

    # Subcommands: indented word inside a commands section
    if (( in_cmds )); then
      local cmd="${trimmed%%[[:space:]]*}"
      [[ "$cmd" == [[:alpha:]]* ]] || continue
      local rest="${trimmed#$cmd}"
      local desc="${rest##[[:space:]]##}"
      [[ "$desc" == "$rest" ]] && desc=""
      [[ -n "$desc" ]] && subcmds+=("$cmd:$desc") || subcmds+=("$cmd")
    fi
  done <<< "$help_out"

  (( ${#subcmds} )) && _describe 'command' subcmds
  (( ${#flags} )) && _describe 'flag' flags
  return 0
}
compdef _help_only -default-
