#!/bin/bash
# Starship-inspired statusLine for Claude Code with git status

# Read JSON input
input=$(cat)

# Extract context data
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
base_dir=$(echo "$input" | jq -r '.workspace.base_dir // empty')
model=$(echo "$input" | jq -r '.model.display_name')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
message=$(echo "$input" | jq -r '.message // empty')

# Claude Code version
cc_version=$(claude --version 2>/dev/null | head -1 | sed 's/ .*//')

# Directory display: show base -> current if cd'd elsewhere
dir_name=$(basename "$cwd")
if [ -n "$base_dir" ] && [ "$cwd" != "$base_dir" ]; then
  base_name=$(basename "$base_dir")
  # Shorten cwd with ~ for home
  short_cwd="${cwd/#$HOME/~}"
  dir_name="(${base_name} -> ${short_cwd})"
fi

# Colors
cyan=$(printf '\033[36m')
magenta=$(printf '\033[35m')
green=$(printf '\033[32m')
red=$(printf '\033[31m')
yellow=$(printf '\033[33m')
blue=$(printf '\033[34m')
dim=$(printf '\033[2m')
reset=$(printf '\033[0m')

# Separator
sep="${dim} | ${reset}"

# Line 1: Directory + Branch + Context
git_branch=""
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
  if [ -n "$branch" ]; then
    git_branch="${magenta}${branch}${reset}"
  fi
fi

context_info=""
if [ -n "$remaining" ]; then
  context_info="${sep}${cyan}[${remaining}%]${reset}"
fi

# Git status indicators
git_status=""
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  status_output=$(git -C "$cwd" --no-optional-locks status --porcelain 2>/dev/null)

  if [ -n "$status_output" ]; then
    modified=0
    staged=0
    untracked=0

    while IFS= read -r line; do
      status_code="${line:0:2}"

      case "${status_code:0:1}" in
        M|A|D|R|C) staged=$((staged + 1)) ;;
      esac

      case "${status_code:1:1}" in
        M|D) modified=$((modified + 1)) ;;
      esac

      if [ "$status_code" = "??" ]; then
        untracked=$((untracked + 1))
      fi
    done <<< "$status_output"

    git_status="${sep}"
    [ $staged -gt 0 ] && git_status="${git_status}${green}+${staged}${reset} "
    [ $modified -gt 0 ] && git_status="${git_status}${red}!${modified}${reset} "
    [ $untracked -gt 0 ] && git_status="${git_status}${yellow}?${untracked}${reset} "
  fi
fi

# "on branch" only if branch exists
on_branch=""
if [ -n "$git_branch" ]; then
  on_branch=" on ${git_branch}"
fi

line1="${cyan}${dir_name}${reset}${on_branch}${context_info}${git_status}"

# Line 2: Claude Code version + Model
version_str=""
if [ -n "$cc_version" ]; then
  version_str="${cyan}v${cc_version}${reset}"
fi

line2="${version_str}${sep}${blue}${model}${reset}"

# Line 3: Messages (updates, errors, etc.) - only if present
line3=""
if [ -n "$message" ]; then
  line3="${yellow}${message}${reset}"
fi

# Output lines
printf "%s\n%s" "$line1" "$line2"
if [ -n "$line3" ]; then
  printf "\n%s" "$line3"
fi
