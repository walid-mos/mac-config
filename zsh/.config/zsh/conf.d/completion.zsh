# =============================================================================
# Completion System
# =============================================================================

# Initialize completion engine
autoload -Uz compinit
compinit -d "${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump"
[[ -d "${XDG_CACHE_HOME:-$HOME/.cache}/zsh" ]] || mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/zsh"

# Completers
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

# Disable parameter assignment completion (prevents var=value ghost entries)
zstyle ':completion:*:-assign-*' tag-order '!parameters'

# Separator between completion and description
zstyle ':completion:*' list-separator '·'

# =============================================================================
# Fallback completer: parse --help for subcommands and flags
# =============================================================================

# Parser — runs in its own scope so locals don't leak into compadd
_help_only__parse() {
  setopt local_options extended_glob

  local help_out
  help_out=$("${(@)words[1,CURRENT-1]}" --help 2>&1)
  [[ -z "$help_out" ]] && help_out=$("${(@)words[1,CURRENT-1]}" help 2>&1)
  [[ -z "$help_out" ]] && return 1

  # Strip ANSI escape sequences (colors, bold, underline, etc.)
  help_out="${help_out//$'\e'\[[0-9;]#m/}"

  local in_cmds=0 line trimmed fp fd fl cmd rest desc

  while IFS= read -r line; do
    [[ -z "${line##[[:space:]]#}" ]] && continue

    # Non-indented line → section header
    if [[ "$line" != [[:space:]]* ]]; then
      [[ "${line:l}" == *command* || "${line:l}" == *subcommand* ]] && in_cmds=1 || in_cmds=0
      continue
    fi

    trimmed="${line##[[:space:]]##}"

    # Flags: lines starting with -
    if [[ "$trimmed" == -* ]]; then
      fp="${trimmed%%[[:space:]][[:space:]]*}"
      fd="${trimmed#${fp}}"
      fd="${fd##[[:space:]]##}"
      for fl in ${(s:,:)fp}; do
        fl="${fl##[[:space:]]##}"
        fl="${fl%%[[:space:]]*}"
        fl="${fl%%=*}"
        [[ "$fl" == -* ]] || continue
        [[ -n "$fd" ]] && _ho_flags+=("${fl}:${fd}") || _ho_flags+=("$fl")
      done
      continue
    fi

    # Subcommands: indented word inside a commands section
    if (( in_cmds )); then
      cmd="${trimmed%%[[:space:]]*}"
      [[ "$cmd" == [[:alpha:]]* ]] || continue
      rest="${trimmed#$cmd}"
      desc="${rest##[[:space:]]##}"
      [[ "$desc" == "$rest" ]] && desc=""
      [[ -n "$desc" ]] && _ho_subcmds+=("$cmd:$desc") || _ho_subcmds+=("$cmd")
    fi
  done <<< "$help_out"
}

# Main completer — only has clean arrays in scope when compadd runs
_help_only() {
  setopt local_options extended_glob

  # Arrays populated by _help_only__parse (declared here so parse can write to them)
  local -a _ho_subcmds=() _ho_flags=()
  _help_only__parse || return 1

  # Nothing found
  (( ${#_ho_subcmds} + ${#_ho_flags} )) || return 1

  local ret=1
  (( ${#_ho_subcmds} )) && { _describe -t commands 'command' _ho_subcmds && ret=0; }
  (( ${#_ho_flags} ))   && { _describe -t options 'option' _ho_flags && ret=0; }
  return $ret
}
compdef _help_only -default-
